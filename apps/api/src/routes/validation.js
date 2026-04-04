import {
    getSegmentsByDocumentId,
    getSegmentById,
    updateSegmentSourceText,
    listValidationIssuesByDocumentId,
    getValidationIssueById,
    syncValidationIssueContext,
} from 'db';

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8000';

function toUiIssueType(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUpdatedSegmentText(sourceText, offsetStart, offsetEnd, replacementText) {
    return `${sourceText.slice(0, offsetStart)}${replacementText}${sourceText.slice(offsetEnd)}`;
}

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

    fastify.post('/api/validation-issues/:issueId/resolve', async (request, reply) => {
        const issueId = Number(request.params.issueId);
        const { replacementText, sourceLang } = request.body || {};

        if (!Number.isInteger(issueId) || issueId <= 0) {
            return reply.status(400).send({ error: 'A valid issue id is required.' });
        }

        try {
            const issue = await getValidationIssueById(issueId);

            if (!issue) {
                return reply.status(404).send({ error: 'Validation issue not found.' });
            }

            const segment = await getSegmentById(issue.segment_id);

            if (!segment) {
                return reply.status(404).send({ error: 'Segment not found.' });
            }

            const currentText = String(segment.source_text || '');
            const offsetStart = Number(issue.offset_start ?? 0);
            const offsetEnd = Number(issue.offset_end ?? offsetStart);
            const nextValue = String(replacementText ?? issue.suggestion ?? '');
            const actualSegmentId = Number(segment.id);
            const actualDocumentId = Number(segment.document_id ?? issue.document_id);

            if (!nextValue.trim()) {
                return reply.status(400).send({ error: 'A replacement value is required.' });
            }

            if (
                !Number.isInteger(offsetStart)
                || !Number.isInteger(offsetEnd)
                || offsetStart < 0
                || offsetEnd < offsetStart
                || offsetEnd > currentText.length
            ) {
                return reply.status(400).send({ error: 'Stored validation offsets are invalid for this segment.' });
            }

            let syncedIssue = issue;
            if (
                Number.isInteger(actualSegmentId)
                && actualSegmentId > 0
                && Number.isInteger(actualDocumentId)
                && actualDocumentId > 0
                && (Number(issue.segment_id) !== actualSegmentId || Number(issue.document_id) !== actualDocumentId)
            ) {
                syncedIssue = await syncValidationIssueContext(issue.id, actualSegmentId, actualDocumentId) || issue;
            }

            const updatedSourceText = buildUpdatedSegmentText(currentText, offsetStart, offsetEnd, nextValue);
            const updatedSegment = await updateSegmentSourceText(actualSegmentId, updatedSourceText);

            let validation = null;
            try {
                validation = await triggerDocumentValidation(
                    { id: actualDocumentId },
                    { source_lang: sourceLang || 'en-US' }
                );
            } catch (validationError) {
                request.log.error(validationError);
                validation = {
                    success: false,
                    error: validationError.message,
                };
            }

            return reply.send({
                success: true,
                issueId,
                issue: syncedIssue,
                segment: updatedSegment,
                validation,
            });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to update the segment from the selected issue.' });
        }
    });

    fastify.get('/api/documents/:documentId/quality-report', async (request, reply) => {
        const documentId = Number(request.params.documentId);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return reply.status(400).send({ error: 'A valid document id is required.' });
        }
        try {
            const [segments, issues] = await Promise.all([
                getSegmentsByDocumentId(documentId),
                listValidationIssuesByDocumentId(documentId)
            ]);

            const activeIssues = issues.filter((issue) => issue.resolved_by == null);

            const segmentsWithIssues = segments.map((seg, index) => {
                const sourceText = String(seg.source_text || '');
                const segIssues = activeIssues.filter((issue) => issue.segment_id === seg.id);

                return {
                    id: (index + 1).toString().padStart(2, '0'),
                    dbId: seg.id,
                    title: sourceText.length > 60 ? `${sourceText.substring(0, 60)}...` : sourceText,
                    fullText: sourceText,
                    status: segIssues.length > 0 ? 'error' : 'clean',
                    errors: segIssues.map((issue) => ({
                        issueId: issue.id,
                        type: toUiIssueType(issue.type),
                        original: sourceText.substring(issue.offset_start ?? 0, issue.offset_end ?? 0),
                        suggestion: issue.suggestion,
                        note: issue.message,
                        offsetStart: issue.offset_start,
                        offsetEnd: issue.offset_end,
                    }))
                };
            });

            const stats = {
                spelling: activeIssues.filter((issue) => String(issue.type).toLowerCase() === 'spelling').length,
                grammar: activeIssues.filter((issue) => String(issue.type).toLowerCase() === 'grammar').length,
                totalSegments: segments.length
            };

            return reply.send({ success: true, segments: segmentsWithIssues, stats });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to generate quality report.' });
        }
    });
}