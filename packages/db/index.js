import sql from './client.js';

export async function getUserByEmail(email) {
    const users = await sql`
        SELECT id, email, password, name, name AS full_name
        FROM users
        WHERE email = ${email}
        LIMIT 1
    `;

    return users.length > 0 ? users[0] : null;
}

export { createStyleProfile } from './repositories/style-profile.repo.js';
export { createDocument, getDocumentById, listDocumentsByProjectId } from './repositories/document.repo.js';
export { getSegmentsByDocumentId, getSegmentById, updateSegmentSourceText } from './repositories/segment.repo.js';
export {
    listValidationIssuesByDocumentId,
    getValidationIssueById,
    getValidationIssuesBySegmentId,
    syncValidationIssueContext,
    deleteValidationIssuesByDocumentId,
} from './repositories/validation-issue.repo.js';

export { upsertTmVector, findSimilarTmEntries } from './repositories/tm-vector.repo.js';
export { upsertSegmentVector, getSegmentVectorById } from './repositories/segment-vector.repo.js';
/* packages/db/index.js */

// ... (existing exports) ...

export { createSegmentEvaluation } from './repositories/segment-evaluation.repo.js';
export { getGlossaryByOrgAndLang } from './repositories/glossary-term.repo.js';
export { getTmEntriesByOrgAndLang } from './repositories/tm-entry.repo.js';

export async function updateSegmentTranslation(segmentId, translatedText, translationSource) {
    const rows = await sql`
        UPDATE segments
        SET translated_text = ${translatedText},
            translation_source = ${translationSource}
        WHERE id = ${segmentId}
        RETURNING id, translated_text, translation_source
    `;

    return rows[0] || null;
}