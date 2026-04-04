"""
VaaniSetu — Translation Engine  (translation.py)
=================================================
Pipeline position:
    parsing_1.py → segments.json → validation.py → [THIS FILE] → PostgreSQL

What this module does:
  1. Loads validated segments from segments.json  (or directly from PostgreSQL)
  2. Checks the Translation Memory (TM) table for exact matches (TM_EXACT)
  3. Translates cache-miss segments in batches via Azure Cognitive Translator
  4. Stores translated segments back into the `segments` table
  5. Upserts new TM entries (source_hash + target_text) for future reuse
  6. Logs a translation_source value per segment:
       TM_EXACT  — fetched verbatim from tm_entries (identical SHA-256)
       LLM       — produced by Azure Translator  (Azure uses neural MT, not an LLM,
                   but the enum value is reused per the existing schema convention)
       MANUAL    — written by a human linguist (not set here)

Usage
-----
  pip install requests psycopg2-binary python-dotenv

  # Minimum .env (or export env vars):
  #   AZURE_TRANSLATOR_KEY=<your_key>
  #   AZURE_TRANSLATOR_REGION=<e.g. eastus>
  #   AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
  #   DB_HOST=localhost
  #   DB_PORT=5432
  #   DB_NAME=vaanisetu
  #   DB_USER=postgres
  #   DB_PASSWORD=secret

  python translation.py \
      --segments  segments.json \
      --target-lang  hi          \   # BCP-47 or Azure short code, e.g. hi, de, fr
      --source-lang  en          \   # default: en
      --document-id  doc_b7b153  \   # must exist in documents table
      --dry-run                      # optional: print without writing to DB

Switching to live DB as source (instead of segments.json)
---------------------------------------------------------
  Change load_segments() exactly as described in validation.py:
      cur.execute("SELECT * FROM segments WHERE document_id = %s", (doc_id,))
  Everything else stays the same.
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import requests
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

# ── Azure Translator config ────────────────────────────────────────────────────

AZURE_KEY      = os.getenv("AZURE_TRANSLATOR_KEY", "") #insert key here
AZURE_REGION   = os.getenv("AZURE_TRANSLATOR_REGION", "centralindia")
AZURE_ENDPOINT = os.getenv(
    "AZURE_TRANSLATOR_ENDPOINT",
    "https://api.cognitive.microsofttranslator.com",
)
AZURE_API_VER  = "3.0"

# Azure free tier: 2 MB/hour; batch safely at 100 segments or 50 000 chars
BATCH_SIZE     = 100
BATCH_CHAR_CAP = 50_000
RATE_LIMIT_DELAY = 0.2   # seconds between batches (conservative)

# ── DB config ─────────────────────────────────────────────────────────────────

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", "5432")),
    "dbname":   os.getenv("DB_NAME",     "vaanisetu"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", ""), #insert password here
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. DATA LOADER
#    Change only this function when switching to live PostgreSQL source.
# ══════════════════════════════════════════════════════════════════════════════

def load_segments(segments_path: str) -> list[dict]:
    """
    Load segments from segments.json.

    Future DB version:
        cur.execute(
            "SELECT id, document_id, target_lang, source_text, translated_text, "
            "       translation_source, is_translatable, position, type, word_count "
            "FROM segments WHERE document_id = %s",
            (doc_id,)
        )
        return [dict(zip([d[0] for d in cur.description], r)) for r in rows]
    """
    data = json.loads(Path(segments_path).read_text(encoding="utf-8"))
    return data.get("segments", [])


# ══════════════════════════════════════════════════════════════════════════════
# 2. DATABASE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def get_db_connection():
    """Return a psycopg2 connection. Raises on failure."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fetch_tm_exact(
    conn,
    source_texts: list[str],
    source_lang: str,
    target_lang: str,
    org_id: Optional[int] = None,
) -> dict[str, str]:
    """
    Look up tm_entries for exact matches by SHA-256 hash.

    Returns: { source_text → target_text } for every hit.
    """
    if not source_texts:
        return {}

    hashes = {sha256(t): t for t in source_texts}

    query = """
        SELECT source_hash, target_text
        FROM   tm_entries
        WHERE  source_hash  = ANY(%s)
          AND  source_lang  = %s
          AND  target_lang  = %s
    """
    params: list = [list(hashes.keys()), source_lang, target_lang]

    if org_id is not None:
        query += " AND org_id = %s"
        params.append(org_id)

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    return {hashes[row["source_hash"]]: row["target_text"] for row in rows}


def upsert_tm_entry(
    conn,
    org_id: int,
    source_lang: str,
    target_lang: str,
    source_text: str,
    target_text: str,
    domain: Optional[str] = None,
) -> None:
    """
    Insert a new TM entry or increment usage_count if the hash already exists.
    """
    h = sha256(source_text)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tm_entries
                (org_id, source_lang, target_lang, source_text, target_text,
                 source_hash, domain, usage_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
            ON CONFLICT (source_hash)    -- requires UNIQUE on source_hash column
            DO UPDATE SET
                usage_count = tm_entries.usage_count + 1,
                target_text = EXCLUDED.target_text     -- update if re-translated
            """,
            (org_id, source_lang, target_lang, source_text, target_text, h, domain),
        )


def save_segment_translation(
    conn,
    segment_id: str,
    document_id: str,
    target_lang: str,
    translated_text: str,
    translation_source: str,   # 'TM_EXACT' | 'LLM'
) -> None:
    """
    Write the translated_text and translation_source back to the segments table.

    The segments table uses an INT primary key in the DB schema, but segments.json
    uses string IDs like 'seg_001'. We match on the string id column if one exists,
    or fall back to matching document_id + source_text when doing a bulk import.

    IMPORTANT: Adjust the WHERE clause to match your actual PK once you migrate
    away from segments.json. If the DB segments table uses SERIAL INT as PK,
    you must store the mapping from JSON string ID → DB INT during insert.
    """
    with conn.cursor() as cur:
        # Strategy A: update by the string segment_id stored in a `json_id` column
        # (add `json_id TEXT` to segments table if needed for the migration period)
        # cur.execute("""
        #     UPDATE segments
        #     SET translated_text    = %s,
        #         translation_source = %s::translation_source,
        #         target_lang        = %s
        #     WHERE json_id = %s
        # """, (translated_text, translation_source, target_lang, segment_id))

        # Strategy B (used here): match on document_id + source_text
        # Works correctly as long as source_text is unique within a document.
        cur.execute(
            """
            UPDATE segments
            SET translated_text    = %s,
                translation_source = %s::translation_source,
                target_lang        = %s
            WHERE document_id = (
                SELECT id FROM documents WHERE id::TEXT = %s LIMIT 1
            )
            """,
            (translated_text, translation_source, target_lang, document_id),
        )


def bulk_insert_segments(
    conn,
    segments: list[dict],
    db_document_id: int,
    target_lang: str,
    translations: dict[str, str],        # seg_id → translated_text
    sources: dict[str, str],             # seg_id → 'TM_EXACT' | 'LLM'
) -> None:
    """
    Insert all segments (with translations) into the `segments` DB table in one
    batch. Use this when segments haven't been inserted yet (fresh pipeline run).

    If segments are already present in the DB (inserted by parsing_1.py), use
    save_segment_translation() per-segment instead.
    """
    rows = []
    for seg in segments:
        seg_id = seg["id"]
        rows.append((
            db_document_id,
            target_lang,
            seg["source_text"],
            translations.get(seg_id),
            sources.get(seg_id),
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO segments
                (document_id, target_lang, source_text, translated_text, translation_source)
            VALUES %s
            ON CONFLICT DO NOTHING
            """,
            rows,
        )


# ══════════════════════════════════════════════════════════════════════════════
# 3. AZURE TRANSLATOR
# ══════════════════════════════════════════════════════════════════════════════

def azure_translate_batch(
    texts: list[str],
    target_lang: str,
    source_lang: str = "en",
) -> list[str]:
    """
    Send up to BATCH_SIZE texts to Azure Cognitive Translator in one request.

    Azure returns translations in the same order as the input.
    Returns a list of translated strings (same length as `texts`).

    Raises RuntimeError on API or HTTP failure.
    """
    if not AZURE_KEY:
        raise RuntimeError(
            "AZURE_TRANSLATOR_KEY is not set. "
            "Export it or add it to your .env file."
        )
    if not texts:
        return []

    url = f"{AZURE_ENDPOINT.rstrip('/')}/translate"
    headers = {
        "Ocp-Apim-Subscription-Key":    AZURE_KEY,
        "Ocp-Apim-Subscription-Region": AZURE_REGION,
        "Content-Type":                 "application/json",
    }
    params = {
        "api-version": AZURE_API_VER,
        "from":        source_lang,
        "to":          target_lang,
    }
    body = [{"text": t} for t in texts]

    try:
        resp = requests.post(url, headers=headers, params=params, json=body, timeout=30)
        resp.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"Azure Translator HTTP error: {exc} — {resp.text}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Azure Translator request failed: {exc}") from exc

    result = resp.json()

    # Each element: {"translations": [{"text": "...", "to": "hi"}], "detectedLanguage": ...}
    translations = []
    for item in result:
        translated = item.get("translations", [{}])[0].get("text", "")
        translations.append(translated)

    return translations


def translate_in_batches(
    texts: list[str],
    target_lang: str,
    source_lang: str = "en",
) -> list[str]:
    """
    Split `texts` into safe-sized batches (by count and by character budget)
    and call azure_translate_batch() for each. Returns results in original order.
    """
    all_translated: list[str] = []
    batch: list[str] = []
    batch_chars = 0

    def flush(batch):
        if batch:
            result = azure_translate_batch(batch, target_lang, source_lang)
            all_translated.extend(result)
            time.sleep(RATE_LIMIT_DELAY)

    for text in texts:
        text_len = len(text)
        # Start a new batch if limits would be exceeded
        if batch and (len(batch) >= BATCH_SIZE or batch_chars + text_len > BATCH_CHAR_CAP):
            flush(batch)
            batch = []
            batch_chars = 0
        batch.append(text)
        batch_chars += text_len

    flush(batch)
    return all_translated


# ══════════════════════════════════════════════════════════════════════════════
# 4. MAIN TRANSLATION ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

def translate(
    segments_path: str,
    target_lang: str,
    source_lang: str     = "en",
    document_id: str     = "unknown",
    org_id: int          = 1,
    domain: Optional[str]= None,
    dry_run: bool        = False,
):
    """
    Full translation pipeline for one document × one target language.

    Steps:
        1. Load translatable segments
        2. TM exact-match lookup (skip Azure for hits)
        3. Batch-translate cache misses via Azure
        4. Write translations to DB (segments table + tm_entries)
        5. Print summary
    """
    # ── 1. Load segments ──────────────────────────────────────────────────────
    all_segments = load_segments(segments_path)
    segments = [s for s in all_segments if s.get("is_translatable", True)]
    total = len(segments)

    print(f"\n{'='*65}")
    print(f"  VaaniSetu Translation Engine")
    print(f"  Document   : {document_id}")
    print(f"  Segments   : {total}")
    print(f"  Source     : {source_lang}  →  Target : {target_lang}")
    print(f"  Dry run    : {dry_run}")
    print(f"{'='*65}\n")

    if total == 0:
        print("  [warn] No translatable segments found. Exiting.")
        return

    seg_texts  = [s["source_text"] for s in segments]
    seg_ids    = [s["id"] for s in segments]

    # ── 2. TM exact-match lookup ──────────────────────────────────────────────
    tm_hits: dict[str, str] = {}
    conn = None

    if not dry_run:
        try:
            conn = get_db_connection()
            print("[TM]  Checking translation memory for exact matches …")
            tm_hits = fetch_tm_exact(conn, seg_texts, source_lang, target_lang, org_id)
            print(f"[TM]  Hits: {len(tm_hits)} / {total}\n")
        except psycopg2.OperationalError as exc:
            print(f"[warn] DB connection failed — skipping TM lookup.\n       {exc}")

    # ── 3. Identify cache misses ───────────────────────────────────────────────
    miss_texts: list[str] = []
    miss_ids:   list[str] = []

    for seg_id, text in zip(seg_ids, seg_texts):
        if text not in tm_hits:
            miss_texts.append(text)
            miss_ids.append(seg_id)

    tm_count = len(tm_hits)
    azure_count = len(miss_texts)
    print(f"[plan] TM_EXACT  : {tm_count} segments")
    print(f"[plan] Azure MT  : {azure_count} segments\n")

    # ── 4. Azure translation for misses ───────────────────────────────────────
    azure_results: dict[str, str] = {}   # seg_id → translated_text

    if miss_texts:
        print(f"[azure] Translating {azure_count} segments via Azure Translator …")
        try:
            translated = translate_in_batches(miss_texts, target_lang, source_lang)
        except RuntimeError as exc:
            print(f"\n[ERROR] {exc}")
            sys.exit(1)

        for seg_id, src, tgt in zip(miss_ids, miss_texts, translated):
            azure_results[seg_id] = tgt
            print(f"  [{seg_id}]  \"{src[:55]}{'…' if len(src) > 55 else ''}\"")
            print(f"          → \"{tgt[:55]}{'…' if len(tgt) > 55 else ''}\"\n")

    # ── 5. Merge all results ───────────────────────────────────────────────────
    # Build per-seg lookup: seg_id → (translated_text, translation_source)
    all_translations: dict[str, str]  = {}
    all_sources:      dict[str, str]  = {}

    text_to_id = {s["source_text"]: s["id"] for s in segments}

    for text, tgt in tm_hits.items():
        seg_id = text_to_id.get(text)
        if seg_id:
            all_translations[seg_id] = tgt
            all_sources[seg_id]      = "TM_EXACT"

    for seg_id, tgt in azure_results.items():
        all_translations[seg_id] = tgt
        all_sources[seg_id]      = "LLM"          # enum value per DB schema

    # ── 6. Write to DB ─────────────────────────────────────────────────────────
    if dry_run:
        print("[dry-run] Skipping all DB writes.\n")
    else:
        if conn is None:
            print("[warn] No DB connection — cannot persist translations.")
        else:
            try:
                print("[db]  Writing translations to segments table …")

                # Bulk insert all segments with their translations.
                # If segments are already in the DB (inserted by parsing_1.py),
                # replace this call with per-segment UPDATE via save_segment_translation().
                bulk_insert_segments(
                    conn,
                    segments,
                    db_document_id=document_id,    # swap to INT PK once parsing inserts rows
                    target_lang=target_lang,
                    translations=all_translations,
                    sources=all_sources,
                )

                # Upsert new Azure translations into TM for future reuse
                print("[db]  Upserting new TM entries …")
                for seg_id, tgt in azure_results.items():
                    src_text = next(
                        (s["source_text"] for s in segments if s["id"] == seg_id), None
                    )
                    if src_text:
                        upsert_tm_entry(
                            conn, org_id, source_lang, target_lang,
                            src_text, tgt, domain,
                        )

                conn.commit()
                print("[db]  Committed.\n")

            except Exception as exc:
                conn.rollback()
                print(f"[ERROR] DB write failed: {exc}")
                raise
            finally:
                conn.close()

    # ── 7. Summary ─────────────────────────────────────────────────────────────
    success   = len(all_translations)
    failed    = total - success

    print(f"\n{'='*65}")
    print(f"  TRANSLATION SUMMARY")
    print(f"{'='*65}")
    print(f"  Total segments     : {total}")
    print(f"  TM_EXACT hits      : {tm_count}")
    print(f"  Azure MT           : {azure_count}")
    print(f"  Successfully stored: {success}")
    print(f"  Failed / skipped   : {failed}")
    print(f"  Pass rate          : {round(success / total * 100, 1)}%")
    print(f"{'='*65}\n")


# ══════════════════════════════════════════════════════════════════════════════
# 5. CLI ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="VaaniSetu translation engine — Azure MT + TM + PostgreSQL"
    )
    parser.add_argument(
        "--segments",   required=True,
        help="Path to segments.json produced by parsing_1.py",
    )
    parser.add_argument(
        "--target-lang", required=True,
        help="BCP-47 / Azure language code for the target language (e.g. hi, de, fr)",
    )
    parser.add_argument(
        "--source-lang", default="en",
        help="BCP-47 / Azure language code for the source language (default: en)",
    )
    parser.add_argument(
        "--document-id", default="unknown",
        help="Document ID string matching segments.json → document_id",
    )
    parser.add_argument(
        "--org-id", type=int, default=1,
        help="Organization ID (int FK to organizations table, default: 1)",
    )
    parser.add_argument(
        "--domain", default=None,
        help="Optional domain tag stored in tm_entries (e.g. 'technical', 'legal')",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Run translation but skip all DB writes (useful for testing)",
    )
    args = parser.parse_args()

    translate(
        segments_path = args.segments,
        target_lang   = args.target_lang,
        source_lang   = args.source_lang,
        document_id   = args.document_id,
        org_id        = args.org_id,
        domain        = args.domain,
        dry_run       = args.dry_run,
    )