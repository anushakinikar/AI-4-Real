from pydantic import BaseModel, Field


class ValidateResponse(BaseModel):
    success: bool
    document_id: int
    checked_segments: int
    issue_count: int
    inserted_count: int
    clean_segments: int = 0
    skipped_segments: int = 0
    failed_segments: int = 0
    issues_by_type: dict[str, int] = Field(default_factory=dict)
    issues_by_severity: dict[str, int] = Field(default_factory=dict)
