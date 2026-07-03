# AGENTS.md — NewsMind

Panduan ini dibaca oleh AI coding agent (Claude Code, Cursor, Windsurf,
Antigravity, dll) sebelum mengerjakan apa pun di repo ini. Kalau ada
instruksi user yang bertentangan dengan file ini, **ikuti file ini**,
kecuali user secara eksplisit bilang "abaikan AGENTS.md".

---

## 1. Tentang Proyek

**Nama:** NewsMind (nama kerja; sesuaikan dengan judul resmi laporan
magang bila berbeda, mis. "Sistem Cerdas Manajemen Media dan Publikasi
Humas DPRD Berbasis AI")
**Jenis:** Sistem monitoring media, kliping digital, dan publikasi berbasis
AI untuk Humas (Hubungan Masyarakat) DPRD
**Timeline:** 2 minggu (MVP)
**Karakteristik penting:** ini alat kerja Humas sehari-hari → prioritaskan
**kecepatan input kliping, kualitas ringkasan/analisis AI, dan kejelasan
approval sebelum konten dipublikasikan** di atas fitur tambahan yang belum
tentu dipakai.

Modul inti (MVP 2 minggu):
- Kliping digital — input dari **link berita** (scraping otomatis) atau
  **upload PDF/gambar** (kliping koran cetak, OCR)
- AI pipeline: extraction → summary → ulasan → sentiment analysis → topic
  classification → embedding (semantic search arsip)
- Generate konten: caption media sosial & draft berita website dari
  kliping/topik terpilih
- Dashboard statistik media (volume berita, sentimen, top topik, top
  outlet)
- Arsip berita + semantic search
- Approval workflow **2 level** untuk konten yang akan dipublikasikan
- Manajemen pengguna & role

Chatbot tanya-jawab arsip **tidak masuk scope MVP** — untuk Humas, effort
2 minggu lebih bernilai dialihkan ke fitur generatif (caption & draft
berita) yang langsung dipakai untuk pekerjaan harian, bukan fitur
eksploratif seperti chatbot. Catat sebagai backlog v1.1 jika pgvector &
embedding sudah stabil.

Backlog setelah MVP (bukan scope 2 minggu): chatbot arsip, approval
berjenjang penuh (>2 level), scheduling publish otomatis ke platform
media sosial (posting langsung), analytics lintas-periode lanjutan.

**Nama database:** `newsmind` (snake_case, deskriptif, tanpa
tahun/versi). Dev lokal dan production pakai nama yang sama, dibedakan
lewat host/credential di `DATABASE_URL`:

```
dev:        newsmind
staging:    newsmind   (host/instance beda)
production: newsmind   (host/instance beda)
```

**pgvector — perlu, dan aman diambil:** dipakai untuk (1) semantic search
arsip kliping, (2) retrieval saat generate caption/draft berita agar hasil
konsisten dengan sumber kliping. Kompleksitas tambahan terutama di setup
lokal (§20, tidak otomatis tersedia di binary Windows) dan pemilihan index
— bukan di query sehari-hari. Kalau di hari ke-6/7 setup pgvector di
production bermasalah, fallback: nonaktifkan kolom `embedding`, semantic
search jadi pencarian keyword biasa (full text search `tsvector`) untuk
MVP, embedding menyusul — modul lain tidak terpengaruh karena embedding
di-generate di worker terpisah.

---

## 2. Arsitektur Layanan

```
Frontend (Next.js 15, Vercel)
        |  HTTPS / REST
        v
Backend API (NestJS)  -- JWT, RBAC, business logic
        |            \
        v             v
PostgreSQL(+pgvector) Redis (cache + BullMQ)
        |
        v (job async lewat BullMQ worker)
AI Service (FastAPI) -- Semantic Router
        |
   +----+------+-----------+
   |           |           |
Gemini      NVIDIA      OpenRouter
Flash       Build       (free models)
```

**Keputusan tertunda (wajib diambil sebelum akhir minggu 1):**
- Backend + ai-service dihosting di **Azure VM atau AWS EC2/ECS** — belum
  final.
- Storage file kliping (PDF/gambar) di **Azure Blob atau AWS S3** — belum
  final.
- Karena belum final, semua kode **wajib** lewat interface abstraksi
  (lihat §8), jangan hardcode SDK cloud tertentu di service/business logic
  manapun.

**Yang SUDAH pasti, tidak perlu ditunggu:** PostgreSQL(+pgvector) dan Redis
jalan **lokal lewat Laragon** (lihat §20) untuk seluruh masa development 2
minggu ini — langsung pakai dari hari pertama (lihat `GETTING_STARTED.md`).
Keputusan cloud provider di atas hanya mempengaruhi **deployment
production**, tidak menghalangi development.

---

## 3. Prinsip Kerja Agent

**Selalu:**
- Setiap perubahan skema database **wajib** lewat file migration baru
  (`node-pg-migrate`), tidak pernah mengedit migration yang sudah
  dijalankan/di-commit, dan tidak pernah membuat tabel/kolom lewat query
  ad-hoc di luar folder `migrations/`.
- Semua SQL **wajib parameterized** (`$1, $2, ...`), tidak pernah menyusun
  query dengan string concatenation/template literal yang berisi input
  user.
- Gunakan connection pool **singleton** (satu instance `pg.Pool` untuk
  seluruh app lifetime), jangan buat `new Pool()` di setiap request.
- Setiap endpoint (Controller NestJS) **wajib** divalidasi input-nya lewat
  DTO (`class-validator`) atau Zod sebelum menyentuh database.
- Setiap operasi tulis pada tabel sensitif (`news_articles`,
  `social_captions`, `website_drafts`, `approval_workflow`, `users`,
  `permissions`) **wajib** menulis baris ke `audit_logs` — gunakan
  `AuditLogInterceptor`, jangan tulis manual berulang di tiap service.
- Gunakan transaksi (`BEGIN...COMMIT`) untuk operasi yang menyentuh lebih
  dari satu tabel.
- Semua proses AI (extraction/scraping, OCR, summary, sentiment,
  classification, embedding, content-gen) **wajib** dijalankan async lewat
  BullMQ worker, tidak pernah dipanggil sinkron di dalam request/controller
  — scraping bisa lambat/timeout dan OCR multi-halaman juga lambat.
- Konten generatif AI (caption medsos, draft berita website) **wajib**
  berstatus `draft`/`pending_review` sampai lolos approval workflow —
  jangan pernah tandai `published` tanpa approval tercatat di
  `approval_workflow`.
- Setiap panggilan ke provider AI (Gemini/NVIDIA/OpenRouter) dicatat ke
  `ai_prompt_logs` (request, response, latency, provider, model) — wajib
  untuk audit sistem pemerintahan.
- Akses storage file **selalu** lewat interface `StorageProvider` (lihat
  §8), tidak pernah panggil SDK Azure/AWS langsung dari modul domain.

**Jangan pernah:**
- Menaruh secret (Gemini API key, NVIDIA API key, OpenRouter API key, DB
  credential, storage connection string) di kode. Semua lewat `.env`,
  tidak pernah di-commit.
- Menjalankan migration otomatis di production tanpa backup terlebih
  dahulu.
- Memanggil repository/entity milik modul lain secara langsung dari modul
  lain (mis. modul `workflow` mengimpor entity `articles` langsung) —
  komunikasi lintas modul lewat service publik atau queue/event.
- Auto-publish hasil scraping atau hasil generative AI ke channel publik
  (medsos/website) tanpa approval eksplisit — sistem ini hanya menyiapkan
  draft, publikasi aktual tetap tindakan manual staf humas di luar sistem
  (atau lewat integrasi terpisah yang eksplisit disetujui, di luar scope
  MVP).
- Menambah scope di luar deliverable V0 pada Master Prompt tanpa
  persetujuan eksplisit — timeline hanya 2 minggu.

---

## 4. Tech Stack Final

| Layer | Pilihan |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui |
| Frontend Deploy | **Vercel** |
| Backend | NestJS, TypeScript |
| Backend Deploy | Azure VM **atau** AWS EC2/ECS — *belum final* |
| Database | PostgreSQL 16 + extension `pgvector` |
| DB Driver | `pg` (node-postgres) — **tanpa ORM, raw SQL + repository pattern** |
| Migration Runner | `node-pg-migrate` |
| Auth | JWT (access + refresh token) + RBAC |
| Cache/Queue | Redis + BullMQ — **lokal dulu** (via Laragon/Memurai/WSL) untuk MVP 2 minggu |
| Storage | Azure Blob **atau** AWS S3 — *belum final, via interface* |
| AI Service | FastAPI (Python), `uv` package manager |
| AI Provider 1 | Gemini Flash — Google AI Studio API key |
| AI Provider 2 | NVIDIA Build — endpoint multi-model |
| AI Provider 3 | OpenRouter — model gratis (fallback/cost-saver) |
| Scraping (link berita) | Trafilatura + BeautifulSoup |
| OCR | EasyOCR |
| PDF | PyMuPDF, pdfplumber |
| Reverse Proxy (kalau self-host) | Nginx |
| Process Manager (kalau self-host) | PM2 |

---

## 5. Struktur Folder — Monorepo, 3 Service

```
newsmind/
  frontend/                       # Next.js 15
    src/
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
        ui/                       # shadcn primitives
        articles/
        content-gen/
        workflow/
        dashboard/
        shared/
      hooks/
      store/                       # zustand
      services/                     # axios instance + api client
      schema/                        # zod
      types/

  backend/                          # NestJS
    src/
      modules/
        auth/                       # JWT, RBAC guard, login/refresh
        users/                       # manajemen pengguna & role
        articles/                     # kliping berita (input link/PDF, CRUD)
          dto/
          entities/
          articles.controller.ts
          articles.service.ts
          articles.repository.ts    # raw SQL (pg), parameterized query
        ingestion/                    # scraping link -> ai-service
        analysis/                      # summary, ulasan, sentiment, topic
        content-gen/                    # caption medsos & draft berita
        workflow/                        # approval publikasi (2 level)
        archive/                          # arsip + semantic search
        dashboard/                         # agregasi statistik media
        notifications/
        ai-proxy/                           # klien HTTP ke ai-service (FastAPI)
        audit/                               # writer audit_logs
      common/
        database/
          pool.ts                   # singleton pg.Pool
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
    migrations/                      # node-pg-migrate, SQL murni di dalam up/down
      1719800000000_users.js
      1719800001000_roles-permissions.js
      1719800002000_articles.js
      1719800003000_analysis.js
      1719800004000_content-gen.js
      1719800005000_workflow.js
      1719800006000_notifications.js
      1719800007000_audit.js

  ai-service/                        # FastAPI
    app/
      main.py
      semantic_router.py
      model_selector.py
      fallback_handler.py
      cost_optimizer.py
      intent_classifier.py
      provider_manager.py
      response_formatter.py
      providers/
        gemini_client.py
        nvidia_client.py
        openrouter_client.py
      scraper/
        link_extractor.py            # trafilatura + BS4 fallback
      ocr/
        easyocr_service.py
      pdf/
        extractor.py
      prompts/
        summary_prompt.py
        review_prompt.py
        sentiment_prompt.py
        classification_prompt.py
        social_caption_prompt.py
        website_draft_prompt.py

  docs/
  docker-compose.yml                  # opsional: fallback pgvector, atau staging/CI
  README.md
  AGENTS.md
```

**Aturan modul (NestJS backend):**
- Modul tidak boleh saling import repository/entity modul lain secara
  langsung — panggil lewat service publik modul terkait, atau lewat
  queue/event (`common/queue`).
- `common/` isinya murni infrastruktur (storage, queue, guard, interceptor)
  — tidak boleh ada business logic spesifik satu domain nyasar ke sini.
- Kalau ada logic dipakai lebih dari 2 modul (mis. audit log writer), taruh
  di modul `audit/` dan dipanggil via interceptor, bukan diduplikasi.

---

## 6. Database & Migration — Raw SQL + node-pg-migrate

**Kenapa tanpa ORM:** butuh kontrol penuh atas fitur PostgreSQL lanjutan —
`pgvector` (embedding arsip), full text search (`tsvector`, fallback kalau
pgvector bermasalah), dan kemungkinan materialized view untuk dashboard
statistik. ORM sering menyulitkan tipe kolom non-standar seperti
`vector(1536)`.

- Migration ditulis pakai **node-pg-migrate**, SQL murni di dalam `up`/`down`
  (`pgm.sql(...)`). Runner otomatis mencatat migration yang sudah
  dijalankan di tabel `pgmigrations`.
- Command: `bun run migrate up`, `bun run migrate down`.
- Naming file: `<timestamp>_<deskripsi>.js` (auto dari `node-pg-migrate
  create`), jangan pakai angka manual (`0001_...`).
- Setiap migration harus punya `down` yang valid (rollback-able), kecuali
  migration data seed.
- Query kompleks (join berat, CTE, full text search, vector similarity
  search, agregasi dashboard) ditulis manual di repository layer
  (`*.repository.ts`).
- Index wajib: B-tree untuk kolom filter umum (`status`, `published_at`,
  `sentiment_label`, `created_at`), GIN untuk `search_vector` (tsvector)
  dan kolom JSONB (`entities`), HNSW atau IVFFlat untuk kolom
  `embedding VECTOR(...)`.

Contoh repository yang benar:

```ts
export class ArticleRepository {
  constructor(private pool: Pool) {}

  async findBySentiment(label: string): Promise<Article[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM news_articles WHERE sentiment_label = $1 ORDER BY published_at DESC`,
      [label]
    );
    return rows;
  }

  async findSimilarByEmbedding(embedding: number[], limit = 5): Promise<Article[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, summary, 1 - (embedding <=> $1) AS similarity
       FROM news_articles
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(embedding), limit]
    );
    return rows;
  }
}
```

---

## 7. Keamanan Query & Input

- Semua input dari user wajib divalidasi (DTO + `class-validator`, atau Zod
  di boundary tertentu) sebelum masuk ke service/repository — termasuk
  validasi format URL untuk input link berita (bukan sekadar string bebas).
- Tidak pernah membangun query SQL dari string concatenation berisi input
  user — gunakan `pool.query(text, params)` dengan placeholder `$1, $2, ...`.
- Scraping link eksternal harus punya timeout & batas ukuran konten, jangan
  biarkan worker menggantung kalau situs sumber lambat/berat.
- Rate limiting wajib di endpoint login dan endpoint publik lainnya (NestJS
  throttler module).

---

## 8. Storage — Abstraksi Provider (Azure/AWS belum final)

```ts
// common/storage/storage-provider.interface.ts
export interface StorageProvider {
  upload(file: Buffer, path: string, mimeType: string): Promise<{ url: string; key: string }>;
  getSignedUrl(key: string, expiresInSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```

- Implementasi: `AzureBlobProvider` dan `S3Provider`, keduanya implement
  interface yang sama.
- Provider aktif dipilih via env `STORAGE_PROVIDER=azure|aws`, di-inject
  lewat NestJS provider token — modul domain (`articles`, dst) **tidak
  pernah** mengimpor SDK Azure/AWS secara langsung.
- Naming path file: `clippings/{year}/{month}/{uuid}-{original_filename}`.
- Kliping yang berasal dari **link** tidak butuh storage file (hanya teks
  hasil scrape disimpan di kolom database) — storage hanya dipakai untuk
  upload PDF/gambar.
- Keputusan provider final wajib diambil sebelum akhir minggu 1.

---

## 9. Auth & RBAC (NestJS)

- JWT: access token short-lived (mis. 15 menit) + refresh token.
- RBAC: tabel `roles` + `permissions` + `role_permissions`, bukan hardcode
  role di kode. Role minimal MVP: `admin`, `staf_humas`, `kepala_humas`
  (approver).
- Log setiap login/logout/gagal login ke `audit_logs`.
- Guard RBAC diterapkan di level controller (`@Roles(...)` decorator +
  `RolesGuard`), jangan cek role manual di dalam service.
- `staf_humas` boleh input kliping & generate draft konten; hanya
  `kepala_humas` (atau role approver) yang boleh approve/reject di
  workflow.

---

## 10. Workflow AI Pipeline (FastAPI + BullMQ)

Alur wajib async, tidak boleh blocking request HTTP:

```
1. Staf humas input kliping (NestJS controller):
   (a) paste link berita
       -> insert row news_articles (status: "processing", source_type: "link")
       -> push job ke BullMQ queue "article-processing"
   (b) upload PDF/gambar
       -> simpan file lewat StorageProvider
       -> insert row news_articles (status: "processing", source_type: "upload")
       -> push job ke BullMQ queue "article-processing"
   -> return response cepat ke user (jangan tunggu AI selesai)

2. Worker "article-processing" (BullMQ, backend/src/common/queue/processors):
     a. Kalau source_type == "link": panggil ai-service -> scraping
        (trafilatura/BS4)
        Kalau source_type == "upload": panggil ai-service -> OCR/PDF extract
     b. Panggil ai-service -> Summary + Ulasan + Sentiment + Topic
        Classification + Entity extraction (semantic router memilih
        provider: Gemini / NVIDIA / OpenRouter)
     c. Push job terpisah ke queue "embedding" (boleh sedikit lebih lambat)
     d. Update status news_articles -> "ready"
     e. Push job ke queue "notification"

3. Worker "embedding": generate embedding, simpan ke kolom pgvector.

4. Generate konten (dipicu manual oleh staf humas, BUKAN otomatis untuk
   semua kliping):
     a. Staf humas pilih 1 kliping atau beberapa kliping sejenis
     b. Push job ke queue "content-gen" -> ai-service generate caption
        medsos dan/atau draft berita website
     c. Hasil disimpan dengan status "pending_review"

5. Workflow approval (2 level) berjalan atas hasil content-gen:
     a. Level 1: staf humas senior/koordinator review draft
     b. Level 2: kepala humas approve final
     c. Hanya setelah lolos level 2, status berubah jadi "approved" —
        publikasi aktual tetap tindakan manual di luar sistem (MVP tidak
        auto-post ke platform medsos).
```

**Semantic Router (ai-service/app/semantic_router.py)** — logika ringkas:

```
IF task == web_scraping (link berita)      -> trafilatura/BS4 (non-LLM), lalu Gemini Flash untuk cleaning jika perlu
ELIF task == vision/OCR                     -> NVIDIA Build (model vision)
ELIF task == embedding                        -> Gemini atau NVIDIA (latency terendah)
ELIF text_length < 3000 AND task in [summary,
     sentiment, classification, metadata]        -> Gemini Flash
ELIF task == generative_writing (caption,
     draft berita website)                          -> NVIDIA Build
ELSE (fallback / Gemini quota habis)                    -> OpenRouter (free model)
```

Fallback chain: `Gemini -> NVIDIA -> OpenRouter -> cached response (Redis) ->
error + status "needs_manual_review"`.

> Model gratis OpenRouter bersifat fallback/cost-saver, bukan primary untuk
> konten yang akan dipublikasikan (caption/draft berita). Kalau hasil dari
> fallback dipakai, tandai `needs_manual_review: true` dan tetap wajib lewat
> approval workflow.

Setiap panggilan provider dicatat ke `ai_prompt_logs`.

---

## 11. Queue (BullMQ)

- Queue terpisah per jenis job: `article-processing`, `embedding`,
  `content-gen`, `notification` — jangan digabung jadi satu queue generik,
  supaya retry/prioritas bisa diatur per jenis.
- Job wajib idempotent (aman dijalankan ulang jika retry) — cek status
  sebelum reproses.
- Set `attempts` + `backoff` untuk job yang memanggil API eksternal
  (scraping, Gemini, NVIDIA, OpenRouter, storage provider) — situs media
  eksternal bisa down/berubah struktur sewaktu-waktu, jangan retry tanpa
  batas.

---

## 12. Cache (Redis)

**Redis jalan lokal dulu** (lewat Laragon/Memurai/WSL, lihat
`GETTING_STARTED.md`), sama seperti PostgreSQL — tidak perlu Redis
Cloud/Azure Cache/ElastiCache untuk MVP 2 minggu.

Gunakan untuk: cache hasil scrape per URL (key = hash URL, supaya link yang
sama tidak di-scrape ulang), cache hasil OCR/summary/sentiment/
classification (key = hash file/teks), rate limiting endpoint publik, cache
hasil semantic search yang berat. Jangan cache status approval workflow
real-time (harus selalu fresh).

---

## 13. Environment Variables

```
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# Storage
STORAGE_PROVIDER=azure   # atau aws
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=

# AI Providers
GEMINI_API_KEY=              # Google AI Studio
NVIDIA_API_KEY=               # NVIDIA Build
OPENROUTER_API_KEY=            # OpenRouter (free tier)

NODE_ENV=
```

`.env.example` wajib di-update setiap kali ada variabel baru. `.env` masuk
`.gitignore` di ketiga service (frontend, backend, ai-service).

---

## 14. Security & Audit (khusus sistem pemerintahan)

- **Audit log wajib**, bukan opsional — siapa mengubah/generate/approve
  apa, kapan, dari IP mana, untuk setiap tabel sensitif.
- **Backup database otomatis** — `pg_dump` terjadwal (cron) ke storage
  provider yang dipakai, retensi minimal 30 hari. Wajib sebelum go-live
  sungguhan (bukan cuma demo), meski di luar scope 2 minggu MVP — catat
  sebagai task minggu berikutnya kalau belum sempat.
- **HTTPS wajib** di semua service (Vercel otomatis; backend/ai-service
  perlu setup manual tergantung provider yang dipilih di §8).
- **Rate limiting** di endpoint login & API publik.
- Pisahkan environment: `dev`, `staging`, `production` — jangan test
  langsung di database production.
- Konten yang belum lolos approval **tidak boleh** ter-expose lewat API
  publik/preview yang bisa diakses di luar sistem.

---

## 15. Testing (minimal untuk 2 minggu)

- Zod/DTO schema validation — wajib ditest.
- Business rule approval workflow (siapa boleh approve/reject di level
  mana, status transition yang valid) — wajib ditest, karena ini inti
  compliance sebelum publikasi.
- Scraping fallback logic (trafilatura gagal -> BS4 -> extraction_failed)
  — wajib ditest dengan minimal beberapa kasus HTML nyata.
- Repository/service layer lain: test opsional kalau waktu terbatas, catat
  sebagai technical debt di README.

---

## 16. Git & Commit Convention

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `db:`
  (khusus migration `node-pg-migrate`).
- Satu migration = satu commit, jangan digabung dengan perubahan fitur
  lain.
- PR yang mengubah skema DB wajib menyertakan file migration.

---

## 17. Deployment

**Frontend:** Vercel — otomatis dari branch `main`, env var lewat Vercel
dashboard (jangan commit `.env`).

**Backend + AI Service:** Azure VM **atau** AWS EC2/ECS — *keputusan
tertunda, wajib final sebelum akhir minggu 1*. Pola umum kalau pakai VM:

```
Internet -> (Cloudflare, opsional) -> VM
              -> Nginx -> NestJS (PM2) -> PostgreSQL
                       -> FastAPI (uvicorn, systemd/PM2)
                                    -> Redis
                                    -> Storage Provider
                                    -> Gemini / NVIDIA / OpenRouter
```

Kalau nanti deployment production pakai container (ECS/Azure Container
Apps), baru dibuatkan `docker-compose.yml`/Dockerfile sebagai basis image —
tidak dipakai untuk development lokal (yang pakai Laragon, lihat
`GETTING_STARTED.md`).

---

## 18. AI Agent Workflow (Fase Wajib)

AI agent tidak boleh generate seluruh aplikasi dalam satu response.
Development mengikuti fase berikut untuk MVP 2 minggu:

1. Project Initialization & Setup Lokal (Laragon — lihat `GETTING_STARTED.md`)
2. Database Schema (raw SQL) & Migration Awal (`node-pg-migrate`)
3. Auth + RBAC
4. Storage Abstraction (pilih provider dev sementara, lewat interface)
5. Modul Kliping (Articles) — input link (scraping dasar) + upload PDF/gambar, CRUD
6. BullMQ Worker + Integrasi AI Service (extraction lengkap + summary + ulasan dasar)
7. Semantic Router Lengkap (sentiment + classification + 3 provider + fallback)
8. Modul Content-Gen (caption medsos + draft berita website)
9. Modul Workflow (approval 2 level) + Notifikasi
10. Modul Arsip + Semantic Search (pgvector)
11. Dashboard Statistik Media
12. Manajemen Pengguna
13. Audit Log Review + Security Pass
14. Deployment (Vercel + backend)
15. Testing Minimal (schema validation + workflow rules + scraping fallback)
16. Dokumentasi

Setiap fase harus diverifikasi selesai sebelum lanjut ke fase berikutnya.
Jangan skip fase. Jangan refactor arsitektur tanpa persetujuan eksplisit.
Selalu utamakan maintainability di atas kecepatan, kecuali disebutkan lain
untuk memenuhi timeline 2 minggu. AGENTS.md ini adalah source of truth.

---

## 19. Setup Database Lokal (pgvector) — Laragon

Development lokal pakai **Laragon** (bukan Docker) untuk PostgreSQL 16 dan
Redis. Langkah detail lengkap (termasuk cara install pgvector manual di
Windows) ada di `GETTING_STARTED.md` — ringkasannya:

1. Aktifkan PostgreSQL 16 lewat Laragon (**Tools → Quick Add →
   PostgreSQL**), buat database `newsmind`.
2. Enable extension `uuid-ossp`, `pgcrypto` (selalu berhasil), lalu coba
   `vector`.
3. **`CREATE EXTENSION vector` sering gagal di binary PostgreSQL bawaan
   Laragon** karena pgvector tidak bundled. Kalau gagal, install prebuilt
   binary pgvector Windows yang cocok versi PG-nya, copy ke folder `lib/`
   dan `share/extension/` instalasi PostgreSQL Laragon, lalu restart
   service.
4. Fallback terakhir kalau tetap gagal: jalankan **Docker hanya untuk
   PostgreSQL** (image `pgvector/pgvector:pg16`, port berbeda), sementara
   Redis dan tooling lain tetap di Laragon — hybrid, bukan pindah penuh ke
   Docker.
5. Set `DATABASE_URL` di `.env`:
   ```
   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/newsmind
   ```
6. Jalankan migration: `bun run migrate up`.

Agent **tidak boleh** mengasumsikan pgvector otomatis tersedia hanya karena
PostgreSQL sudah jalan — selalu verifikasi extension ter-enable (`\dx`)
sebelum menulis migration yang memakai kolom `VECTOR(...)`.