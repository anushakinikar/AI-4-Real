import sql from '../client.js';

export async function listValidationIssuesByDocumentId(documentId) {
    return sql`
        SELECT id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
        FROM validation_issues
        WHERE document_id = ${documentId}
        ORDER BY id
    `;
}

export async function getValidationIssuesBySegmentId(segmentId) {
    return sql`
        SELECT id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
        FROM validation_issues
        WHERE segment_id = ${segmentId}
        ORDER BY id
    `;
}

export async function deleteValidationIssuesByDocumentId(documentId) {
    const result = await sql`
        DELETE FROM validation_issues
        WHERE document_id = ${documentId}
    `;

    return { deletedCount: result.count ?? 0 };
}
