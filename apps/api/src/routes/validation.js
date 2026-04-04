import { getSegmentsByDocumentId, listValidationIssuesByDocumentId } from 'db';

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8000';

export async function triggerDocumentValidation(document, context = {}) {
    const documentId = Number(document?.id ?? context?.document_id);

    if (!Number.isInteger(documentId) || documentId <= 0) {
        throw new Error('A valid document id is required before validation can run.');
    }

    const response = await fetch(`${NLP_SERVICE_URL}/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            document_id: documentId,
            source_lang: context.source_lang || context.language || 'en-US',
            max_suggestions: 3,
            overwrite_existing: true
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Validation service failed (${response.status}): ${errorText}`);
    }

    return response.json();
}

export default async function validationRoutes(fastify) {
    fastify.post('/api/documents/:documentId/validate', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }

        try {
            const validation = await triggerDocumentValidation({ id: documentId }, request.body || {});
            return reply.send({ success: true, validation });
        } catch (error) {
            request.log.error(error);
            return reply.status(502).send({ error: error.message });
        }
    });

    fastify.get('/api/documents/:documentId/validation-issues', async (request, reply) => {
        const documentId = Number(request.params.documentId);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }

        try {
            const issues = await listValidationIssuesByDocumentId(documentId);
            return reply.send({ success: true, count: issues.length, issues });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to load validation issues.' });
        }
    });


    fastify.get('/api/documents/:documentId/quality-report', async (request, reply) => {
        const documentId = Number(request.params.documentId);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }
        try {
            // 1. Fetch segments and validation issues in parallel
            const [segments, issues] = await Promise.all([
                getSegmentsByDocumentId(documentId),
                listValidationIssuesByDocumentId(documentId)
            ]);
            // 2. Map issues to their respective segments
            const segmentsWithIssues = segments.map((seg, index) => {
                const segIssues = issues.filter(issue => issue.segment_id === seg.id);

                return {
                    id: (index + 1).toString().padStart(2, '0'), // For UI numbering
                    dbId: seg.id,
                    title: seg.source_text.length > 60 ? seg.source_text.substring(0, 60) + "..." : seg.source_text,
                    fullText: seg.source_text,
                    status: segIssues.length > 0 ? "error" : "clean",
                    errors: segIssues.map(issue => ({
                        type: issue.type, // e.g., 'Spelling', 'Grammar'
                        original: seg.source_text.substring(issue.offset_start, issue.offset_end),
                        suggestion: issue.suggestion,
                        note: issue.message
                    }))
                };
            });
            // 3. Calculate statistics
            const stats = {
                spelling: issues.filter(i => i.type.toLowerCase() === 'spelling').length,
                grammar: issues.filter(i => i.type.toLowerCase() === 'grammar').length,
                totalSegments: segments.length
            };
            return reply.send({ success: true, segments: segmentsWithIssues, stats });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to generate quality report.' });
        }
    });
}