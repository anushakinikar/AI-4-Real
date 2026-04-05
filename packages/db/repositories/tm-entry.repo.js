/* packages/db/repositories/tm-entry.repo.js */
import sql from '../client.js';

export async function getTmEntriesByOrgAndLang(orgId, sourceLang, targetLang) {
    return await sql`
        SELECT source_text, target_text
        FROM tm_entries
        WHERE org_id = ${orgId}
          AND source_lang = ${sourceLang}
          AND target_lang = ${targetLang}
    `;
}
