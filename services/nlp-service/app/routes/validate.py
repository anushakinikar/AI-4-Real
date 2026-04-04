import os

import psycopg2
from psycopg2.extras import execute_batch
from fastapi import APIRouter, HTTPException

from app.core.validation import build_validation_rows, normalize_language_code
from app.models.validate_request import ValidateRequest
from app.models.validate_response import ValidateResponse

router = APIRouter(tags=["validate"])


def _fetch_enum_values(cursor, enum_name: str) -> list[str]:
    cursor.execute(
        """
        SELECT e.enumlabel
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = %s
        ORDER BY e.enumsortorder
        """,
        (enum_name,),
    )
    return [row[0] for row in cursor.fetchall()]


@router.post("/validate", response_model=ValidateResponse)
def validate_document(payload: ValidateRequest):
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not configured.")

    try:
        with psycopg2.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, COALESCE(NULLIF(target_lang, ''), 'en-US')
                    FROM documents
                    WHERE id = %s
                    """,
                    (payload.document_id,),
                )
                document_row = cursor.fetchone()

                if document_row is None:
                    raise HTTPException(status_code=404, detail="Document not found.")

                cursor.execute(
                    """
                    SELECT id, document_id, COALESCE(source_text, '')
                    FROM segments
                    WHERE document_id = %s
                    ORDER BY id
                    """,
                    (payload.document_id,),
                )
                segments = [
                    {"id": row[0], "document_id": row[1], "source_text": row[2]}
                    for row in cursor.fetchall()
                ]

                if not segments:
                    raise HTTPException(
                        status_code=404,
                        detail="No parsed segments were found for this document.",
                    )

                issue_type_values = _fetch_enum_values(cursor, "validation_issue_type")
                severity_values = _fetch_enum_values(cursor, "severity_level")
                language = normalize_language_code(payload.language or document_row[1])

                if payload.overwrite_existing:
                    cursor.execute(
                        "DELETE FROM validation_issues WHERE document_id = %s",
                        (payload.document_id,),
                    )

                rows, summary = build_validation_rows(
                    segments=segments,
                    document_id=payload.document_id,
                    language=language,
                    allowed_issue_types=issue_type_values,
                    allowed_severities=severity_values,
                    api_url=os.getenv("LANGUAGETOOL_URL"),
                    max_suggestions=payload.max_suggestions,
                )

                if rows:
                    execute_batch(
                        cursor,
                        """
                        INSERT INTO validation_issues (
                            segment_id,
                            document_id,
                            type,
                            severity,
                            message,
                            offset_start,
                            offset_end,
                            suggestion,
                            resolved_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                row["segment_id"],
                                row["document_id"],
                                row["type"],
                                row["severity"],
                                row["message"],
                                row["offset_start"],
                                row["offset_end"],
                                row["suggestion"],
                                row["resolved_by"],
                            )
                            for row in rows
                        ],
                        page_size=100,
                    )

            connection.commit()

        return ValidateResponse(success=True, document_id=payload.document_id, **summary)
    except HTTPException:
        raise
    except psycopg2.Error as error:
        raise HTTPException(status_code=500, detail=f"Database error: {error}") from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Validation failed: {error}") from error
