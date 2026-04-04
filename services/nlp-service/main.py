from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env", override=True)

from app.routes.parse import router as parse_router  # noqa: E402

app = FastAPI(title="AI-4-Real NLP Service", version="1.0.0")
app.include_router(parse_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "nlp-service"}
