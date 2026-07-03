# NewsMind Refactoring Simplification — Bugfix Design

## Overview

Sistem NewsMind saat ini terlalu kompleks untuk demo dan tidak bisa berjalan di server
gratisan karena dependency Redis/BullMQ, SemanticRouter berat, approval workflow 2-level,
dan RBAC over-engineered dengan tabel permissions/role_permissions.

**Strategi fix:** Eliminasi semua lapisan kompleksitas yang tidak memberikan nilai untuk
demo, ganti dengan pipeline sinkron satu-tembakan menggunakan Gemini 2.5 Flash dengan
`response_mime_type: "application/json"`. Fix bersifat additive (tambah migration baru,
bukan edit migration lama) dan tidak menyentuh kolom yang sudah ada.

**Impact sebelum fix:** Crash saat Redis tidak tersedia, startup 10-30 detik karena
SemanticRouter init, approval workflow membingungkan tim magang, 9 dari 19 modul
NestJS tidak berguna untuk demo.

**Impact sesudah fix:** Startup < 3 detik, zero Redis dependency, 6 output AI dalam
1 HTTP request, 4 halaman frontend, 2 role hardcode.

---

## Glossary

- **Bug_Condition (C)**: Kondisi yang membuat sistem tidak bisa berjalan — ketergantungan
  pada Redis/BullMQ, SemanticRouter, approval workflow, dan RBAC kompleks yang tidak
  tersedia atau tidak diperlukan di lingkungan demo.
- **Property (P)**: Perilaku yang diharapkan — sistem bisa start dan memproses kliping
  berita dari input hingga tampil di arsip dalam satu HTTP request sinkron.
- **Preservation**: Perilaku yang harus tetap berjalan — autentikasi JWT, scraping URL,
  ekstraksi PDF, penyimpanan ke PostgreSQL, health endpoint.
- **isBugCondition**: Fungsi pseudocode yang mengidentifikasi input/state yang memicu bug.
- **Single-shot pipeline**: Satu panggilan Gemini 2.5 Flash menghasilkan semua 6 output AI.
- **news_clippings**: Tabel utama di PostgreSQL yang menyimpan kliping dan hasil analisis AI.
- **DPRD**: Dewan Perwakilan Rakyat Daerah — konteks lembaga pemerintahan pengguna sistem.

---

## Bug Details

### Bug Condition

Sistem crash atau tidak bisa berjalan secara penuh ketika dijalankan di environment
tanpa Redis, atau ketika tim magang mencoba memahami dan menjalankan alur kerja
approval 2-level + RBAC dinamis + async queue secara bersamaan.

**Formal Specification:**
```
FUNCTION isBugCondition(environment)
  INPUT: environment berupa konfigurasi runtime sistem
  OUTPUT: boolean

  RETURN (
    environment.REDIS_AVAILABLE == false
    OR environment.BULLMQ_RUNNING == false
    OR environment.SEMANTIC_ROUTER_LOADED == true  -- berat, tidak perlu
    OR environment.APPROVAL_WORKFLOW_ACTIVE == true  -- tidak perlu demo
    OR environment.PERMISSIONS_TABLE_JOINS == true   -- over-engineered
    OR environment.AI_PROVIDERS_COUNT > 1            -- hanya Gemini yang dikonfigurasi
  )
END FUNCTION
```

### Examples

**Contoh 1 — Redis tidak tersedia (paling sering terjadi di Render/Railway free tier):**
- Input: NestJS start tanpa Redis berjalan
- Actual: `Error: connect ECONNREFUSED 127.0.0.1:6379` → app crash
- Expected: App start normal, proses AI sinkron tanpa queue

**Contoh 2 — SemanticRouter lambat init:**
- Input: FastAPI `uvicorn app.main:app` di server dengan RAM terbatas
- Actual: Startup 10-30 detik karena `FastEmbedEncoder` download/load model embedding
- Expected: Startup < 3 detik, langsung siap terima request Gemini

**Contoh 3 — Artikel disubmit, tidak ada feedback:**
- Input: Frontend POST `/api/articles` dengan URL berita valid
- Actual: Backend kembalikan `{ status: "processing" }`, worker BullMQ proses
  di background — frontend tidak tahu kapan selesai, harus polling
- Expected: Backend kembalikan semua 6 hasil AI dalam response HTTP yang sama

**Contoh 4 — Approval workflow membingungkan:**
- Input: Hasil AI sudah muncul di DB, staf buka frontend untuk lihat hasilnya
- Actual: Status `pending_review`, perlu navigasi ke halaman Workflow → approve di Level 1
  → approve di Level 2 → baru status `approved`
- Expected: Status langsung `aktif`, langsung tampil di Arsip

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Login JWT (POST `/api/v1/auth/login`) harus tetap mengembalikan access token yang valid
- Role check `admin` vs `viewer` tetap berjalan — hanya cara implementasinya berubah
  (dari join ke `role_permissions` menjadi cek kolom `role` langsung di tabel `users`)
- Scraping URL via trafilatura/BeautifulSoup tetap berjalan sebelum dikirim ke Gemini
- Ekstraksi teks PDF via PyMuPDF/pdfplumber tetap berjalan
- Penyimpanan data ke tabel `news_clippings` di PostgreSQL tetap lengkap
- Health endpoint FastAPI (`GET /api/v1/health`) tetap mengembalikan status healthy
- Health endpoint NestJS tetap mengembalikan status healthy
- Kolom `embedding` di `news_clippings` tetap ada di skema (nullable, tidak dihapus),
  hanya tidak diisi aktif — tidak merusak kode yang sudah ada

**Scope:**
Semua input yang TIDAK melibatkan dependency Redis/BullMQ, SemanticRouter, approval
workflow, atau RBAC dinamis seharusnya sepenuhnya tidak terpengaruh oleh fix ini.
Termasuk:
- Login dan validasi token
- Web scraping dan PDF extraction
- Query PostgreSQL langsung
- Endpoint health check
- Tampilan statistik Dashboard (meskipun data dari DB yang disederhanakan)

---

## Architecture Diagram — Simplified 3-Service Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Next.js 15 Frontend (4 halaman)                                        │
│                                                                         │
│  /login      /dashboard     /form-input      /arsip                    │
│                                   │                                     │
│              fetch stats          │ POST /api/articles                  │
│              GET /api/dashboard   │ { url | pdf_text, title }           │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
                                   ▼  (Sinkron, satu request)
┌─────────────────────────────────────────────────────────────────────────┐
│  NestJS Backend                                                         │
│                                                                         │
│  Modul aktif: Auth, Users, Articles, Archive, Dashboard, AiProxy        │
│  Modul dihapus: QueueModule, WorkflowModule, ContentGenModule,          │
│                 NotificationsModule, IngestionModule, AnalysisModule     │
│                                                                         │
│  ArticlesController.create()                                            │
│       │                                                                 │
│       ├─ Simpan row awal ke news_clippings (status: 'processing')       │
│       ├─ POST http://ai-service:8000/api/v1/pipeline/analyze            │
│       │                                                                 │
│       └─ Terima JSON 6-output dari FastAPI                              │
│       └─ UPDATE news_clippings SET ai_* = ..., status = 'aktif'        │
│       └─ Return response lengkap ke frontend                            │
│                                                                         │
│  Tidak ada Redis. Tidak ada BullMQ. Tidak ada queue worker.             │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ POST /api/v1/pipeline/analyze
                            │ { source_type, url | text, title, article_id }
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FastAPI AI Service                                                     │
│                                                                         │
│  main.py → router pipeline.py → analyze()                              │
│       │                                                                 │
│       ├─ [url] trafilatura scrape → extracted_text                      │
│       ├─ [pdf] teks sudah dikirim dari NestJS                           │
│       │                                                                 │
│       └─ google.generativeai.GenerativeModel("gemini-2.5-flash")        │
│              .generate_content(system_prompt + extracted_text,          │
│               generation_config={ response_mime_type:                   │
│               "application/json", response_schema: OUTPUT_SCHEMA })     │
│                                                                         │
│  Return: JSON { ringkasan[], ulasan, sentimen, topik[], caption,        │
│                 draft_judul, draft_paragraf[] }                         │
│                                                                         │
│  Tidak ada SemanticRouter. Tidak ada NVIDIA. Tidak ada OpenRouter.      │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (news_clippings tabel tetap sama, kolom ai_* sudah ada)     │
│                                                                         │
│  Tabel di-DROP via migration baru:                                      │
│  - workflow_steps, workflow_approvals                                   │
│  - notifications                                                        │
│  - permissions, role_permissions                                        │
│                                                                         │
│  Kolom users.role_id → users.role (text, 'admin'|'viewer')             │
│  (via migration ALTER TABLE)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Hypothesized Root Cause

1. **BullMQ hard-dependency tanpa graceful fallback**: `QueueModule` di-import di
   `app.module.ts` dan mencoba connect ke Redis saat startup. Tidak ada `optional: true`
   atau fallback — jika Redis tidak tersedia, NestJS crash sebelum mendengarkan port.
   File: `backend/src/common/queue/bullmq.module.ts`

2. **SemanticRouter inisialisasi model embedding saat import**: `semantic_router.py`
   membuat `FastEmbedEncoder` saat modul di-import. Pada server gratis dengan RAM
   terbatas, proses ini gagal atau sangat lambat. Tidak ada lazy loading.
   File: `ai-service/app/services/semantic_router.py`

3. **Pipeline terpecah menjadi banyak panggilan AI terpisah**: `response_formatter.py`
   memanggil Gemini untuk summary saja, `intent_classifier.py` untuk sentimen/topik
   secara terpisah. Seharusnya satu system prompt yang menghasilkan semua output sekaligus.
   Files: `ai-service/app/services/response_formatter.py`, `intent_classifier.py`

4. **RBAC join ke tabel permissions yang kosong untuk MVP**: Guard `roles.guard.ts`
   melakukan join ke `roles → role_permissions → permissions` untuk cek akses.
   Untuk 2 role sederhana (admin/viewer), ini tidak perlu — cek langsung kolom role.
   File: `backend/src/common/guards/roles.guard.ts`

5. **Approval workflow sebagai required flow bukan opsional**: Status `news_clippings`
   tidak bisa langsung jadi `aktif` karena business logic di service menunggu approval
   workflow selesai. Untuk demo, semua konten harus langsung aktif.

6. **Modul tidak-relevan menambah beban startup NestJS**: `WorkflowModule`,
   `ContentGenModule`, `NotificationsModule`, `IngestionModule`, `AnalysisModule`
   di-load semua di `app.module.ts` meskipun tidak digunakan untuk flow demo.

---

## Correctness Properties

Property 1: Bug Condition — Single-Shot AI Pipeline Berjalan Sinkron

_For any_ request submit kliping (URL atau PDF text) di mana `isBugCondition(environment)`
bernilai true (Redis tidak ada, SemanticRouter tidak dimuat, approval workflow dinonaktifkan),
sistem yang sudah difix SHALL memproses kliping secara sinkron menggunakan Gemini 2.5 Flash
dan mengembalikan response HTTP berisi 6 output AI (`ringkasan[]`, `ulasan`, `sentimen`,
`topik[]`, `caption`, `draft_berita`), dengan status `aktif` tersimpan di `news_clippings`,
dalam satu HTTP request tanpa error.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.7, 2.8, 2.9**

Property 2: Preservation — Auth, Scraping, dan DB Write Tetap Berjalan

_For any_ request yang TIDAK melibatkan dependency Redis/BullMQ, SemanticRouter, atau
approval workflow (yaitu: login, validasi token, scraping URL, ekstraksi PDF, health check,
query statistik), sistem yang sudah difix SHALL menghasilkan behavior yang identik dengan
sistem original — JWT valid dikembalikan, teks terekstrak dari URL/PDF, data tersimpan di
PostgreSQL dengan parameterized query, health endpoint mengembalikan 200 OK.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11**

---

## Fix Implementation

### 1. FastAPI — `ai-service/app/routers/pipeline.py` (Ganti Total)

File baru `pipeline.py` dengan satu endpoint `/analyze` yang memanggil Gemini 2.5 Flash
menggunakan native SDK `google-generativeai` dengan `response_mime_type: "application/json"`.

**Hapus file services yang tidak dipakai:**
- `semantic_router.py` — SemanticRouter berat
- `model_selector.py` — pemilihan provider tidak perlu
- `fallback_handler.py` — tidak ada fallback chain
- `cost_optimizer.py` — tidak relevan untuk demo
- `intent_classifier.py` — digantikan oleh Gemini langsung
- `provider_manager.py` — hanya Gemini yang dipakai
- `response_formatter.py` — format sekarang dari Gemini JSON schema

**Tambah dependency di `pyproject.toml`:**
```
google-generativeai>=0.8.0
```

**Kode `app/routers/pipeline.py` baru (implementasi nyata):**

```python
"""
pipeline.py — Simplified single-shot AI pipeline using Gemini 2.5 Flash.
Replaces the old multi-provider semantic router approach.
"""
from __future__ import annotations

import os
import logging
from typing import Literal

import google.generativeai as genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# ── Gemini setup ─────────────────────────────────────────────────────────── #
_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if _API_KEY:
    genai.configure(api_key=_API_KEY)

_MODEL_NAME = "gemini-2.5-flash"

_TOPIK_LIST = [
    "Legislasi & Perda", "Anggaran & APBD", "Infrastruktur",
    "Pendidikan", "Kesehatan", "Sosial & Kemasyarakatan",
    "Lingkungan Hidup", "Ekonomi & Investasi", "Keamanan & Ketertiban",
    "Kepegawaian & Birokrasi",
]

_SYSTEM_PROMPT = f"""
Kamu adalah analis media profesional untuk Humas DPRD. Tugas kamu adalah menganalisis
teks berita dan menghasilkan 6 output sekaligus dalam format JSON yang sudah ditentukan.

Konteks: Berita yang kamu analisis berkaitan dengan kegiatan dan kebijakan DPRD serta
pemerintah daerah. Gunakan Bahasa Indonesia yang formal dan profesional.

ATURAN WAJIB:
1. ringkasan: array TEPAT 3 string, masing-masing satu poin 5W+1H (What, Who, When,
   Where, Why/How). Setiap poin maksimal 2 kalimat.
2. ulasan: 1 paragraf (3-5 kalimat) analisis dampak terhadap citra dan reputasi lembaga
   DPRD. Objektif, berbasis fakta dari berita.
3. sentimen: HANYA salah satu dari: "Positif", "Netral", "Negatif"
4. topik: array 1-2 topik dari daftar berikut SAJA (jangan buat topik baru):
   {", ".join(_TOPIK_LIST)}
5. caption_instagram: 1 teks caption siap posting (150-220 karakter) + 5-7 hashtag
   relevan. Format: teks caption\\n\\n#hashtag1 #hashtag2 ...
6. draft_berita: object dengan "judul" (maks 12 kata, informatif) dan "paragraf" (array
   TEPAT 3 string, masing-masing 1 paragraf formal gaya berita pemerintah, 80-120 kata
   per paragraf). Paragraf 1: lead (siapa melakukan apa), Paragraf 2: detail & kutipan,
   Paragraf 3: konteks & penutup.

Jika teks berita terlalu pendek atau tidak jelas, tetap isi semua field dengan estimasi
terbaik berdasarkan konteks yang tersedia.
""".strip()

_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "ringkasan": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 3,
            "maxItems": 3,
        },
        "ulasan": {"type": "string"},
        "sentimen": {"type": "string", "enum": ["Positif", "Netral", "Negatif"]},
        "topik": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 2,
        },
        "caption_instagram": {"type": "string"},
        "draft_berita": {
            "type": "object",
            "properties": {
                "judul": {"type": "string"},
                "paragraf": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            "required": ["judul", "paragraf"],
        },
    },
    "required": ["ringkasan", "ulasan", "sentimen", "topik",
                 "caption_instagram", "draft_berita"],
}


# ── Request / Response models ─────────────────────────────────────────────── #
class AnalyzeRequest(BaseModel):
    article_id: str
    source_type: Literal["url", "pdf", "text"] = "text"
    source_url: str | None = None
    extracted_text: str = ""
    title: str = ""


class DraftBerita(BaseModel):
    judul: str
    paragraf: list[str]


class AnalyzeResponse(BaseModel):
    article_id: str
    ringkasan: list[str]
    ulasan: str
    sentimen: Literal["Positif", "Netral", "Negatif"]
    topik: list[str]
    caption_instagram: str
    draft_berita: DraftBerita
    model: str = _MODEL_NAME


# ── Helpers ───────────────────────────────────────────────────────────────── #
def _scrape_url(url: str) -> str:
    """Extract article text from URL using trafilatura with BeautifulSoup fallback."""
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(downloaded, include_comments=False,
                                       include_tables=False)
            if text and len(text.strip()) > 100:
                return text.strip()
    except Exception as exc:
        logger.warning("trafilatura failed for %s: %s", url, exc)

    # BS4 fallback
    try:
        import httpx
        from bs4 import BeautifulSoup
        resp = httpx.get(url, timeout=15, follow_redirects=True,
                         headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()
        return " ".join(soup.get_text(" ", strip=True).split())[:10_000]
    except Exception as exc:
        logger.error("BS4 fallback also failed for %s: %s", url, exc)
        return ""


def _call_gemini(article_text: str) -> dict:
    """Call Gemini 2.5 Flash with structured JSON output."""
    if not _API_KEY:
        raise HTTPException(status_code=503,
                            detail="GEMINI_API_KEY belum dikonfigurasi")

    model = genai.GenerativeModel(
        model_name=_MODEL_NAME,
        system_instruction=_SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=2048,
            response_mime_type="application/json",
            response_schema=_OUTPUT_SCHEMA,
        ),
    )

    truncated = article_text[:12_000]
    prompt = f"Analisis berita berikut dan hasilkan 6 output sesuai instruksi:\\n\\n{truncated}"

    try:
        response = model.generate_content(prompt)
        import json
        return json.loads(response.text)
    except Exception as exc:
        logger.error("Gemini call failed: %s", exc)
        raise HTTPException(status_code=502,
                            detail=f"Gagal memanggil Gemini: {exc}") from exc


# ── Endpoint ──────────────────────────────────────────────────────────────── #
@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_article(payload: AnalyzeRequest) -> AnalyzeResponse:
    """
    Single-shot analysis: scrape (if URL) → Gemini 2.5 Flash → return 6 outputs.
    Synchronous by design — no queue, no worker needed.
    """
    # 1. Resolve article text
    if payload.source_type == "url" and payload.source_url:
        article_text = _scrape_url(payload.source_url)
        if not article_text:
            raise HTTPException(status_code=422,
                                detail="Gagal mengekstrak teks dari URL yang diberikan")
    elif payload.extracted_text:
        article_text = payload.extracted_text
    else:
        raise HTTPException(status_code=422,
                            detail="Harus menyediakan source_url atau extracted_text")

    # 2. Call Gemini (single shot, all 6 outputs)
    result = _call_gemini(article_text)

    # 3. Return structured response
    return AnalyzeResponse(
        article_id=payload.article_id,
        ringkasan=result["ringkasan"],
        ulasan=result["ulasan"],
        sentimen=result["sentimen"],
        topik=result["topik"],
        caption_instagram=result["caption_instagram"],
        draft_berita=DraftBerita(**result["draft_berita"]),
    )
```

### 2. FastAPI — `app/main.py` (Bersihkan Import)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers.health import router as health_router
from app.routers.pipeline import router as pipeline_router  # hanya ini

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import APIRouter
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(pipeline_router)
app.include_router(api_router)

@app.get("/")
def root():
    return {"name": settings.app_name, "status": "ready", "version": "2.0.0-simplified"}
```

**File yang DIHAPUS dari `ai-service/app/services/`:**
- `semantic_router.py`
- `model_selector.py`
- `fallback_handler.py`
- `cost_optimizer.py`
- `intent_classifier.py`
- `provider_manager.py`
- `response_formatter.py`

**File yang DIPERTAHANKAN:**
- `gemini_service.py` — dipertahankan tapi tidak dipakai oleh pipeline baru
  (masih dipakai endpoint `/pipeline/chat` yang tidak diubah)

---

### 3. NestJS Backend — Modul Dibuang vs Dipertahankan

**`app.module.ts` baru:**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';

// DIHAPUS dari imports:
// - QueueModule (BullMQ/Redis)
// - StorageModule (tidak dipakai untuk URL-only demo)
// - AuditModule (simplifikasi)
// - IngestionModule (digabung ke ArticlesModule)
// - AnalysisModule (digabung ke ArticlesModule via AiProxy)
// - ContentGenModule (tidak dipakai)
// - WorkflowModule (tidak dipakai)
// - NotificationsModule (tidak dipakai)

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    ArchiveModule,
    DashboardModule,
    AiProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 4. NestJS — `articles.service.ts` (Implementasi Nyata)

```typescript
// backend/src/modules/articles/articles.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Pool } from 'pg';
import { InjectDatabasePool } from '../../common/database/database.constants';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import { CreateArticleDto } from './dto/create-article.dto';

export interface ArticleResult {
  id: string;
  title: string;
  status: string;
  ai_summary: string;
  ai_review: string;
  ai_sentiment: string;
  ai_topic: string;
  ai_caption_social: string;
  ai_caption_web: string;
  created_at: Date;
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectDatabasePool() private readonly pool: Pool,
    private readonly aiProxy: AiProxyService,
  ) {}

  async create(dto: CreateArticleDto, userId: string): Promise<ArticleResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert initial row (status: processing)
      const slug = this._generateSlug(dto.title);
      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO news_clippings
           (title, slug, source_url, raw_text, status, created_by)
         VALUES ($1, $2, $3, $4, 'processing', $5)
         RETURNING id`,
        [dto.title, slug, dto.source_url ?? null, dto.extracted_text ?? null, userId],
      );
      const articleId = insertRes.rows[0].id;

      await client.query('COMMIT');

      // 2. Call AI service synchronously (outside transaction, may take 5-15s)
      const aiResult = await this.aiProxy.analyze({
        article_id: articleId,
        source_type: dto.source_type,
        source_url: dto.source_url,
        extracted_text: dto.extracted_text ?? '',
        title: dto.title,
      });

      // 3. Update row with AI results, set status to 'aktif'
      await this.pool.query(
        `UPDATE news_clippings SET
           ai_summary        = $1,
           ai_review         = $2,
           ai_sentiment      = $3,
           ai_topic          = $4,
           ai_caption_social = $5,
           ai_caption_web    = $6,
           status            = 'aktif',
           updated_at        = now()
         WHERE id = $7`,
        [
          JSON.stringify(aiResult.ringkasan),    // ai_summary: JSON array 3 poin
          aiResult.ulasan,                        // ai_review
          aiResult.sentimen,                      // ai_sentiment
          aiResult.topik.join(', '),              // ai_topic
          aiResult.caption_instagram,             // ai_caption_social
          JSON.stringify(aiResult.draft_berita),  // ai_caption_web: JSON {judul, paragraf}
          articleId,
        ],
      );

      // 4. Return complete result
      const finalRes = await this.pool.query<ArticleResult>(
        `SELECT id, title, status, ai_summary, ai_review, ai_sentiment,
                ai_topic, ai_caption_social, ai_caption_web, created_at
         FROM news_clippings WHERE id = $1`,
        [articleId],
      );
      return finalRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Gagal memproses artikel: ${(err as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  async findAll(page = 1, limit = 20): Promise<ArticleResult[]> {
    const offset = (page - 1) * limit;
    const { rows } = await this.pool.query<ArticleResult>(
      `SELECT id, title, status, ai_summary, ai_review, ai_sentiment,
              ai_topic, ai_caption_social, ai_caption_web, created_at
       FROM news_clippings
       WHERE status = 'aktif'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async findOne(id: string): Promise<ArticleResult | null> {
    const { rows } = await this.pool.query<ArticleResult>(
      `SELECT id, title, source_url, status, raw_text,
              ai_summary, ai_review, ai_sentiment, ai_topic,
              ai_caption_social, ai_caption_web, created_at
       FROM news_clippings WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  private _generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80) + '-' + Date.now();
  }
}
```

**`articles.controller.ts`:**

```typescript
// backend/src/modules/articles/articles.controller.ts
import { Controller, Post, Get, Param, Body, Query,
         UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() dto: CreateArticleDto, @Request() req: any) {
    return this.articlesService.create(dto, req.user.sub);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.articlesService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }
}
```

**`dto/create-article.dto.ts`:**

```typescript
import { IsString, IsOptional, IsUrl, IsEnum, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsEnum(['url', 'pdf', 'text'])
  source_type: 'url' | 'pdf' | 'text';

  @IsOptional()
  @IsUrl()
  source_url?: string;

  @IsOptional()
  @IsString()
  extracted_text?: string;
}
```

### 5. NestJS — `ai-proxy.service.ts` (Update untuk Endpoint Baru)

```typescript
// backend/src/modules/ai-proxy/ai-proxy.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface AnalyzeRequest {
  article_id: string;
  source_type: 'url' | 'pdf' | 'text';
  source_url?: string;
  extracted_text?: string;
  title?: string;
}

export interface DraftBerita {
  judul: string;
  paragraf: string[];
}

export interface AnalyzeResult {
  article_id: string;
  ringkasan: string[];
  ulasan: string;
  sentimen: 'Positif' | 'Netral' | 'Negatif';
  topik: string[];
  caption_instagram: string;
  draft_berita: DraftBerita;
  model: string;
}

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async analyze(payload: AnalyzeRequest): Promise<AnalyzeResult> {
    try {
      const { data } = await axios.post<AnalyzeResult>(
        `${this.baseUrl}/api/v1/pipeline/analyze`,
        payload,
        { timeout: 60_000 },  // 60s — Gemini bisa agak lambat
      );
      return data;
    } catch (err: any) {
      this.logger.error('AI Service analyze failed', err?.response?.data ?? err?.message);
      throw new HttpException(
        err?.response?.data?.detail ?? 'AI Service tidak tersedia',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
```

---

### 6. Database Migration Baru — Drop Tabel & Simplifikasi Users

**File: `backend/migrations/<timestamp>_simplify-for-demo.js`**

```javascript
// Jalankan: bun run migrate up
// CATATAN: Migration ini hanya bisa di-run di DB development yang fresh atau
// di mana tabel workflow/notifications/permissions belum terisi data penting.

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Drop tabel yang tidak dipakai untuk demo (cascade FK)
  pgm.dropTable('workflow_approvals', { ifExists: true, cascade: true });
  pgm.dropTable('workflow_steps',     { ifExists: true, cascade: true });
  pgm.dropTable('notifications',      { ifExists: true, cascade: true });
  pgm.dropTable('role_permissions',   { ifExists: true, cascade: true });
  pgm.dropTable('permissions',        { ifExists: true, cascade: true });

  // 2. Tambah kolom 'role' text langsung ke users (hardcode 'admin'|'viewer')
  pgm.addColumn('users', {
    role: {
      type: 'text',
      notNull: true,
      default: 'viewer',
      check: "role IN ('admin', 'viewer')",
    },
  });

  // 3. Migrate data: salin nama role dari tabel roles ke kolom baru
  //    (admin role_id → 'admin', lainnya → 'viewer')
  pgm.sql(`
    UPDATE users u
    SET role = CASE
      WHEN r.code = 'admin' THEN 'admin'
      ELSE 'viewer'
    END
    FROM roles r
    WHERE u.role_id = r.id
  `);

  // 4. Drop FK constraint role_id dari users, lalu hapus tabel roles
  pgm.alterColumn('users', 'role_id', { notNull: false });
  pgm.dropConstraint('users', 'users_role_id_fkey', { ifExists: true });
  pgm.dropTable('roles', { ifExists: true, cascade: true });
};

exports.down = (pgm) => {
  // Re-create tables (minimal, tanpa data)
  pgm.createTable('roles', {
    id:   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('permissions', {
    id:   { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('role_permissions', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    role_id:       { type: 'uuid', notNull: true, references: 'roles', onDelete: 'cascade' },
    permission_id: { type: 'uuid', notNull: true, references: 'permissions', onDelete: 'cascade' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createTable('notifications', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id:    { type: 'uuid', references: 'users', onDelete: 'cascade' },
    channel:    { type: 'text', notNull: true, default: 'in_app' },
    title:      { type: 'text', notNull: true },
    message:    { type: 'text', notNull: true },
    status:     { type: 'text', notNull: true, default: 'unread' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.dropColumn('users', 'role');
};
```

### 7. NestJS — Update RolesGuard untuk 2-Role Hardcode

```typescript
// backend/src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY, [context.getHandler(), context.getClass()]
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    // user.role sekarang langsung string 'admin' | 'viewer' dari JWT payload
    return requiredRoles.includes(user?.role);
  }
}
```

**Update `AuthService` untuk sertakan `role` di JWT payload:**
```typescript
// Saat generate token, sertakan role dari kolom users.role (bukan join ke roles)
const payload = { sub: user.id, email: user.email, role: user.role };
```

---

### 8. Database Schema Akhir (Tabel Aktif)

```
news_clippings          ← Tabel utama, semua field ai_* sudah ada, TIDAK diubah
news_clipping_topics    ← Tetap ada (opsional, tidak aktif diisi untuk demo)
news_topics             ← Tetap ada (opsional)
news_sources            ← Tetap ada
news_archives           ← Tetap ada (arsip)
embeddings              ← Tetap ada, kolom embedding nullable — tidak aktif diisi
departments             ← Tetap ada
users                   ← DIUBAH: tambah kolom role text, drop FK role_id ke roles
audit_logs              ← Tetap ada (opsional, bisa nonaktifkan interceptor)
pgmigrations            ← Milik node-pg-migrate, jangan disentuh

DIHAPUS:
roles                   ← Drop (digantikan users.role hardcode)
permissions             ← Drop
role_permissions        ← Drop
workflow_steps          ← Drop
workflow_approvals      ← Drop
notifications           ← Drop
```

**Schema `news_clippings` final (tidak ada perubahan kolom, hanya status values):**
```sql
id                uuid PK
source_id         uuid FK → news_sources (nullable)
title             text NOT NULL
slug              text UNIQUE
source_url        text
published_at      timestamptz
clipped_at        timestamptz
file_url          text
file_key          text
storage_provider  text DEFAULT 'local'
raw_text          text
ai_summary        text  -- JSON string: ["poin1","poin2","poin3"]
ai_review         text  -- paragraf ulasan citra lembaga
ai_sentiment      text  -- 'Positif'|'Netral'|'Negatif'
ai_topic          text  -- string gabungan topik: "Legislasi & Perda, Infrastruktur"
ai_caption_social text  -- caption Instagram + hashtag
ai_caption_web    text  -- JSON string: {"judul":"...","paragraf":["...","...","..."]}
status            text DEFAULT 'processing'  -- 'processing'|'aktif'|'gagal'
metadata          jsonb DEFAULT '{}'
created_by        uuid FK → users (nullable)
created_at        timestamptz
updated_at        timestamptz
```

---

### 9. Next.js — Struktur 4 Halaman

```
frontend/src/app/
├── (auth)/
│   └── login/
│       └── page.tsx              ← Form login sederhana
├── (dashboard)/
│   ├── layout.tsx                ← Sidebar dengan 3 link: Dashboard, Input, Arsip
│   ├── dashboard/
│   │   └── page.tsx              ← Statistik: total kliping, sentimen chart, topik teratas
│   ├── input/
│   │   └── page.tsx              ← Form input URL atau paste teks + tombol Proses AI
│   └── arsip/
│       └── page.tsx              ← Tabel arsip + komponen detail dengan 4 tab
```

**Komponen kritis — `ArticleDetailTabs.tsx`:**

```tsx
// frontend/src/components/articles/ArticleDetailTabs.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DraftBerita {
  judul: string;
  paragraf: string[];
}

interface ArticleDetail {
  id: string;
  title: string;
  ai_summary: string;      // JSON string: ["poin1","poin2","poin3"]
  ai_review: string;
  ai_sentiment: 'Positif' | 'Netral' | 'Negatif';
  ai_topic: string;        // "Legislasi & Perda, Infrastruktur"
  ai_caption_social: string;
  ai_caption_web: string;  // JSON string: {judul, paragraf[]}
}

const SENTIMENT_COLOR: Record<string, string> = {
  Positif: 'bg-green-100 text-green-800',
  Netral:  'bg-gray-100 text-gray-800',
  Negatif: 'bg-red-100 text-red-800',
};

export function ArticleDetailTabs({ article }: { article: ArticleDetail }) {
  const ringkasan: string[] = (() => {
    try { return JSON.parse(article.ai_summary); } catch { return [article.ai_summary]; }
  })();

  const draftBerita: DraftBerita = (() => {
    try { return JSON.parse(article.ai_caption_web); }
    catch { return { judul: '', paragraf: [article.ai_caption_web] }; }
  })();

  const topik = article.ai_topic?.split(', ').filter(Boolean) ?? [];

  return (
    <Tabs defaultValue="ringkasan" className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="ulasan">Ulasan & Sentimen</TabsTrigger>
        <TabsTrigger value="caption">Caption Instagram</TabsTrigger>
        <TabsTrigger value="draft">Draft Berita</TabsTrigger>
      </TabsList>

      {/* Tab 1: Ringkasan 5W+1H */}
      <TabsContent value="ringkasan">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ringkasan 5W+1H</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3">
              {ringkasan.map((poin, i) => (
                <li key={i} className="text-sm leading-relaxed text-gray-700">{poin}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Ulasan & Sentimen */}
      <TabsContent value="ulasan">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              Ulasan Dampak Citra
              <Badge className={SENTIMENT_COLOR[article.ai_sentiment] ?? ''}>
                {article.ai_sentiment}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-700">{article.ai_review}</p>
            <div className="flex flex-wrap gap-2">
              {topik.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 3: Caption Instagram */}
      <TabsContent value="caption">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Caption Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed
                            bg-gray-50 rounded-lg p-4 border">
              {article.ai_caption_social}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(article.ai_caption_social)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Salin ke clipboard
            </button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 4: Draft Berita Website */}
      <TabsContent value="draft">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draft Berita Website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-semibold text-gray-900 text-base leading-snug">
              {draftBerita.judul}
            </h3>
            {draftBerita.paragraf.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-gray-700">{p}</p>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
```

**Halaman Form Input — `app/(dashboard)/input/page.tsx`:**

```tsx
// frontend/src/app/(dashboard)/input/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export default function InputPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // URL tab state
  const [urlTitle, setUrlTitle] = useState('');
  const [url, setUrl] = useState('');

  // Text tab state
  const [textTitle, setTextTitle] = useState('');
  const [text, setText] = useState('');

  async function handleSubmit(payload: object) {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Gagal memproses');
      }
      const data = await res.json();
      router.push(`/arsip?highlight=${data.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Input Kliping Berita</h1>

      <Tabs defaultValue="url">
        <TabsList className="mb-4">
          <TabsTrigger value="url">Link Berita</TabsTrigger>
          <TabsTrigger value="text">Paste Teks</TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <Card>
            <CardHeader><CardTitle className="text-base">Input via URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Judul berita (opsional)"
                     value={urlTitle} onChange={e => setUrlTitle(e.target.value)} />
              <Input placeholder="https://example.com/berita/..."
                     value={url} onChange={e => setUrl(e.target.value)} />
              <Button
                onClick={() => handleSubmit({
                  title: urlTitle || url,
                  source_type: 'url',
                  source_url: url,
                })}
                disabled={loading || !url}
                className="w-full"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses AI... (5-15 detik)</> : 'Proses dengan AI'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          <Card>
            <CardHeader><CardTitle className="text-base">Input Teks / PDF</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Judul berita"
                     value={textTitle} onChange={e => setTextTitle(e.target.value)} />
              <Textarea placeholder="Paste teks berita di sini (hasil copy dari PDF/koran)..."
                        rows={10} value={text} onChange={e => setText(e.target.value)} />
              <Button
                onClick={() => handleSubmit({
                  title: textTitle || 'Kliping tanpa judul',
                  source_type: 'text',
                  extracted_text: text,
                })}
                disabled={loading || !text}
                className="w-full"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memproses AI... (5-15 detik)</> : 'Proses dengan AI'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Validation Approach

Strategi testing mengikuti dua fase: pertama, jalankan test di kode yang BELUM difix
untuk mengkonfirmasi bug ada dan memahami root cause. Kedua, verifikasi fix bekerja
benar dan behavior yang seharusnya dipertahankan tidak rusak.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexample yang mendemonstrasikan bug SEBELUM fix diimplementasi.
Konfirmasi atau refutasi root cause analysis.

**Test Plan:** Jalankan sistem tanpa Redis dan verifikasi crash. Panggil FastAPI
dengan SemanticRouter aktif dan ukur startup time. Panggil endpoint artikel dan
verifikasi response tidak berisi 6 output AI.

**Test Cases:**
1. **Redis Crash Test**: Start NestJS tanpa Redis berjalan — expected crash dengan
   `ECONNREFUSED` (akan fail sebelum fix)
2. **SemanticRouter Startup Test**: Time FastAPI startup dengan `semantic_router.py`
   diimport — expected > 10 detik (konfirmasi root cause 2)
3. **Pipeline Output Test**: POST ke `/pipeline/article-processing` — expected response
   hanya berisi `summary` dari Gemini, bukan 6 output sekaligus (konfirmasi root cause 3)
4. **Approval Status Test**: Submit artikel baru — expected status `processing` bukan
   `aktif` setelah AI selesai (konfirmasi root cause 5)

**Expected Counterexamples:**
- NestJS tidak bisa start → konfirmasi BullMQ/Redis hard dependency
- FastAPI start > 10 detik → konfirmasi SemanticRouter overhead
- Response article-processing tidak punya field `caption_instagram` → konfirmasi
  pipeline terpecah

### Fix Checking

**Goal:** Verifikasi bahwa untuk semua input di mana bug condition berlaku, fungsi
yang sudah difix menghasilkan behavior yang diharapkan.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(environment) DO
  result := analyzedArticle(request)
  ASSERT result.ringkasan.length == 3
  ASSERT result.sentimen IN ['Positif', 'Netral', 'Negatif']
  ASSERT result.topik.length >= 1 AND result.topik.length <= 2
  ASSERT result.caption_instagram != ''
  ASSERT result.draft_berita.judul != ''
  ASSERT result.draft_berita.paragraf.length == 3
  ASSERT article.status == 'aktif' (di DB setelah response)
END FOR
```

### Preservation Checking

**Goal:** Verifikasi bahwa untuk semua input di mana bug condition TIDAK berlaku,
fungsi yang sudah difix menghasilkan hasil yang identik dengan fungsi original.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(environment) DO
  ASSERT login(valid_credentials) returns JWT token
  ASSERT validateJWT(token) returns user with role 'admin'|'viewer'
  ASSERT scrapeURL(valid_news_url) returns non-empty text
  ASSERT extractPDF(pdf_buffer) returns non-empty text
  ASSERT healthCheck() returns { status: 'ok' }
  ASSERT articles_count_in_db == articles_count_after_fix
END FOR
```

**Testing Approach:** Property-based testing direkomendasikan untuk preservation
checking karena:
- Generate banyak test case otomatis (berbagai URL berita, berbagai format teks)
- Menangkap edge case (teks sangat pendek, judul dengan karakter khusus)
- Memberikan garansi kuat bahwa behavior tidak berubah untuk semua input non-buggy

**Test Cases:**
1. **Auth Preservation**: Login dengan credential valid tetap mengembalikan JWT —
   observe di kode original, verify tetap sama setelah fix
2. **Scraping Preservation**: URL berita valid tetap menghasilkan teks yang bisa
   dikirim ke AI (trafilatura tidak diubah)
3. **DB Write Preservation**: Semua field `news_clippings` tetap tersimpan dengan benar
4. **Role Check Preservation**: `admin` bisa POST artikel, `viewer` dapat 403 di endpoint
   write — behavior sama, hanya implementasi berubah dari JOIN ke direct column check

### Unit Tests

- Test `_call_gemini()` dengan mock `google.generativeai` — verifikasi response JSON
  diparsing benar menjadi 6 field output
- Test `_scrape_url()` dengan URL valid dan URL tidak valid — verifikasi fallback BS4
  berjalan jika trafilatura gagal
- Test `ArticlesService.create()` dengan mock `AiProxyService` — verifikasi INSERT
  awal dan UPDATE setelah AI selesai, status menjadi `aktif`
- Test `RolesGuard` dengan user `{ role: 'admin' }` dan `{ role: 'viewer' }` — verifikasi
  allow/deny tanpa DB join
- Test migration `simplify-for-demo.js` — verifikasi tabel yang di-drop tidak ada lagi,
  kolom `users.role` ada dengan nilai default `viewer`

### Property-Based Tests

- Generate random URL berita dari daftar domain berita Indonesia — verifikasi scraping
  selalu menghasilkan minimal 100 karakter teks (tidak blank)
- Generate random artikel text dengan berbagai panjang (50-5000 kata) — verifikasi
  Gemini selalu mengembalikan response JSON valid dengan 6 field
- Generate random user credentials — verifikasi login hanya berhasil untuk kredensial
  yang ada di DB, tidak ada false positive
- Generate random payload dengan field `title` berisi karakter SQL injection — verifikasi
  query tetap parameterized dan tidak error

### Integration Tests

- Test full flow: POST `/api/articles` dengan URL berita nyata → verifikasi response
  berisi semua 6 field AI → verifikasi GET `/api/articles` menampilkan artikel dengan
  status `aktif`
- Test Dashboard: GET `/api/dashboard` setelah beberapa artikel diproses → verifikasi
  statistik sentimen dan topik terakumulasi dengan benar
- Test Auth flow: POST `/api/auth/login` → gunakan token → POST artikel → verifikasi
  `created_by` tersimpan di DB
- Test health check kedua service tetap `200 OK` setelah semua module yang tidak perlu
  dihapus dari `app.module.ts`
