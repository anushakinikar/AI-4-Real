import { listValidationIssuesByDocumentId } from 'db';

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
}
