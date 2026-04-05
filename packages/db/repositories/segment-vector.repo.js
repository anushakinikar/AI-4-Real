import sql from '../client.js';

export async function upsertSegmentVector(segmentId, embedding, sourceLang, targetLang) {
    const vectorString = JSON.stringify(embedding);
    return sql`
        INSERT INTO segment_vectors (id, embedding, source_lang, target_lang)
        VALUES (${segmentId}, ${vectorString}, ${sourceLang}, ${targetLang})
        ON CONFLICT (id) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            source_lang = EXCLUDED.source_lang,
            target_lang = EXCLUDED.target_lang
        RETURNING id
    `;
}

export async function getSegmentVectorById(segmentId) {
    const rows = await sql`
        SELECT id, embedding, source_lang, target_lang
        FROM segment_vectors
        WHERE id = ${segmentId}
        LIMIT 1
    `;

    return rows[0] || null;
}
