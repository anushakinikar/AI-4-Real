from pydantic import AliasChoices, BaseModel, Field


class ValidateRequest(BaseModel):
    document_id: int = Field(..., gt=0)
    language: str | None = Field(
        default="en-US",
        min_length=2,
        validation_alias=AliasChoices("language", "source_lang"),
    )
    max_suggestions: int = Field(3, ge=1, le=10)
    overwrite_existing: bool = True
