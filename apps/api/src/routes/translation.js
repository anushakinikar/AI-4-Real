/**
 * translate.js — Translation Route for VaaniSetu
 * ------------------------------------------------
 * Schema-aware implementation based on vaanisetu_db.sql
 *
 * segments table columns used:
 *   - id, document_id, source_text, target_lang
 *   - translated_text   (TEXT)
 *   - translation_source (ENUM: 'TM_EXACT' | 'TM_FUZZY' | 'LLM' | 'MANUAL')
 *
 * segment_vectors table:
 *   - id (INT, FK → segments.id)
 *   - embedding vector(384)  ← all-MiniLM-L6-v2 outputs 384 dims, NOT 1536
 *   - source_lang, target_lang
 *
 * IMPORTANT: Your DB schema declares vector(1536) for segment_vectors.
 * You must run this migration first:
 *
 *   ALTER TABLE segment_vectors
 *     ALTER COLUMN embedding TYPE vector(384)
 *     USING embedding::vector(384);
 *
 * Or switch to 'Xenova/text-embedding-ada-002' which outputs 1536 dims.
 */

import { pipeline } from '@xenova/transformers';
import sql from 'db/client.js';

// ---------------------------------------------------------------------------
// Embedding model (singleton)
// ---------------------------------------------------------------------------
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
    return Array.from(output.data); // 384-dimensional float array
}

// ---------------------------------------------------------------------------
// Language code mapper
// ---------------------------------------------------------------------------
function getLanguageCode(lang) {
    if (!lang) return 'hi';
    const map = {
        'german':   'de',
        'hindi':    'hi',
        'french':   'fr',
        'spanish':  'es',
        'english':  'en',
        'tamil':    'ta',
        'telugu':   'te',
        // BCP-47 pass-through (already correct format)
        'de': 'de', 'hi': 'hi', 'fr': 'fr',
        'es': 'es', 'en': 'en', 'ta': 'ta', 'te': 'te',
    };
    const key = lang.toLowerCase().trim();
    return map[key] || key;
}

// ---------------------------------------------------------------------------
// Azure Translator
// ---------------------------------------------------------------------------
async function translateWithAzure(texts, targetLang, sourceLang = 'en') {
    const apiKey  = process.env.AZURE_TRANSLATOR_KEY;
    const region  = process.env.AZURE_TRANSLATOR_REGION;

    if (!apiKey || !region) {
        throw new Error('Azure config missing: AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION not set in .env');
    }

    const isoTarget = getLanguageCode(targetLang);
    const isoSource = getLanguageCode(sourceLang);
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${isoSource}&to=${isoTarget}`;

    console.log(`📡 Azure request → ${url} (${texts.length} texts, target: ${isoTarget})`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key':    apiKey,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type':                 'application/json',
        },
        body: JSON.stringify(texts.map(text => ({ Text: text }))),
    });

    if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        const message = errorDetail?.error?.message || response.statusText;
        throw new Error(`Azure API error (${response.status}): ${message}`);
    }

    const data = await response.json();
    return data.map(item => item.translations[0].text);
}

// ---------------------------------------------------------------------------
// DB helpers — direct SQL using your schema
// ---------------------------------------------------------------------------

/** Fetch all segments for a document */
async function getSegmentsByDocumentId(documentId) {
    const rows = await sql`
        SELECT id, document_id, source_text, target_lang, translated_text, translation_source
        FROM   segments
        WHERE  document_id = ${documentId}
        ORDER  BY id
    `;
    return rows;
}

/**
 * Write translated_text and translation_source into segments table.
 * translation_source must be one of: 'TM_EXACT' | 'TM_FUZZY' | 'LLM' | 'MANUAL'
 */
async function saveTranslation(segmentId, translatedText, source) {
    const validSources = ['TM_EXACT', 'TM_FUZZY', 'LLM', 'MANUAL'];
    if (!validSources.includes(source)) {
        throw new Error(`Invalid translation_source: "${source}". Must be one of ${validSources.join(', ')}`);
    }

    await sql`
        UPDATE segments
        SET    translated_text    = ${translatedText},
               translation_source = ${source}::translation_source
        WHERE  id = ${segmentId}
    `;
}

/**
 * Upsert segment embedding into segment_vectors.
 * NOTE: embedding must be 384-dimensional (all-MiniLM-L6-v2).
 *       If your DB still has vector(1536), run the migration in the header comment.
 */
async function upsertSegmentVector(segmentId, embedding, sourceLang, targetLang) {
    const embeddingStr = `[${embedding.join(',')}]`;
    await sql`
        INSERT INTO segment_vectors (id, embedding, source_lang, target_lang)
        VALUES (
            ${segmentId},
            ${embeddingStr}::vector,
            ${sourceLang},
            ${targetLang}
        )
        ON CONFLICT (id) DO UPDATE
            SET embedding   = EXCLUDED.embedding,
                source_lang = EXCLUDED.source_lang,
                target_lang = EXCLUDED.target_lang
    `;
}

/**
 * Find TM matches using cosine similarity against tm_vectors.
 * Returns rows with: id, target_text, similarity
 */
async function findSimilarTmEntries(embedding, limit = 1, threshold = 0.95) {
    const embeddingStr = `[${embedding.join(',')}]`;
    const rows = await sql`
        SELECT
            tm.id,
            tm.target_text,
            1 - (tv.embedding <=> ${embeddingStr}::vector) AS similarity
        FROM   tm_vectors  tv
        JOIN   tm_entries  tm ON tm.id = tv.id
        WHERE  1 - (tv.embedding <=> ${embeddingStr}::vector) >= ${threshold}
        ORDER  BY tv.embedding <=> ${embeddingStr}::vector
        LIMIT  ${limit}
    `;
    return rows;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export default async function translationRoutes(fastify) {

    fastify.post('/api/documents/:documentId/translate', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid numeric document ID is required.' });
        }

        try {
            // ── 1. Load all segments ──────────────────────────────────────────
            const segments = await getSegmentsByDocumentId(documentId);

            if (!segments || segments.length === 0) {
                return reply.send({ success: true, message: 'No segments found.', count: 0 });
            }

            request.log.info(`Found ${segments.length} segments for document ${documentId}`);

            const results = {
                total:            segments.length,
                tmExact:          0,
                tmFuzzy:          0,
                azureTranslated:  0,
                failed:           0,
            };

            const segmentsForAzure = [];

            // ── PASS 1: Embed → TM Lookup → Save if match found ──────────────
            for (const seg of segments) {
                let embedding = null;

                try {
                    // Step A: generate embedding
                    embedding = await generateEmbedding(seg.source_text);
                } catch (embedErr) {
                    request.log.error(`Embedding failed for segment ${seg.id}: ${embedErr.message}`);
                    segmentsForAzure.push(seg); // fall through to Azure
                    results.failed++;
                    continue;
                }

                // Step B: store vector (non-blocking — failure won't stop translation)
                try {
                    await upsertSegmentVector(seg.id, embedding, 'en', seg.target_lang);
                } catch (vecErr) {
                    // Log but do NOT skip — translation must still proceed
                    request.log.warn(`Vector upsert failed for segment ${seg.id}: ${vecErr.message}`);
                }

                // Step C: TM lookup
                try {
                    const matches = await findSimilarTmEntries(embedding, 1, 0.95);

                    if (matches && matches.length > 0) {
                        const best   = matches[0];
                        const source = best.similarity >= 0.99 ? 'TM_EXACT' : 'TM_FUZZY';

                        // ✅ Save directly into segments.translated_text
                        await saveTranslation(seg.id, best.target_text, source);

                        if (source === 'TM_EXACT') results.tmExact++;
                        else results.tmFuzzy++;

                        request.log.info(
                            `Segment ${seg.id}: ${source} (similarity=${best.similarity.toFixed(3)})`
                        );
                    } else {
                        // No TM match → queue for Azure
                        segmentsForAzure.push(seg);
                    }
                } catch (tmErr) {
                    request.log.error(`TM lookup failed for segment ${seg.id}: ${tmErr.message}`);
                    segmentsForAzure.push(seg); // fall through to Azure
                }
            }

            request.log.info(`Pass 1 done. ${segmentsForAzure.length} segments queued for Azure.`);

            // ── PASS 2: Azure batch translation ──────────────────────────────
            const BATCH_SIZE = 10; // Azure supports up to 100 per request; 10 is safe

            for (let i = 0; i < segmentsForAzure.length; i += BATCH_SIZE) {
                const batch      = segmentsForAzure.slice(i, i + BATCH_SIZE);
                const texts      = batch.map(s => s.source_text);
                const targetLang = batch[0].target_lang || 'hi';

                try {
                    const translatedTexts = await translateWithAzure(texts, targetLang, 'en');

                    // ✅ Save each Azure result into segments.translated_text
                    for (let j = 0; j < batch.length; j++) {
                        const seg             = batch[j];
                        const translatedText  = translatedTexts[j];

                        if (!translatedText) {
                            request.log.warn(`Azure returned empty translation for segment ${seg.id}`);
                            results.failed++;
                            continue;
                        }

                        await saveTranslation(seg.id, translatedText, 'LLM');
                        results.azureTranslated++;

                        request.log.info(`Segment ${seg.id}: saved Azure translation → "${translatedText.slice(0, 60)}..."`);
                    }
                } catch (batchErr) {
                    request.log.error(`Azure batch [${i}–${i + batch.length - 1}] failed: ${batchErr.message}`);
                    results.failed += batch.length;
                }
            }

            // ── Final summary ─────────────────────────────────────────────────
            request.log.info('Translation complete:', results);

            return reply.send({
                success: true,
                message: 'Translation complete.',
                results,
            });

        } catch (error) {
            request.log.error(`Critical failure for document ${documentId}: ${error.message}`);
            return reply.status(500).send({ error: 'Critical failure in translation service.' });
        }
    });
}