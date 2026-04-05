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
 * Maps common language names to ISO 639-1 codes for Azure
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
 * Helper to call Azure Translator API
 */
async function translateWithAzure(texts, targetLang, sourceLang = 'en') {
    // 1. Correct the base URL structure
    const baseUrl = "https://api.cognitive.microsofttranslator.com/translate";
    const apiVersion = "3.0";

    const apiKey = process.env.AZURE_TRANSLATOR_KEY;
    const region = process.env.AZURE_TRANSLATOR_REGION;
    if (!apiKey || !region) {
        console.error("❌ MISSING CONFIG: AZURE_TRANSLATOR_KEY or REGION not found in .env");
        throw new Error("Azure Configuration Missing");
    }
    const isoTarget = getLanguageCode(targetLang);
    const isoSource = getLanguageCode(sourceLang);
    // 2. Build the full URL properly
    const url = `${baseUrl}?api-version=${apiVersion}&to=${isoTarget}&from=${isoSource}`;
    console.log(`📡 Sending to Azure: ${url}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(texts.map(text => ({ Text: text })))
    });
    if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        const message = errorDetail.error?.message || response.statusText;
        console.error(`❌ AZURE API REJECTED (${response.status}):`, message);
        throw new Error(`Azure Error: ${message}`);
    }
    const data = await response.json();
    return data.map(item => item.translations[0].text);
}

export default async function translationRoutes(fastify) {
    fastify.post('/api/documents/:documentId/translate', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }

        try {
            // 1. Fetch all segments for the document
            const segments = await getSegmentsByDocumentId(documentId);

            if (!segments || segments.length === 0) {
                return reply.send({ success: true, message: 'No segments found to translate.', count: 0 });
            }

            const results = {
                total: segments.length,
                tmMatches: 0,
                azureTranslations: 0,
                failed: 0
            };

            // TRACKING: We'll collect segments that need Azure ML translation
            const segmentsForAzure = [];

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
                        // Mark for Azure Pass
                        segmentsForAzure.push(seg);
                        // Optional: Mark in DB as LLM pending
                        await updateSegmentTranslation(seg.id, null, 'LLM');
                    }
                } catch (err) {
                    request.log.error(`Pass 1 failed for segment ${seg.id}:`, err);
                    results.failed++;
                }
            }

            // PASS 2: Azure Batch Translation (Batch size: 10)
            const batchSize = 10;
            for (let i = 0; i < segmentsForAzure.length; i += batchSize) {
                const batch = segmentsForAzure.slice(i, i + batchSize);
                const texts = batch.map(s => s.source_text);
                const targetLang = batch[0].target_lang || 'hi'; // Fallback to Hindi if not specified

                try {
                    const translatedTexts = await translateWithAzure(texts, targetLang, 'en');

                    // Update individual segments in the database
                    for (let j = 0; j < batch.length; j++) {
                        await updateSegmentTranslation(batch[j].id, translatedTexts[j], 'LLM');
                        results.azureTranslations++;
                    }
                } catch (batchErr) {
                    request.log.error(`Azure Batch failed at index ${i}:`, batchErr);
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
