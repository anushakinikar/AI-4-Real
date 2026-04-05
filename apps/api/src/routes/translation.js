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
                llmFallback: 0
            };

            // 2. Process each segment
            for (const seg of segments) {
                try {
                    // Generate embedding
                    const embedding = await generateEmbedding(seg.source_text);
                    
                    // Store segment vector
                    await upsertSegmentVector(seg.id, embedding, 'en-US', seg.target_lang);

                    // TM Lookup (0.95 - 1.0 similarity)
                    const matches = await findSimilarTmEntries(embedding, 1, 0.95);

                    if (matches && matches.length > 0) {
                        // TM Match found
                        const bestMatch = matches[0];
                        // Similarity >= 0.99 is TM_EXACT, 0.95-0.98 is TM_FUZZY
                        const source = bestMatch.similarity >= 0.99 ? 'TM_EXACT' : 'TM_FUZZY';
                        await updateSegmentTranslation(seg.id, bestMatch.target_text, source);
                        results.tmMatches++;
                    } else {
                        // No TM match, mark for LLM
                        await updateSegmentTranslation(seg.id, null, 'LLM');
                        results.llmFallback++;
                    }
                } catch (segmentError) {
                    request.log.error(`Failed to process segment ${seg.id}:`, segmentError);
                    // Continue to next segment
                }
            }

            return reply.send({ 
                success: true, 
                message: 'Translation process complete.', 
                results 
            });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to process translation.' });
        }
    });
}
