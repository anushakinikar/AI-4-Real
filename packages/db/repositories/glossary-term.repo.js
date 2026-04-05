/* packages/db/repositories/glossary-term.repo.js */
import sql from '../client.js';

export async function getGlossaryByOrgAndLang(orgId, sourceLang, targetLang) {
    return await sql`
        SELECT source_term, target_term
        FROM glossary_terms
        WHERE org_id = ${orgId}
          AND source_lang = ${sourceLang}
          AND target_lang = ${targetLang}
    `;
}
