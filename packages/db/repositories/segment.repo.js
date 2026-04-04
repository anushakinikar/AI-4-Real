import sql from '../client.js';

export async function getSegmentsByDocumentId(documentId) {
    return sql`
        SELECT id, document_id, target_lang, source_text, translated_text, translation_source, locked_by
        FROM segments
        WHERE document_id = ${documentId}
        ORDER BY id
    `;
}

export async function getSegmentById(segmentId) {
    const rows = await sql`
        SELECT id, document_id, target_lang, source_text, translated_text, translation_source, locked_by
        FROM segments
        WHERE id = ${segmentId}
        LIMIT 1
    `;

    return rows[0] || null;
}
