from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    document_id: int = Field(..., gt=0)
    s3_key: str = Field(..., min_length=1)
    target_lang: str = Field(..., min_length=2)
    org_id: str | None = None
    source_lang: str = "en-US"
    raw_bucket: str = "vaanisetu-raw"
    parsed_bucket: str = "vaanisetu-parsed"
    words_per_segment: int = Field(10, ge=1, le=200)
