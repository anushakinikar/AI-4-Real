/* apps/api/src/routes/translation.js */
import { pipeline } from '@xenova/transformers';
import {
    getSegmentsByDocumentId,
    upsertSegmentVector,
    findSimilarTmEntries,
    updateSegmentTranslation
} from 'db';

let extractor = null;

async function getExtractor() {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

export async function generateEmbedding(text) {
    const extract = await getExtractor();
    const output = await extract(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

/**
 * Maps common language names to ISO 639-1 codes for MyMemory
 */
function getLanguageCode(lang) {
    if (!lang) return 'hi';
    const map = {
        'german': 'de',
        'hindi': 'hi',
        'french': 'fr',
        'spanish': 'es',
        'english': 'en',
        'tamil': 'ta',
        'telugu': 'te'
    };
    const key = lang.toLowerCase().trim();
    return map[key] || lang;
}

/**
 * Helper to call MyMemory API
 * Processes segments in parallel since the public API is segment-based
 */
async function translateWithMyMemory(texts, targetLang, sourceLang = 'en') {
    const isoTarget = getLanguageCode(targetLang);
    const isoSource = getLanguageCode(sourceLang);
    const langpair = `${isoSource}|${isoTarget}`;

    console.log(`📡 Calling MyMemory: ${texts.length} segments, ${langpair}`);

    const promises = texts.map(async (text) => {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`MyMemory API error: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.responseStatus !== 200) {
                throw new Error(`MyMemory Error: ${data.responseDetails}`);
            }

            return data.responseData.translatedText;
        } catch (err) {
            console.error(`❌ MyMemory failed for text "${text.slice(0, 20)}...":`, err.message);
            return null; // Return null so we can filter failed ones
        }
    });

    return Promise.all(promises);
}

export default async function translationRoutes(fastify) {
    fastify.post('/api/documents/:documentId/translate', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }

        try {
            // 1. Fetch segments
            const segments = await getSegmentsByDocumentId(documentId);

            if (!segments || segments.length === 0) {
                return reply.send({ success: true, message: 'No segments found to translate.', count: 0 });
            }

            const results = {
                total: segments.length,
                tmMatches: 0,
                mtTranslations: 0,
                failed: 0
            };

            const segmentsForML = [];

            // PASS 1: Vectorization and TM Lookup
            for (const seg of segments) {
                try {
                    const embedding = await generateEmbedding(seg.source_text);
                    await upsertSegmentVector(seg.id, embedding, 'en-US', seg.target_lang);

                    const matches = await findSimilarTmEntries(embedding, 1, 0.95);

                    if (matches && matches.length > 0) {
                        const bestMatch = matches[0];
                        const source = bestMatch.similarity >= 0.99 ? 'TM_EXACT' : 'TM_FUZZY';
                        await updateSegmentTranslation(seg.id, bestMatch.target_text, source);
                        results.tmMatches++;
                    } else {
                        // Mark for MyMemory
                        segmentsForML.push(seg);
                        await updateSegmentTranslation(seg.id, null, 'LLM');
                    }
                } catch (err) {
                    request.log.error(`Pass 1 failed for segment ${seg.id}:`, err);
                    results.failed++;
                }
            }

            // PASS 2: MyMemory Translation (Batching 10 at a time)
            const batchSize = 10;
            for (let i = 0; i < segmentsForML.length; i += batchSize) {
                const batch = segmentsForML.slice(i, i + batchSize);
                const texts = batch.map(s => s.source_text);
                const targetLang = batch[0].target_lang;

                try {
                    const translations = await translateWithMyMemory(texts, targetLang, 'en');

                    for (let j = 0; j < batch.length; j++) {
                        if (translations[j]) {
                            await updateSegmentTranslation(batch[j].id, translations[j], 'LLM');
                            results.mtTranslations++;
                        } else {
                            results.failed++;
                        }
                    }
                } catch (batchErr) {
                    request.log.error(`MyMemory Batch failed at index ${i}:`, batchErr);
                    results.failed += batch.length;
                }
            }

            return reply.send({
                success: true,
                message: 'Translation process complete.',
                results
            });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Critical failure in translation service.' });
        }
    });
}
