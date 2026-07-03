# NewsMind AI Service

FastAPI service that handles NewsMind AI orchestration.

## Responsibilities

- Semantic routing
- OCR routing for PDF/image clipping
- Summary generation
- Review generation
- Sentiment analysis
- Topic classification
- Caption generation
- Website news draft generation
- Embedding / semantic search support

## Setup

```bash
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API

- `GET /`
- `GET /api/v1/health`
- `POST /api/v1/pipeline/preview`

## Routing

Semantic router selects:

- Gemini Flash for lightweight text tasks
- NVIDIA Build for OCR and heavier reasoning
- OpenRouter as fallback
