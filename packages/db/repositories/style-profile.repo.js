/**
 * TODO: Add implementation for packages/db/repositories/style-profile.repo.js.
 */
// packages/db/repositories/style-profile.repo.js
import sql from '../client.js';

export async function createStyleProfile(data) {
    const { id, org_id, project_id, domain, tone, source_lang, target_lang, style_rules, reference_pairs, compiled_prompt, created_by } = data;

    // Insert row and return the newly saved record
    const result = await sql`
    INSERT INTO style_profiles (
      id, org_id, project_id, domain, tone, source_lang, target_lang, style_rules, reference_pairs, compiled_prompt, created_by
    ) VALUES (
      ${id}, ${org_id}, ${project_id || 1}, ${domain}, ${tone}, ${source_lang}, ${target_lang}, ${sql.json(style_rules || {})}, ${sql.json(reference_pairs || {})}, ${compiled_prompt || ''}, ${created_by || 1}
    )
    RETURNING *
  `;

    return result[0];
}
