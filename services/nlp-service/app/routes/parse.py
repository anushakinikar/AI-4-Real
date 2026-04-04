import io
import json
import os
import tempfile
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch
from fastapi import APIRouter, HTTPException
from minio import Minio
from minio.error import InvalidResponseError, S3Error

from app.core.parsing import build_segment_rows, parse_docx
from app.models.parse_request import ParseRequest
from app.models.parse_response import ParseResponse

router = APIRouter(tags=["parse"])


def _build_minio_client(port: str | int | None = None) -> Minio:
    endpoint = os.getenv("MINIO_ENDPOINT", "127.0.0.1")
    configured_port = str(port or os.getenv("MINIO_API_PORT") or os.getenv("MINIO_PORT", "9000")).strip()
    secure = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    return Minio(
        f"{endpoint}:{configured_port}",
        access_key=os.getenv("MINIO_ACCESS_KEY", "vaanisetu"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "vaanisetu123"),
        secure=secure,
    )


def _minio_client() -> Minio:
    configured_port = str(os.getenv("MINIO_API_PORT") or os.getenv("MINIO_PORT", "9000")).strip()
    client = _build_minio_client(configured_port)

    try:
        client.list_buckets()
        return client
    except InvalidResponseError as error:
        if "S3 API Requests must be made to API port" not in str(error):
            raise

        fallback_port = "9000" if configured_port != "9000" else "9001"
        fallback_client = _build_minio_client(fallback_port)
        fallback_client.list_buckets()
        return fallback_client


def _ensure_bucket(client: Minio, bucket_name: str):
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)


@router.post("/parse", response_model=ParseResponse)
def parse_document(payload: ParseRequest):
    if Path(payload.s3_key).suffix.lower() != ".docx":
        raise HTTPException(status_code=400, detail="Only .docx documents are supported by the parser right now.")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not configured.")

    client = _minio_client()
    temp_path = None
    object_response = None

    try:
        object_response = client.get_object(payload.raw_bucket, payload.s3_key)
        file_bytes = object_response.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(payload.s3_key).suffix or ".docx") as temp_file:
            temp_file.write(file_bytes)
            temp_path = Path(temp_file.name)

        structure = parse_docx(
            input_path=temp_path,
            doc_id=str(payload.document_id),
            org_id=str(payload.org_id or "default-org"),
            words_per_segment=payload.words_per_segment,
            raw_key=payload.s3_key,
            source_lang=payload.source_lang,
        )

        segment_rows = build_segment_rows(structure, payload.document_id, payload.target_lang)
        structure_key = f"documents/{payload.document_id}/structure.json"
        structure_bytes = json.dumps(structure, indent=2, ensure_ascii=False).encode("utf-8")

        _ensure_bucket(client, payload.parsed_bucket)
        client.put_object(
            payload.parsed_bucket,
            structure_key,
            io.BytesIO(structure_bytes),
            length=len(structure_bytes),
            content_type="application/json",
        )

        with psycopg2.connect(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM segments WHERE document_id = %s", (payload.document_id,))
                if segment_rows:
                    execute_batch(
                        cursor,
                        """
                        INSERT INTO segments (
                            document_id,
                            target_lang,
                            source_text,
                            translated_text,
                            translation_source,
                            locked_by
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                row["document_id"],
                                row["target_lang"],
                                row["source_text"],
                                row["translated_text"],
                                row["translation_source"],
                                row["locked_by"],
                            )
                            for row in segment_rows
                        ],
                    )

                cursor.execute(
                    """
                    UPDATE documents
                    SET parsed_s3_key = %s,
                        status = 'PARSED'
                    WHERE id = %s
                    """,
                    (structure_key, payload.document_id),
                )
            connection.commit()

        return ParseResponse(
            success=True,
            document_id=payload.document_id,
            parsed_s3_key=f"{payload.parsed_bucket}/{structure_key}",
            segment_count=structure["segment_count"],
            word_count=structure["word_count"],
            page_count=structure["page_count"],
        )
    except S3Error as error:
        raise HTTPException(status_code=404, detail=f"MinIO object error: {error}") from error
    except psycopg2.Error as error:
        raise HTTPException(status_code=500, detail=f"Database error: {error}") from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {error}") from error
    finally:
        if object_response is not None:
            object_response.close()
            object_response.release_conn()
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)
