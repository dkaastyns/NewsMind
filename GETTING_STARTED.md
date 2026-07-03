# Getting Started

Panduan ini menjalankan v1 NewsMind untuk use case Humas DPRD berbasis AI.

## Prasyarat

- Bun
- Python dengan `uv`
- Laragon dengan PostgreSQL 16
- Redis lokal

## 1. Frontend

```bash
cd frontend
bun install
bun run dev
```

Buka `http://localhost:3000`.

## 2. Backend

```bash
cd backend
bun install
bun run db:migrate
bun run start:dev
```

Backend berjalan di `http://localhost:4000` dan menyediakan:

- `GET /api/v1`
- `GET /api/v1/health`

### Database Laragon

Gunakan database name `newsmind`:

```env
DATABASE_URL=postgresql://postgres@localhost:5432/newsmind
```

Jika username atau port PostgreSQL lokal kamu berbeda, sesuaikan connection
string tersebut.

### Catatan pgvector

Schema awal memakai extension `vector` untuk semantic search berita. Kalau
Laragon PostgreSQL kamu belum punya `pgvector`, aktifkan dulu extension itu
atau tunda bagian embedding sampai extension siap.

## 3. AI Service

```bash
cd ai-service
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

AI service berjalan di `http://localhost:8000` dan menyediakan:

- `GET /`
- `GET /api/v1/health`
- `POST /api/v1/pipeline/preview`

AI routing memakai `semantic-router` untuk memilih provider sesuai task:

- Gemini Flash untuk summary, classification, caption, dan draft ringan
- NVIDIA Build untuk OCR/vision dan reasoning berat
- OpenRouter sebagai fallback hemat biaya

## Environment

File env yang sudah dipakai:

- `frontend/.env`
- `backend/.env`
- `ai-service/.env`

## Urutan Menyalakan

1. Backend
2. AI service
3. Frontend
