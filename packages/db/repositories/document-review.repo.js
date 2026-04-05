/**
 * TODO: Add implementation for packages/db/repositories/document.repo.js.
 */
import sql from '../client.js';

export async function createDocument(data) {
    const {
        id, project_id, filename, s3_key, parsed_s3_key, status,
        sensitivity, version, linguist_id, target_lang, uploaded_by
    } = data;

    // Generate random integer if auto-increment is off
    const generatedId = id || Math.floor(Math.random() * 2147483647);

    const result = await sql`
        INSERT INTO documents (
            id, project_id, filename, s3_key, parsed_s3_key, status, 
            sensitivity, version, linguist_id, target_lang, uploaded_by
        ) VALUES (
            ${generatedId}, 
            ${project_id || 1}, 
            ${filename}, 
            ${s3_key}, 
            ${parsed_s3_key || null}, 
            ${status || 'UPLOADED'},  -- Default status
            ${sensitivity || 'STANDARD'}, 
            ${version || 1},         -- Default version 1
            ${linguist_id || null}, 
            ${target_lang}, 
            ${uploaded_by || 1}
        )
        RETURNING *
    `;

    return result[0];
}