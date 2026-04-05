/* packages/db/repositories/segment-evaluation.repo.js */
import sql from '../client.js';

/**
 * Inserts a new evaluation record for a segment
 */
export async function createSegmentEvaluation(data) {
    const rows = await sql`
        INSERT INTO agent_segment_evaluation (
            segment_id, document_id, project_id,
            source_text, translated_text, back_translated_text,
            source_lang, target_lang, domain,
            semantic_score, glossary_score, tm_score, final_sqs,
            decision, needs_linguist_review, evaluated_by
        ) VALUES (
            ${data.segmentId}, ${data.documentId}, ${data.projectId},
            ${data.sourceText}, ${data.translatedText}, ${data.backTranslatedText},
            'en', ${data.targetLang}, ${data.domain || 'general'},
            ${data.semanticScore}, ${data.glossaryScore}, ${data.tmScore}, ${data.finalSqs},
            ${data.decision}, ${data.needsLinguistReview}, 'AI_AGENT'
        )
        RETURNING id
    `;
    return rows[0];
}
