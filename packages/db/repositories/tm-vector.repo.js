import sql from '../client.js';

export async function upsertTmVector(tmId, embedding, sourceLang, targetLang, domain) {
    const vectorString = JSON.stringify(embedding);
    return sql`
        INSERT INTO tm_vectors (id, embedding, source_lang, target_lang, domain)
        VALUES (${tmId}, ${vectorString}, ${sourceLang}, ${targetLang}, ${domain})
        ON CONFLICT (id) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            source_lang = EXCLUDED.source_lang,
            target_lang = EXCLUDED.target_lang,
            domain = EXCLUDED.domain
        RETURNING id
    `;
}

export async function findSimilarTmEntries(embedding, limit = 5, threshold = 0.95) {
    const vectorString = JSON.stringify(embedding);
    // 1 - (embedding <=> tm_vector) is the cosine similarity for pgvector
    return sql`
        SELECT 
            v.id, 
            e.target_text, 
            e.source_text,
            (1 - (v.embedding <=> ${vectorString}::vector)) as similarity
        FROM tm_vectors v
        JOIN tm_entries e ON v.id = e.id
        WHERE (1 - (v.embedding <=> ${vectorString}::vector)) >= ${threshold}
        ORDER BY similarity DESC
        LIMIT ${limit}
    `;
}
