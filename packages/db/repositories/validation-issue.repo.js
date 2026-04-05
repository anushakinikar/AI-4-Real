import sql from '../client.js';

export async function listValidationIssuesByDocumentId(documentId) {
    return sql`
        SELECT id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
        FROM validation_issues
        WHERE document_id = ${documentId}
        ORDER BY id
    `;
}

export async function getValidationIssueById(issueId) {
    const rows = await sql`
        SELECT id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
        FROM validation_issues
        WHERE id = ${issueId}
        LIMIT 1
    `;

    return rows[0] || null;
}

export async function getValidationIssuesBySegmentId(segmentId) {
    return sql`
        SELECT id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
        FROM validation_issues
        WHERE segment_id = ${segmentId}
        ORDER BY id
    `;
}

export async function syncValidationIssueContext(issueId, segmentId, documentId) {
    const rows = await sql`
        UPDATE validation_issues
        SET segment_id = ${segmentId},
            document_id = ${documentId}
        WHERE id = ${issueId}
        RETURNING id, segment_id, document_id, type, severity, message, offset_start, offset_end, suggestion, resolved_by
    `;

    return rows[0] || null;
}

export async function deleteValidationIssuesByDocumentId(documentId) {
    const result = await sql`
        DELETE FROM validation_issues
        WHERE document_id = ${documentId}
    `;

    return { deletedCount: result.count ?? 0 };
}