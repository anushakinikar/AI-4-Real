"""
END-TO-END BACK TRANSLATION QUALITY AGENT
- Input  : source_text (English) fetched from segments table
- Step 1 : Translate EN → DE via MyMemory
- Step 2 : Back-translate DE → EN via MyMemory
- Output : Scores + back_translated_text stored in agent_segment_evaluation
"""

import requests
import psycopg2
from rapidfuzz import fuzz
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# ===============================
# CONFIG
# ===============================
DB_CONFIG = {
    "dbname":   "vaanisetu",
    "user":     "postgres",
    "password": "akinikar06",   # ← change this
    "host":     "localhost",
    "port":     "5432"
}

ORG_ID = 101   # matches organizations.id in sample data

# MyMemory free API
# None  → 1,000 words/day  |  set email → 10,000 words/day
MYMEMORY_EMAIL = None        # e.g. "you@example.com"
MYMEMORY_URL   = "https://api.mymemory.translated.net/get"

# ===============================
# INIT
# ===============================
print("Connecting to PostgreSQL...")
conn   = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()

print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')

# ===============================
# MYMEMORY TRANSLATION
# ===============================
def mymemory_translate(text: str, source_lang: str, target_lang: str) -> str:
    """Call MyMemory REST API. Returns translated string or '' on failure."""
    if not text or not text.strip():
        return ""

    params = {"q": text, "langpair": f"{source_lang}|{target_lang}"}
    if MYMEMORY_EMAIL:
        params["de"] = MYMEMORY_EMAIL

    try:
        resp = requests.get(MYMEMORY_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("responseStatus") == 200:
            translated = data["responseData"]["translatedText"]
            # Decode HTML entities returned by MyMemory
            return (translated
                    .replace("&amp;",  "&")
                    .replace("&lt;",   "<")
                    .replace("&gt;",   ">")
                    .replace("&quot;", '"')
                    .replace("&#39;",  "'"))
        else:
            print(f"[MyMemory] Warning: status={data.get('responseStatus')} "
                  f"— {data.get('responseDetails')}")
            return ""

    except requests.exceptions.Timeout:
        print("[MyMemory] Error: request timed out.")
        return ""
    except requests.exceptions.RequestException as e:
        print(f"[MyMemory] Error: {e}")
        return ""


def translate_to_german(text: str) -> str:
    """EN → DE via MyMemory."""
    return mymemory_translate(text, source_lang="en", target_lang="de")


def back_translate_to_english(text: str) -> str:
    """DE → EN via MyMemory."""
    return mymemory_translate(text, source_lang="de", target_lang="en-gb")


# ===============================
# FETCH DATA FROM DB
# ===============================
def fetch_segments():
    """
    Fetch source_text from segments joined to documents and projects.

    Returns: list of tuples:
        (segment_id, source_text, document_id, project_id)

    Schema path:
        segments.document_id → documents.id → documents.project_id → projects.id
    """
    cursor.execute("""
        SELECT
            s.id            AS segment_id,
            s.source_text,
            s.document_id,
            d.project_id
        FROM segments s
        JOIN documents d ON s.document_id = d.id
        JOIN projects  p ON d.project_id  = p.id
        WHERE p.org_id = %s
          AND s.source_text IS NOT NULL
        ORDER BY s.id;
    """, (ORG_ID,))
    return cursor.fetchall()


def fetch_glossary():
    """
    Fetch approved glossary terms for this org (EN→DE).

    Returns: list of tuples: (source_term, target_term)
    """
    cursor.execute("""
        SELECT source_term, target_term
        FROM glossary_terms
        WHERE org_id     = %s
          AND source_lang = 'en'
          AND target_lang = 'de';
    """, (ORG_ID,))
    return cursor.fetchall()


def fetch_tm():
    """
    Fetch translation memory entries for this org (EN→DE).

    Returns: list of tuples: (source_text, target_text)
    """
    cursor.execute("""
        SELECT source_text, target_text
        FROM tm_entries
        WHERE org_id     = %s
          AND source_lang = 'en'
          AND target_lang = 'de';
    """, (ORG_ID,))
    return cursor.fetchall()


# ===============================
# SCORING FUNCTIONS
# ===============================
def compute_semantic_similarity(original: str, back_translated: str) -> float:
    emb1 = model.encode([original])
    emb2 = model.encode([back_translated])
    return float(cosine_similarity(emb1, emb2)[0][0])


def compute_glossary_score(original: str, german: str,
                           back: str, glossary: list) -> float:
    total, correct = 0, 0
    for eng, ger in glossary:
        if eng.lower() in original.lower():
            total += 1
            if ger.lower() in german.lower() and eng.lower() in back.lower():
                correct += 1
    return 1.0 if total == 0 else correct / total


def compute_tm_score(original: str, tm_entries: list) -> float:
    if not tm_entries:
        return 0.0
    best = max(fuzz.ratio(original, src) for src, _ in tm_entries)
    return best / 100.0


def compute_sqs(S: float, G: float, T: float) -> float:
    return 0.5 * S + 0.3 * G + 0.2 * T


def make_decision(sqs: float) -> str:
    if sqs >= 0.85:
        return "ACCEPT"
    elif sqs >= 0.70:
        return "REVIEW"
    elif sqs >= 0.50:
        return "RETRANSLATE"
    return "LINGUIST REVIEW"


# ===============================
# STORE RESULT IN DB
# ===============================
def insert_result(segment_id, document_id, project_id,
                  source_text, translated_text, back_translated_text,
                  S, G, T, sqs, decision):
    """
    Insert one evaluation row into agent_segment_evaluation.

    Columns written:
      segment_id, document_id, project_id   — FK references
      source_text                            — original English input
      translated_text                        — EN→DE (MyMemory)
      back_translated_text                   — DE→EN (MyMemory)  ← key output
      semantic_score, glossary_score, tm_score, final_sqs
      decision, needs_linguist_review
    """
    needs_review = decision in ["REVIEW", "LINGUIST REVIEW"]

    cursor.execute("""
        INSERT INTO agent_segment_evaluation (
            segment_id, document_id, project_id,
            source_text, translated_text, back_translated_text,
            source_lang, target_lang, domain,
            semantic_score, glossary_score, tm_score, final_sqs,
            decision, needs_linguist_review
        )
        VALUES (%s, %s, %s, %s, %s, %s,
                'en', 'de', 'general',
                %s, %s, %s, %s,
                %s, %s);
    """, (
        segment_id, document_id, project_id,
        source_text, translated_text, back_translated_text,
        float(S), float(G), float(T), float(sqs),
        decision, needs_review
    ))
    conn.commit()


# ===============================
# MAIN AGENT PIPELINE
# ===============================
def run_agent():
    segments   = fetch_segments()
    glossary   = fetch_glossary()
    tm_entries = fetch_tm()

    print(f"\nSegments loaded : {len(segments)}")
    print(f"Glossary terms  : {len(glossary)}")
    print(f"TM entries      : {len(tm_entries)}\n")

    for seg in segments:
        segment_id, source_text, document_id, project_id = seg

        print("=" * 55)
        print(f"Segment ID  : {segment_id}")
        print(f"Source (EN) : {source_text}")

        # Step 1: Translate EN → DE
        translated_text = translate_to_german(source_text)
        print(f"Translated  : {translated_text}")

        if not translated_text:
            print("⚠️  Translation failed — skipping.\n")
            continue

        # Step 2: Back-translate DE → EN
        back_translated_text = back_translate_to_english(translated_text)
        print(f"Back-transl : {back_translated_text}")

        if not back_translated_text:
            print("⚠️  Back-translation failed — skipping.\n")
            continue

        # Step 3: Compute scores
        S = compute_semantic_similarity(source_text, back_translated_text)
        G = compute_glossary_score(source_text, translated_text,
                                   back_translated_text, glossary)
        T = compute_tm_score(source_text, tm_entries)

        sqs      = compute_sqs(S, G, T)
        decision = make_decision(sqs)

        # Step 4: Store in agent_segment_evaluation
        insert_result(
            segment_id, document_id, project_id,
            source_text, translated_text, back_translated_text,
            S, G, T, sqs, decision
        )

        # Step 5: Print summary
        print(f"Semantic    : {round(S, 3)}")
        print(f"Glossary    : {round(G, 3)}")
        print(f"TM Score    : {round(T, 3)}")
        print(f"Final SQS   : {round(sqs, 3)}")
        print(f"Decision    : {decision}")

    print("\n" + "=" * 55)
    print("All segments processed and saved to agent_segment_evaluation.")
    print("=" * 55)


# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    run_agent()
    cursor.close()
    conn.close()