/* apps/api/src/routes/translation.js */
import { pipeline } from '@xenova/transformers';
import {
    getSegmentsByDocumentId,
    upsertSegmentVector,
    findSimilarTmEntries,
    updateSegmentTranslation,
    createSegmentEvaluation,
    getGlossaryByOrgAndLang,
    getTmEntriesByOrgAndLang
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

// --- SCORING UTILITIES ---

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magA * magB);
}

function levenshteinDistance(s1, s2) {
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
        }
    }
    return track[s2.length][s1.length];
}

function fuzzyRatio(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    return (longer.length - levenshteinDistance(longer, shorter)) / parseFloat(longer.length);
}

// --- LANGUAGE HELPERS ---

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

async function translateWithMyMemory(texts, targetLang, sourceLang = 'en') {
    const isoTarget = getLanguageCode(targetLang);
    const isoSource = getLanguageCode(sourceLang);
    const langpair = `${isoSource}|${isoTarget}`;

    const promises = texts.map(async (text) => {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.responseData?.translatedText || null;
        } catch (err) {
            return null;
        }
    });

    return Promise.all(promises);
}

export default async function translationRoutes(fastify) {
    fastify.post('/api/documents/:documentId/translate', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        // Mock org_id and project_id if not in request (Update this based on your auth/session)
        const orgId = 1;
        const projectId = 1;

        try {
            const segments = await getSegmentsByDocumentId(documentId);
            if (!segments || segments.length === 0) return reply.send({ success: true, count: 0 });

            const results = { total: segments.length, tmMatches: 0, mtTranslations: 0, evaluated: 0 };
            const segmentsForML = [];

            // PASS 1: Vectorization & TM
            for (const seg of segments) {
                const embedding = await generateEmbedding(seg.source_text);
                await upsertSegmentVector(seg.id, embedding, 'en-US', seg.target_lang);
                const matches = await findSimilarTmEntries(embedding, 1, 0.95);
                if (matches && matches.length > 0) {
                    await updateSegmentTranslation(seg.id, matches[0].target_text, matches[0].similarity >= 0.99 ? 'TM_EXACT' : 'TM_FUZZY');
                    results.tmMatches++;
                } else {
                    segmentsForML.push(seg);
                    await updateSegmentTranslation(seg.id, null, 'LLM');
                }
            }

            // PASS 2: Translation
            const batchSize = 10;
            for (let i = 0; i < segmentsForML.length; i += batchSize) {
                const batch = segmentsForML.slice(i, i + batchSize);
                const translations = await translateWithMyMemory(batch.map(s => s.source_text), batch[0].target_lang, 'en');
                for (let j = 0; j < batch.length; j++) {
                    if (translations[j]) {
                        await updateSegmentTranslation(batch[j].id, translations[j], 'LLM');
                        results.mtTranslations++;
                    }
                }
            }

            // PASS 3: Quality Evaluation (Back-translation)
            const evaluationTarget = await getSegmentsByDocumentId(documentId);
            const glossary = await getGlossaryByOrgAndLang(orgId, 'en', evaluationTarget[0].target_lang);
            const tmEntries = await getTmEntriesByOrgAndLang(orgId, 'en', evaluationTarget[0].target_lang);

            for (const seg of evaluationTarget) {
                if (!seg.translated_text) continue;

                // 1. Back-translate
                const backTexts = await translateWithMyMemory([seg.translated_text], 'en', seg.target_lang);
                const backText = backTexts[0];
                if (!backText) continue;

                // 2. Semantic Score
                const eOrig = await generateEmbedding(seg.source_text);
                const eBack = await generateEmbedding(backText);
                const S = cosineSimilarity(eOrig, eBack);

                // 3. Glossary Score
                let totalG = 0, correctG = 0;
                for (const g of glossary) {
                    if (seg.source_text.toLowerCase().includes(g.source_term.toLowerCase())) {
                        totalG++;
                        if (seg.translated_text.toLowerCase().includes(g.target_term.toLowerCase())) correctG++;
                    }
                }
                const G = totalG === 0 ? 1.0 : correctG / totalG;

                // 4. TM Fuzzy Score
                let T = 0;
                if (tmEntries.length > 0) {
                    T = Math.max(...tmEntries.map(e => fuzzyRatio(seg.source_text, e.source_text)));
                }

                // 5. Final SQS & Decision
                const sqs = (0.5 * S) + (0.3 * G) + (0.2 * T);
                let decision = 'ACCEPT';
                if (sqs < 0.85) decision = 'REVIEW';
                if (sqs < 0.70) decision = 'RETRANSLATE';
                if (sqs < 0.50) decision = 'LINGUIST REVIEW';

                await createSegmentEvaluation({
                    segmentId: seg.id, documentId, projectId,
                    sourceText: seg.source_text, translatedText: seg.translated_text, backTranslatedText: backText,
                    targetLang: seg.target_lang, semanticScore: S, glossaryScore: G, tmScore: T, finalSqs: sqs,
                    decision, needsLinguistReview: decision.includes('REVIEW')
                });
                results.evaluated++;
            }

            return reply.send({ success: true, results });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Evaluation failed.' });
        }
    });
}
