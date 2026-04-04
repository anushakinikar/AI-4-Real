import argparse
import time
import requests
import psycopg2


# ── CONFIG ─────────────────────────────────────────────────────────────

DB_CONFIG = {
    "dbname": "vaanisetu",
    "user": "postgres",
    "password": "akinikar06",  # change this
    "host": "localhost",
    "port": "5432"
}

LT_API_URL       = "https://api.languagetool.org/v2/check"
RATE_LIMIT_DELAY = 3.1
MAX_CHARS        = 19000

CATEGORY_MAP = {
    "TYPOS":                        ("SPELLING",       "ERROR"),
    "MISSPELLING":                  ("SPELLING",       "ERROR"),
    "GRAMMAR":                      ("GRAMMAR",        "ERROR"),
    "AGREEMENT":                    ("GRAMMAR",        "ERROR"),
    "SUBJECT_VERB_AGREEMENT":       ("GRAMMAR",        "ERROR"),
    "VERB_FORM":                    ("GRAMMAR",        "ERROR"),
    "PUNCTUATION":                  ("PUNCTUATION",    "WARNING"),
    "TYPOGRAPHY":                   ("PUNCTUATION",    "WARNING"),
    "CONSISTENCY":                  ("CONSISTENCY",    "WARNING"),
    "STYLE":                        ("CONSISTENCY",    "INFO"),
    "CASING":                       ("CAPITALIZATION", "WARNING"),
}

# ── DB CONNECTION ──────────────────────────────────────────────────────

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

# ── LOAD SEGMENTS FROM DATABASE ────────────────────────────────────────

def load_segments_from_db(document_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, document_id, target_lang, source_text
        FROM segments
        WHERE document_id = %s;
    """, (document_id,))

    rows = cur.fetchall()

    columns = [desc[0] for desc in cur.description]

    segments = []
    for row in rows:
        seg = dict(zip(columns, row))

        # match old JSON format expected by validator
        segments.append({
            "id": f"seg_{seg['id']}",
            "document_id": seg["document_id"],
            "source_text": seg["source_text"],
            "is_translatable": True
        })

    cur.close()
    conn.close()

    return segments

# ── LANGUAGE TOOL ──────────────────────────────────────────────────────

def check_text(text: str, lang: str):
    if not text.strip():
        return []

    try:
        r = requests.post(
            LT_API_URL,
            data={"text": text[:MAX_CHARS], "language": lang},
            timeout=15
        )
        r.raise_for_status()
        return r.json().get("matches", [])
    except Exception as e:
        print(f"[warn] API error: {e}")
        return []

# ── VALIDATION ─────────────────────────────────────────────────────────

def validate(document_id, lang="en-US"):

    segments = load_segments_from_db(document_id)
    total = len(segments)

    print("\n" + "="*60)
    print("VaaniSetu Source Validation")
    print(f"Document ID : {document_id}")
    print(f"Segments    : {total}")
    print("="*60 + "\n")

    all_issues = []

    for i, seg in enumerate(segments):
        seg_id = seg["id"]
        text   = seg["source_text"]

        print(f"[{i+1}/{total}] {seg_id}: {text[:60]}")

        matches = check_text(text, lang)

        if not matches:
            print("   clean\n")
        else:
            for m in matches:
                message = m.get("message", "")
                offset  = m.get("offset", 0)
                length  = m.get("length", 0)

                wrong = text[offset: offset + length]

                print(f"   ERROR: {message}")
                print(f"   -> '{wrong}'\n")

                all_issues.append(seg_id)

        if i < total - 1:
            time.sleep(RATE_LIMIT_DELAY)

    print("\n" + "="*60)
    print(f"Total segments: {total}")
    print(f"Segments with issues: {len(set(all_issues))}")
    print("="*60)

# ── MAIN ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument("--document-id", type=int, required=True)
    parser.add_argument("--lang", default="en-US")

    args = parser.parse_args()

    validate(args.document_id, args.lang)