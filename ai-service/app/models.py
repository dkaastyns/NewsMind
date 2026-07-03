from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PipelineTask = Literal[
    "web_scraping",
    "content_extraction",
    "ocr",
    "embedding",
    "summary",
    "review",
    "sentiment",
    "classification",
    "metadata",
    "generative_writing",
    "caption",
    "web_draft",
]


SourceType = Literal["url", "pdf", "image", "text"]


class RoutePreviewRequest(BaseModel):
    task: PipelineTask = Field(..., description="Pipeline task for semantic routing")
    query: str = Field(default="", description="Optional natural-language hint used by semantic router")
    text_length: int = Field(default=0, ge=0)
    has_image: bool = False
    has_pdf: bool = False
    source_type: SourceType = Field(default="text", description="url, pdf, image, or text")


class ArticleProcessingRequest(BaseModel):
    article_id: str = Field(..., description="Internal article id")
    source_type: SourceType = Field(default="text")
    source_url: str | None = None
    raw_text: str = ""
    extracted_text: str = ""
    title: str = ""
    text_length: int = 0
    has_image: bool = False
    has_pdf: bool = False


class ContentGenRequest(BaseModel):
    article_id: str = Field(..., description="Internal article id")
    type: Literal["social_caption", "website_draft"]
    platform: Literal["instagram", "twitter", "facebook", "website"]
    source_text: str
    title: str = ""


class SentimentResult(BaseModel):
    label: Literal["positive", "neutral", "negative"]
    score: float = Field(ge=0.0, le=1.0)


class EntityResult(BaseModel):
    pejabat: list[str] = Field(default_factory=list)
    instansi: list[str] = Field(default_factory=list)
    tanggal_kejadian: str = ""


class RoutePreviewResponse(BaseModel):
    task: str
    route: str
    provider: str
    model: str
    reason: str
    needs_manual_review: bool = False


class ArticleProcessingResponse(BaseModel):
    article_id: str
    summary: str
    review: str
    sentiment: SentimentResult
    topics: list[str]
    entities: EntityResult
    provider: str
    model: str
    confidence: float = Field(ge=0.0, le=1.0)
    needs_manual_review: bool = False
    created_at: datetime
    extraction_status: Literal["ok", "extraction_failed"] = "ok"


class ContentGenResponse(BaseModel):
    article_id: str
    type: Literal["social_caption", "website_draft"]
    platform: Literal["instagram", "twitter", "facebook", "website"]
    content: str
    provider: str
    model: str
    needs_manual_review: bool = True
    created_at: datetime


class ExtractionResult(BaseModel):
    content: str
    method: str
    status: Literal["ok", "extraction_failed"]
