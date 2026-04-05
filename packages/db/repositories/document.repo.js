import sql from '../client.js';

export async function createDocument(data) {
    const {
        id,
        project_id,
        filename,
        s3_key,
        parsed_s3_key,
        status,
        sensitivity,
        version,
        linguist_id,
        target_lang,
        uploaded_by,
    } = data;

    const generatedId = id || Math.floor(Math.random() * 2147483647);

    const result = await sql`
        INSERT INTO documents (
            id,
            project_id,
            filename,
            s3_key,
            parsed_s3_key,
            status,
            sensitivity,
            version,
            linguist_id,
            target_lang,
            uploaded_by
        ) VALUES (
            ${generatedId},
            ${project_id || 1},
            ${filename},
            ${s3_key},
            ${parsed_s3_key || null},
            ${status || 'UPLOADED'},
            ${sensitivity || 'STANDARD'},
            ${version || 1},
            ${linguist_id || null},
            ${target_lang},
            ${uploaded_by || 1}
        )
        RETURNING *
    `;

    return result[0];
}

export async function getDocumentById(documentId) {
    const rows = await sql`
        SELECT *
        FROM documents
        WHERE id = ${documentId}
        LIMIT 1
    `;

    return rows[0] || null;
}

export async function listDocumentsByProjectId(projectId) {
    return sql`
        SELECT *
        FROM documents
        WHERE project_id = ${projectId}
        ORDER BY id DESC
    `;
}
