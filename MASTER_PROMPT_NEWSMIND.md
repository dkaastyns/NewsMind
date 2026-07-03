# NEWSMIND
Sistem Cerdas Manajemen Media & Publikasi Humas DPRD Berbasis AI
(Smart Media Monitoring & Digital Clipping)
Development Prompt Document
Version 0 → Version 6 | Sprint 2 Minggu

> Catatan: dokumen ini adalah master prompt untuk **NewsMind** — sistem
> monitoring media, kliping digital, dan publikasi berbasis AI untuk Humas
> DPRD. Nama proyek bebas diganti sesuai judul resmi laporan magang (mis.
> "Sistem Cerdas Manajemen Media dan Publikasi Humas DPRD Berbasis AI").
> Timeline 2 minggu (10 hari kerja efektif), mengikuti pola yang sama dengan
> proyek NewsMind sebelumnya: backend **NestJS + raw SQL (node-pg-migrate,
> tanpa ORM)**, AI service **FastAPI + semantic router 3 provider**, frontend
> **Next.js 15 di Vercel**. PostgreSQL+pgvector dan Redis jalan **lokal**
> dulu lewat **Laragon** — lihat `GETTING_STARTED.md`.

---

## V0
### Project Initialization Prompt

```
You are a senior software architect, AI engineer, and fullstack developer.

Help build a production-ready AI-powered media monitoring, digital clipping,
and publication management platform for a regional parliament's public
relations division (Humas DPRD), called NewsMind.

Timeline:
2 weeks (10 hari kerja efektif)

Team:
1-3 developers

Goal:
Build an intelligent media/press-clipping system for a regional parliament
(DPRD) Humas division that handles:

- Digital clipping berita (input dari link berita atau upload PDF/scan koran)
- AI pipeline: Extraction -> Summary -> Review/Ulasan -> Sentiment Analysis
  -> Topic Classification -> Embedding (semantic search arsip)
- Generative content: caption media sosial & draft berita website dari
  kliping/topik yang sudah diproses
- Dashboard statistik media (jumlah pemberitaan, sentimen, tren topik,
  media outlet terbanyak)
- Arsip berita digital + semantic search
- Approval workflow untuk publikasi (caption/berita) sebelum tayang
- Manajemen pengguna & role (admin, staf humas, kepala humas/approver)

The AI provider is selected automatically by a semantic router.
Users never manually choose the AI model.
```

Tech Stack

**Frontend**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Zustand
- Tanstack Query
- Axios
- React Hook Form + Zod
- Lucide React
- Recharts (dashboard statistik media)
- Deploy: **Vercel**

**Backend**
- NestJS
- TypeScript
- PostgreSQL 16 + **pgvector**
- Raw SQL (`pg`/node-postgres) + Repository pattern — **tanpa ORM**
- `node-pg-migrate` (migration runner)
- JWT + RBAC
- Redis
- BullMQ
- Storage: abstraction layer (Azure Blob **atau** AWS S3, lihat V2)
- Deploy: **Azure VM / AWS EC2 (belum final — lihat V2 §Deployment)**

**AI Service**
- FastAPI (Python), package manager `uv`
- Semantic Router (custom, lihat V4)
- Provider 1: **Gemini Flash** (Google AI Studio API key)
- Provider 2: **NVIDIA Build** (endpoint multi-model — model dipilih otomatis)
- Provider 3: **OpenRouter** (model gratis, dipakai sebagai fallback/cost-saver)

**Extraction & Ingestion**
- **Trafilatura + BeautifulSoup** (scraping isi berita dari link — WAJIB,
  input utama berupa link berita online)
- PyMuPDF + pdfplumber (PDF hasil scan/kliping cetak)
- EasyOCR (gambar/scan koran yang tidak punya teks di PDF)

---

Architecture

```
Frontend (Next.js, Vercel)
        |
        v
Backend API (NestJS, JWT, RBAC)
        |
    +---+----+
    |        |
PostgreSQL  Redis
 (+pgvector) (cache + BullMQ)
    |        |
    +---+----+
        |
        v
AI Service (FastAPI) -- Semantic Router
        |
   +----+----+----------+
   |         |           |
Gemini    NVIDIA      OpenRouter
Flash     Build       (free models)
```

Repository Structure

```
newsmind/
  frontend/        # Next.js 15
  backend/         # NestJS
  ai-service/      # FastAPI
  docs/
  GETTING_STARTED.md
  docker-compose.yml   # opsional, fallback pgvector / staging-CI
  README.md
  AGENTS.md
```

Expected Deliverables (2 minggu)

- Auth + RBAC (admin, staf humas, kepala humas/approver)
- Dashboard statistik media (jumlah berita/hari, sentimen, top topik, top
  media outlet — Recharts)
- Input kliping: **dari link berita** (scrape otomatis) **atau** upload
  PDF/gambar hasil scan
- Kliping — CRUD dasar (list, detail, filter tanggal/sumber/topik/sentimen)
- AI pipeline: extraction -> summary -> ulasan singkat -> sentiment analysis
  (positif/netral/negatif) -> topic classification -> embedding
- Semantic search arsip kliping (pgvector)
- Generate caption media sosial (dari 1 kliping atau ringkasan beberapa
  kliping sejenis)
- Generate draft berita website (dari kliping/topik terpilih)
- Approval workflow **2 level** untuk konten yang mau dipublikasikan
  (caption & draft berita) `[disederhanakan]`
- Notifikasi (in-app, minimal email) saat ada konten menunggu approval
- Audit log wajib di tabel sensitif
- Setup dev lokal lewat Laragon (PostgreSQL+pgvector, Redis) — lihat
  `GETTING_STARTED.md`
- Manajemen pengguna (CRUD user + assign role) — **Should Have**, cukup
  lewat panel admin sederhana kalau waktu mepet
- Chatbot tanya-jawab arsip kliping **[CUT untuk 2 minggu]** — chatbot
  bukan prioritas Humas; effort dialihkan ke fitur generatif (caption &
  draft berita) yang lebih langsung dipakai Humas sehari-hari.
- Analytics page terpisah **[CUT — digabung ke dashboard]**

**Nama database:** `newsmind`.

**pgvector:** dipakai (bukan opsional) — untuk semantic search arsip kliping
(mis. "cari semua berita terkait revisi APBD 3 bulan terakhir") *dan*
sebagai basis retrieval saat generate caption/berita agar konsisten dengan
kliping sumber. Embedding di-generate di worker queue terpisah, bukan
sinkron di request, jadi tidak menambah kompleksitas ke jalur utama.

> Generate complete project architecture sesuai struktur di atas.

---

## V1
### System Design Prompt

```
Act as a senior cloud architect.

Design NewsMind.

Requirements:
Staf humas input berita lewat dua jalur:
(a) paste link berita (media online) -> sistem scrape isi otomatis
(b) upload PDF/gambar hasil scan (kliping koran cetak)

System must:
Input -> (scrape link ATAU simpan file ke object storage)
   -> Insert row (status: processing)
   -> Push job ke BullMQ -> Return response cepat ke user
   -> Worker: Extraction (scrape/OCR/PDF parse) -> Summary -> Ulasan
      -> Sentiment Analysis -> Topic Classification -> Embedding
   -> Update status -> Trigger notifikasi

AI pipeline WAJIB asynchronous (lewat BullMQ worker), tidak boleh
dipanggil sinkron di dalam request HTTP — scraping bisa lambat/gagal
(situs media down/berubah struktur), OCR multi-halaman juga lambat.

Support providers:
- Gemini Flash (Google AI Studio)
- NVIDIA Build (multi-model endpoint)
- OpenRouter (model gratis)

Do not expose model selection to users. Staf humas hanya klik
"Tambah Kliping" -> pilih link atau upload file. System memilih provider
otomatis lewat semantic router.
```

Generate:
- ERD (tabel inti: users, roles, permissions, news_articles, article_sources,
  sentiments, topics, article_topics, summaries, social_captions,
  website_drafts, approval_workflow, approval_steps, notifications,
  audit_logs, ai_prompt_logs, embeddings)
- Database Schema (raw SQL `CREATE TABLE`, dijalankan lewat migration
  `node-pg-migrate`)
- Folder Structure (NestJS modular per domain)
- API Design (REST, versioned `/api/v1`)
- Sequence Diagram (input link/PDF -> extraction -> AI pipeline -> approval
  -> publish/arsip)
- Deployment Architecture (Vercel + backend VM/container)
- Redis Strategy (cache + BullMQ, dipisah database index)
- **Storage Strategy — abstraksi provider** (lihat detail di bawah)
- Queue Strategy (BullMQ: `article-processing`, `embedding`, `content-gen`
  [caption & draft berita], `notification` — queue terpisah)
- Setup Lokal (Laragon: PostgreSQL+pgvector, Redis — lihat
  `GETTING_STARTED.md`; Docker cuma fallback pgvector kalau perlu)
- Security Design (JWT short-lived + refresh token, RBAC, rate limiting)
- Logging & Monitoring (minimal: request log + `ai_prompt_logs`)
- Fallback Design (lihat V4)
- Semantic Router Design (lihat V4)
- Cost Optimization Strategy (prioritaskan Gemini free tier & OpenRouter
  free model dulu, NVIDIA untuk task vision/reasoning berat)

**Storage — karena provider cloud (Azure/AWS) belum final:**

```ts
interface StorageProvider {
  upload(file: Buffer, path: string): Promise<{ url: string; key: string }>;
  getSignedUrl(key: string, expiresInSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}

// implementasi: AzureBlobStorageProvider | S3StorageProvider
// dipilih via env STORAGE_PROVIDER=azure|aws
```

Naming file: `clippings/{year}/{month}/{uuid}-{original_filename}`.
Jangan hardcode SDK Azure/AWS di service layer — panggil lewat interface ini
saja, supaya keputusan cloud provider bisa menyusul tanpa ubah business
logic.

**Deployment — belum final, catat sebagai keputusan tertunda:**
- Opsi A: Azure VM (Ubuntu 24.04) + Nginx + PM2.
- Opsi B: AWS EC2 / ECS Fargate + ALB.
- Frontend selalu di **Vercel**, terpisah dari keputusan ini.
- Keputusan wajib diambil sebelum akhir minggu 1, karena mempengaruhi setup
  CI/CD dan storage provider.

---

## V2
### Backend Prompt (NestJS)

```
Act as a principal backend engineer.

Build backend architecture for NewsMind using NestJS.
```

Modul (per domain, feature-based — bukan layer-based):

```
backend/src/
  modules/
    auth/               # JWT, RBAC guard, login/refresh
    users/               # manajemen pengguna & role
    articles/             # kliping berita (input link/PDF, CRUD, detail)
      dto/
      entities/
      articles.controller.ts
      articles.service.ts
      articles.repository.ts   # raw SQL (pg), parameterized query
    ingestion/              # scraping link (trafilatura/BS4 via ai-service)
    analysis/                 # hasil AI: summary, ulasan, sentiment, topic
    content-gen/                # caption medsos & draft berita website
    workflow/                     # approval publikasi (2 level)
    archive/                       # arsip + semantic search
    dashboard/                      # agregasi statistik media
    notifications/
    ai-proxy/                        # klien HTTP ke FastAPI ai-service
    audit/                            # writer audit_logs, via interceptor
  common/
    database/
      pool.ts             # singleton pg.Pool
    guards/
    interceptors/
      audit-log.interceptor.ts
    storage/
      storage-provider.interface.ts
      azure-blob.provider.ts
      s3.provider.ts
    queue/
      bullmq.module.ts
      processors/
        article-processing.processor.ts
        embedding.processor.ts
        content-gen.processor.ts
        notification.processor.ts
  main.ts
migrations/                # node-pg-migrate, SQL murni di up/down
```

Aturan:
- Modul tidak boleh saling import repository/entity modul lain secara
  langsung — komunikasi lintas modul lewat service publik modul tersebut
  atau lewat queue/event.
- Setiap write ke tabel sensitif (`news_articles`, `social_captions`,
  `website_drafts`, `approval_workflow`, `users`, `permissions`) wajib lewat
  `AuditLogInterceptor` yang menulis ke `audit_logs`.
- DTO + `class-validator`/Zod wajib untuk setiap endpoint.
- Semua SQL parameterized (`$1, $2, ...`), gunakan `pool.query(...)` lewat
  transaksi (`BEGIN...COMMIT`) untuk operasi lintas tabel.

Generate: production-grade NestJS module structure, DTO layer, service
layer, repository pattern di atas raw SQL (`pg`), dan API integration ke
`ai-service`.

---

## V3
### Frontend Prompt (Next.js)

```
Act as a principal frontend engineer.

Build frontend for NewsMind.
Deploy target: Vercel.
```

Tech stack: Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Zustand,
Tanstack Query, Axios, Zod, React Hook Form, Lucide, Recharts.

Pages (dipangkas untuk 2 minggu):

- Login
- Dashboard (statistik media: volume berita/hari, distribusi sentimen,
  top topik, top media outlet — grafik Recharts)
- Kliping (list, tambah via link/upload, detail, hasil AI: ringkasan,
  ulasan, sentimen, topik)
- Generate Konten (pilih kliping/topik -> generate caption medsos & draft
  berita website, preview sebelum submit approval)
- Approval / Workflow (antrian konten menunggu approval, approval 2 level)
- Arsip (pencarian semantik kliping berdasarkan topik/periode)
- Manajemen Pengguna (CRUD user + role) — **Should Have**
- Profil / Pengaturan akun

`[CUT untuk 2 minggu]`: halaman Analytics terpisah (digabung dashboard),
Chat AI arsip, halaman Settings tingkat lanjut.

Fitur wajib: dark mode toggle, form input link + drag-drop upload PDF/gambar
dengan preview, skeleton loading, toast, empty state, responsive layout,
sidebar+navbar, badge warna untuk sentimen (hijau/abu/merah).

Folder structure:

```
frontend/src/
  app/
    (auth)/login/
    (dashboard)/
      dashboard/
      kliping/
      generate-konten/
      workflow/
      arsip/
      pengguna/
      profil/
  components/
    ui/            # shadcn primitives
    articles/
    content-gen/
    workflow/
    dashboard/
    shared/
  hooks/
  store/            # zustand
  services/         # axios instance + api calls
  schema/           # zod
  types/
```

---

## V4
### AI Prompt — Semantic Router (bagian paling penting)

```
Act as an AI architect.

Design NewsMind semantic routing system (FastAPI service).

Goal:
Automatically select the best AI provider per task. Users never select
providers manually.

Providers:
- Gemini Flash (Google AI Studio API key)
- NVIDIA Build (multi-model endpoint)
- OpenRouter (free-tier models)
```

Input types: link berita (URL), PDF kliping, gambar/scan koran, teks hasil
scrape/OCR.

Capabilities: web scraping & content extraction (link berita), OCR,
PDF extraction, text cleaning, summarization, ulasan/review generation
(opini singkat berimbang atas isi berita), sentiment analysis
(positif/netral/negatif + skor), topic classification (mis. APBD,
infrastruktur, pendidikan, sosial, dsb — multi-label), entity extraction
(nama pejabat/anggota dewan yang disebut, instansi, tanggal kejadian),
embedding untuk semantic search, generative writing (caption media sosial
per platform, draft berita website dalam gaya jurnalistik/rilis pers).

Routing logic (disederhanakan, disesuaikan 3 provider ini):

```
IF task == web_scraping/content_extraction (link berita)
    -> ai-service pipeline non-LLM dulu (trafilatura/BS4), LLM hanya
       dipanggil untuk cleaning teks hasil scrape jika berantakan
       -> Gemini Flash (task ringan, teks < 3000 char)

ELIF task == vision/OCR (gambar/scan kliping cetak)
    -> NVIDIA Build (model vision)

ELIF task == embedding
    -> Gemini (embedding model) atau NVIDIA, pilih yang latency terendah

ELIF text_length < 3000 AND task in [summary, sentiment, classification,
     metadata]
    -> Gemini Flash   # cepat, free tier generous, cocok task ringan

ELIF task == generative_writing (caption medsos, draft berita website,
     ulasan naratif panjang)
    -> NVIDIA Build (model reasoning/generation besar, kualitas tulisan
       lebih terjaga untuk konten yang akan dipublikasikan)

ELSE (fallback / cost-saving / Gemini quota habis)
    -> OpenRouter (model gratis)
```

> Catatan penting: model gratis OpenRouter biasanya rate-limited dan kualitas
> bervariasi antar model — dipakai sebagai **fallback & cost-saver**, bukan
> primary provider untuk task yang hasilnya akan dipublikasikan langsung
> (caption/berita website). Kalau butuh akurasi/kualitas tinggi dan
> Gemini/NVIDIA down, tandai hasil sebagai "AI draft — perlu verifikasi
> manual" dan tetap wajib lewat approval workflow sebelum tayang.

Implement (`ai-service/app/`):

```
semantic_router.py       # routing logic di atas
model_selector.py        # pilih model spesifik dalam satu provider (NVIDIA punya banyak model)
fallback_handler.py       # Gemini -> NVIDIA -> OpenRouter -> cached
cost_optimizer.py         # prioritaskan free tier dulu
intent_classifier.py       # klasifikasi task sebelum routing
provider_manager.py         # wrapper client tiap provider + auth key
response_formatter.py        # normalisasi output ke satu skema JSON
scraper/
  link_extractor.py           # trafilatura + BeautifulSoup fallback
```

Fallback strategy:

```
Gemini unavailable/quota habis
   -> NVIDIA Build
       -> OpenRouter (free model)
           -> Cached response (Redis) jika tersedia
               -> Return error + status "needs_manual_review"
```

Scraping fallback (khusus task ekstraksi link):

```
Trafilatura gagal ekstrak konten bersih
   -> BeautifulSoup manual (ambil <article>/<p> heuristik)
       -> Gagal juga -> tandai artikel "extraction_failed",
          minta staf humas paste teks manual
```

Caching (Redis): cache hasil scrape (key = hash URL), hasil OCR, hasil
summary, sentiment, classification, embedding — supaya artikel yang sama
tidak diproses ulang.

Queue (BullMQ, dipanggil dari NestJS, worker memanggil `ai-service`):
`article-processing` (extraction+summary+ulasan+sentiment+classification),
`embedding` (async, boleh telat sedikit), `content-gen` (caption & draft
berita — dipicu manual oleh staf humas, bukan otomatis semua artikel),
`notification`.

Output JSON standar (article-processing):

```json
{
  "article_id": "",
  "summary": "",
  "review": "",
  "sentiment": { "label": "", "score": 0.0 },
  "topics": [],
  "entities": { "pejabat": [], "instansi": [], "tanggal_kejadian": "" },
  "provider": "",
  "model": "",
  "confidence": 0.0,
  "needs_manual_review": false,
  "created_at": ""
}
```

Output JSON standar (content-gen):

```json
{
  "article_id": "",
  "type": "social_caption | website_draft",
  "platform": "instagram | twitter | facebook | website",
  "content": "",
  "provider": "",
  "model": "",
  "needs_manual_review": true,
  "created_at": ""
}
```

Setiap panggilan provider dicatat ke `ai_prompt_logs` (request, response,
latency, provider, model, cost jika ada) — wajib untuk audit sistem
pemerintahan.

---

## V5
### Sprint Prompt (dipakai tiap pagi, 10 hari kerja)

```
Act as an agile technical lead.

Current project: NewsMind
Timeline: 2 weeks (10 hari kerja)
Current day: Day X

Generate today's tasks, prioritas Must/Should/Could Have, untuk:
frontend, backend, ai-service, testing, deployment.
Sertakan estimasi waktu, potential blockers, dependency, acceptance criteria.
```

Saran pembagian 10 hari:

| Hari | Fokus |
|---|---|
| 1 | Setup repo, setup Laragon (postgres+pgvector, redis), migration awal (`node-pg-migrate`), auth skeleton |
| 2 | Auth + RBAC selesai, storage abstraction (pilih provider), CI dasar |
| 3-4 | Modul Kliping (input link + scraping dasar, upload PDF/gambar, CRUD, list) — frontend + backend |
| 5 | BullMQ worker + integrasi ai-service (extraction lengkap, summary, ulasan dasar) |
| 6 | Semantic router lengkap (sentiment + classification + 3 provider + fallback) |
| 7 | Content-gen (caption medsos + draft berita website) + approval workflow 2 level + notifikasi |
| 8 | Arsip + semantic search (pgvector), Dashboard statistik media |
| 9 | Manajemen pengguna, audit log review, polish UI, buffer bug fix |
| 10 | Deployment (Vercel + backend), smoke test, demo prep |

---

## V6
### Cursor / Windsurf / Claude Code Master Rule

> Isi versi ringkas ini cocok ditaruh di `.cursor/rules/*.mdc`,
> `.clinerules`, atau langsung dirujuk dari `AGENTS.md` (file terpisah yang
> sudah lengkap untuk project ini).

```
Always follow NewsMind architecture.

Frontend: Next.js 15, TypeScript, TailwindCSS, shadcn/ui — deploy Vercel.
Backend: NestJS, raw SQL (pg) + node-pg-migrate — tanpa ORM, PostgreSQL+pgvector, Redis, BullMQ.
AI: FastAPI, Semantic Router, Gemini Flash + NVIDIA Build + OpenRouter (free).

Input berita ada dua jalur: link (scraping trafilatura/BS4) atau
upload PDF/gambar (OCR). Jangan asumsikan hanya satu jalur input.

Dev lokal: PostgreSQL+pgvector dan Redis jalan lewat Laragon, bukan Docker.
Docker hanya dipakai sebagai fallback kalau pgvector gagal di-install manual
di Windows (lihat GETTING_STARTED.md).

Storage provider belum final (Azure/AWS) -> selalu panggil lewat
StorageProvider interface, jangan hardcode SDK cloud tertentu.

Semua proses AI wajib async lewat BullMQ, tidak boleh sinkron di request HTTP.
Konten hasil generative AI (caption/draft berita) WAJIB lewat approval
workflow sebelum dianggap final/siap publish — jangan pernah expose status
"published" tanpa approval tercatat.
Setiap write ke tabel sensitif wajib tercatat di audit_logs.
Prefer modular/feature-based structure, DTO, service layer, repository pattern.
Target MVP dalam 2 minggu — jangan tambah scope di luar V0 deliverables
tanpa persetujuan eksplisit.
```