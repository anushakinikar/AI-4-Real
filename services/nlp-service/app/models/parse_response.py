from pydantic import BaseModel


class ParseResponse(BaseModel):
    success: bool
    document_id: int
    parsed_s3_key: str
    segment_count: int
    word_count: int
    page_count: int
