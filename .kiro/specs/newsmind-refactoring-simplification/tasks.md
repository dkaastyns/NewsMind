# Implementation Plan — NewsMind Refactoring Simplification

## Overview

Implementasi refactoring NewsMind untuk menghilangkan dependency Redis/BullMQ, SemanticRouter, approval workflow, dan RBAC kompleks, diganti dengan pipeline sinkron satu-tembakan menggunakan Gemini 2.5 Flash. Tujuannya agar sistem bisa berjalan di server gratisan, startup < 3 detik, dan mudah dipahami tim 3 magang.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "label": "Phase 1 — Exploration & Preservation Tests",
      "tasks": ["1", "2"]
    },
    {
      "wave": 2,
      "label": "Phase 2 — Implementation (paralel per orang)",
      "tasks": ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17"],
      "parallelGroups": [
        { "person": "A — FastAPI", "tasks": ["3", "4", "5", "6"] },
        { "person": "B — NestJS", "tasks": ["7", "8", "9", "10", "11"] },
        { "person": "C — Next.js", "tasks": ["12", "13", "14", "15", "16", "17"] }
      ],
      "internalDependencies": [
        { "from": "7", "to": ["9", "10", "11"], "note": "Migration harus selesai sebelum test integrated" }
      ]
    },
    {
      "wave": 3,
      "label": "Phase 3 — Verification & E2E",
      "tasks": ["18", "19", "20"],
      "dependencies": ["wave-1", "wave-2"]
    }
  ]
}
```

## Tasks

> **Pembagian Tim (3 orang magang, bisa paralel)**
>
> | Orang | Fokus | Tasks |
> |-------|-------|-------|
> | **A** | FastAPI (Python) | 3, 4, 5, 6 |
> | **B** | NestJS + Database (TypeScript) | 7, 8, 9, 10, 11 |
> | **C** | Next.js (TypeScript/React) | 12, 13, 14, 15, 16, 17 |
>
> Task **1 & 2** (Exploration/Preservation tests) dikerjakan bersama sebelum Phase 2 dimulai.
> Task **18, 19, 20** (Verifikasi + E2E) dikerjakan bersama setelah semua Phase 2 selesai.
>
> **Urutan wajib antar fase:**
> 1. Selesaikan task 1 & 2 dulu (konfirmasi bug)
> 2. Orang A, B, C kerjakan task masing-masing secara paralel
> 3. Orang B: selesaikan task 7 (DB Migration) sebelum test integrated task 9, 10, 11
> 4. Setelah semua selesai, jalankan task 18, 19, 20 bersama

---

## Phase 1 — Exploration & Preservation Tests (SEBELUM fix diimplementasi)

- [x] 1. Tulis bug condition exploration test
  - **Property 1: Bug Condition** - Single-Shot Pipeline & Redis-Free Startup
  - **PENTING**: Tulis dan jalankan test ini di kode yang BELUM difix
  - **TUJUAN**: Konfirmasi bug exist sebelum kita mengubah apapun
  - **EXPECTED OUTCOME**: Test GAGAL — itu berarti benar, bug terkonfirmasi
  - **JANGAN** coba fix test atau kode ketika test gagal di fase ini
  - **Test A — Redis Crash**: Start NestJS tanpa Redis → verifikasi crash `ECONNREFUSED 127.0.0.1:6379`
  - **Test B — SemanticRouter Startup**: Time `uvicorn app.main:app`, verifikasi > 10 detik karena `FastEmbedEncoder` init
  - **Test C — Pipeline Output**: POST ke pipeline endpoint → verifikasi response TIDAK punya field `caption_instagram`, `ai_review`, `ai_sentiment`, `ai_topic` sekaligus
  - **Test D — Approval Status**: Submit artikel baru → verifikasi status tetap `processing` / `pending_review` setelah AI selesai, tidak langsung `aktif`
  - Dokumentasikan counterexample yang ditemukan (e.g., "NestJS tidak bisa start → BullMQ/Redis hard dependency terkonfirmasi")
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2. Tulis preservation property tests (SEBELUM mengimplementasi fix)
  - **Property 2: Preservation** - Auth, Scraping, dan DB Write Tetap Berjalan
  - **PENTING**: Ikuti observation-first methodology — jalankan kode original, observasi, baru tulis test
  - **EXPECTED OUTCOME**: Test LULUS di kode original — baseline terkonfirmasi
  - Observe: `POST /api/v1/auth/login` dengan credential valid → catat format response JWT
  - Observe: `GET /api/v1/health` FastAPI → catat response `{ status: "healthy" }`
  - Observe: NestJS health endpoint → catat response
  - Observe: Scraping URL berita valid via trafilatura → catat minimal karakter teks yang dikembalikan
  - Tulis property-based test: untuk semua input `!isBugCondition(env)`, behavior di atas tetap sama
  - Jalankan tests di kode ORIGINAL, verifikasi semua LULUS
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 3.10_

---

## Phase 2 — Implementation (Tasks 3–8, bisa paralel per orang)

### Orang A — FastAPI Cleanup & Pipeline Baru

- [x] 3. [FastAPI] Hapus service files yang tidak dipakai
  - Hapus file-file berikut dari `ai-service/app/services/`:
    - `semantic_router.py`
    - `model_selector.py`
    - `fallback_handler.py`
    - `cost_optimizer.py`
    - `intent_classifier.py`
    - `provider_manager.py`
    - `response_formatter.py`
  - Pertahankan `gemini_service.py` (masih dipakai endpoint `/pipeline/chat`)
  - Pertahankan `__init__.py` di folder services
  - Verifikasi tidak ada import ke file yang dihapus di `main.py` atau `routers/`
  - _Bug_Condition: environment.SEMANTIC_ROUTER_LOADED == true_
  - _Requirements: 2.3, 2.6_

- [x] 4. [FastAPI] Tambah dependency google-generativeai ke pyproject.toml
  - Tambahkan `google-generativeai>=0.8.0` ke dependencies di `ai-service/pyproject.toml`
  - Jalankan `uv sync` atau `uv add google-generativeai` di folder `ai-service/`
  - Verifikasi package terinstall: `uv run python -c "import google.generativeai; print('OK')"`
  - _Requirements: 2.7, 2.8_

- [x] 5. [FastAPI] Ganti total `app/routers/pipeline.py` dengan implementasi single-shot
  - Tulis ulang `ai-service/app/routers/pipeline.py` sesuai spesifikasi di design.md Section 1
  - Implementasi endpoint `POST /api/v1/pipeline/analyze` yang:
    - Menerima `{ article_id, source_type, source_url?, extracted_text?, title }`
    - Jika `source_type == "url"`: panggil `_scrape_url()` via trafilatura + BS4 fallback
    - Jika `source_type == "text"` atau `"pdf"`: gunakan `extracted_text` langsung
    - Panggil Gemini 2.5 Flash dengan `response_mime_type: "application/json"` dan `response_schema`
    - Return JSON: `{ ringkasan[3], ulasan, sentimen, topik[1-2], caption_instagram, draft_berita }`
  - Implementasi `_OUTPUT_SCHEMA` sesuai design.md (semua 6 field required)
  - Implementasi `_SYSTEM_PROMPT` dengan instruksi DPRD context sesuai design.md
  - Gunakan `GEMINI_API_KEY` dari environment variable
  - _Bug_Condition: AI_PROVIDERS_COUNT > 1, pipeline terpecah_
  - _Expected_Behavior: satu panggilan Gemini menghasilkan 6 output sekaligus_
  - _Requirements: 2.3, 2.7, 2.8_

- [x] 6. [FastAPI] Bersihkan `app/main.py`
  - Update `ai-service/app/main.py` agar hanya import `health_router` dan `pipeline_router`
  - Hapus semua import lain yang merujuk ke service/router yang sudah dihapus
  - Set `version="2.0.0"` di FastAPI constructor
  - Verifikasi FastAPI start tanpa error: `uv run uvicorn app.main:app --reload`
  - Verifikasi startup < 3 detik (tidak ada SemanticRouter init)
  - _Requirements: 2.3, 2.6_

---

### Orang B — NestJS & Database

- [x] 7. [Database] Buat migration baru untuk drop tabel dan simplifikasi users
  - Buat file `backend/migrations/<timestamp>_simplify-for-demo.js`
  - Gunakan timestamp saat ini (contoh: `1751600000000_simplify-for-demo.js`)
  - Implementasi `exports.up` sesuai design.md Section 6:
    - Drop `workflow_approvals` (cascade)
    - Drop `workflow_steps` (cascade)
    - Drop `notifications` (cascade)
    - Drop `role_permissions` (cascade)
    - Drop `permissions` (cascade)
    - Tambah kolom `role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer'))` ke `users`
    - Migrate data: `UPDATE users SET role = CASE WHEN r.code = 'admin' THEN 'admin' ELSE 'viewer' END FROM roles r WHERE u.role_id = r.id`
    - Alter `users.role_id` menjadi nullable
    - Drop FK constraint `users_role_id_fkey`
    - Drop tabel `roles` (cascade)
  - Implementasi `exports.down` untuk rollback minimal
  - Jalankan migration: `cd backend && bun run migrate up`
  - Verifikasi: tabel yang di-drop tidak ada di DB, kolom `users.role` ada
  - _Bug_Condition: PERMISSIONS_TABLE_JOINS == true_
  - _Requirements: 2.4, 2.5_

- [x] 8. [NestJS] Update `app.module.ts` — hapus modul yang tidak perlu
  - Edit `backend/src/app.module.ts`
  - Pertahankan hanya imports berikut: `ConfigModule`, `ThrottlerModule`, `DatabaseModule`, `HealthModule`, `AuthModule`, `UsersModule`, `ArticlesModule`, `ArchiveModule`, `DashboardModule`, `AiProxyModule`
  - Hapus dari imports: `QueueModule`/`BullMqModule`, `StorageModule`, `AuditModule`, `IngestionModule`, `AnalysisModule`, `ContentGenModule`, `WorkflowModule`, `NotificationsModule`
  - Hapus semua import statement TypeScript yang merujuk ke modul di atas
  - Verifikasi NestJS compile tanpa error: `cd backend && bun run build`
  - _Bug_Condition: BULLMQ_RUNNING == false → app crash_
  - _Requirements: 2.1, 2.6_

- [x] 9. [NestJS] Update `articles.service.ts` dan `articles.controller.ts`
  - Ganti implementasi `backend/src/modules/articles/articles.service.ts` sesuai design.md Section 4:
    - Method `create()`: INSERT row awal (status: `processing`) → call `AiProxyService.analyze()` sinkron → UPDATE semua field `ai_*` + set status `aktif`
    - Method `findAll(page, limit)`: query `news_clippings WHERE status = 'aktif'`
    - Method `findOne(id)`: query satu row dengan semua field
  - Ganti implementasi `backend/src/modules/articles/articles.controller.ts` sesuai design.md
  - Buat/update `backend/src/modules/articles/dto/create-article.dto.ts` dengan field: `title`, `source_type` (enum `url|pdf|text`), `source_url?`, `extracted_text?`
  - _Bug_Condition: APPROVAL_WORKFLOW_ACTIVE == true → status tidak langsung aktif_
  - _Expected_Behavior: status `aktif` langsung setelah AI response diterima_
  - _Preservation: DB write ke `news_clippings` tetap menggunakan parameterized query_
  - _Requirements: 2.2, 2.5, 2.9, 3.6_

- [x] 10. [NestJS] Update `ai-proxy.service.ts` untuk endpoint `/pipeline/analyze`
  - Ganti implementasi `backend/src/modules/ai-proxy/ai-proxy.service.ts` sesuai design.md Section 5
  - Method `analyze(payload: AnalyzeRequest)` memanggil `POST {AI_SERVICE_URL}/api/v1/pipeline/analyze`
  - Gunakan `axios` dengan timeout 60 detik
  - Return type `AnalyzeResult` dengan semua 6 field AI
  - Gunakan `AI_SERVICE_URL` dari `ConfigService` (default: `http://localhost:8000`)
  - Error handling: wrap axios error menjadi `HttpException` dengan status `502`
  - _Requirements: 2.7, 2.9_

- [x] 11. [NestJS] Update `RolesGuard` dan JWT payload di `AuthService`
  - Edit `backend/src/common/guards/roles.guard.ts` sesuai design.md Section 7:
    - Cek `user?.role` langsung dari request (string `'admin'` atau `'viewer'`)
    - Hapus semua join/query ke tabel `roles`, `permissions`, `role_permissions`
  - Edit `AuthService` (biasanya di `backend/src/modules/auth/auth.service.ts`):
    - Saat generate JWT, ambil `user.role` langsung dari kolom `users.role` (bukan join ke `roles`)
    - Payload JWT: `{ sub: user.id, email: user.email, role: user.role }`
  - Verifikasi `viewer` masih dapat 403 di endpoint yang butuh `admin`
  - _Bug_Condition: PERMISSIONS_TABLE_JOINS == true_
  - _Preservation: admin bisa POST artikel, viewer dapat 403 — behavior sama, implementasi berbeda_
  - _Requirements: 2.4, 3.2, 3.3_

---

### Orang C — Next.js Frontend

> **Catatan**: Task Next.js bisa mulai dikerjakan paralel dengan task Backend.
> Untuk testing integrasinya, tunggu task 7–11 selesai terlebih dahulu.

- [x] 12. [Next.js] Buat komponen `ArticleDetailTabs`
  - Buat file `frontend/src/components/articles/ArticleDetailTabs.tsx`
  - Implementasi sesuai design.md Section 9 (kode sudah lengkap di design):
    - Tab 1 "Ringkasan": render `ai_summary` (parse JSON → array 3 poin, tampilkan sebagai `<ol>`)
    - Tab 2 "Ulasan & Sentimen": render `ai_review` + Badge sentimen (Positif/Netral/Negatif dengan warna) + Badge topik
    - Tab 3 "Caption Instagram": render `ai_caption_social` dalam `<pre>` + tombol "Salin ke clipboard"
    - Tab 4 "Draft Berita": render `ai_caption_web` (parse JSON → `{ judul, paragraf[] }`)
  - Handle JSON parse error dengan graceful fallback (try-catch di setiap parse)
  - Gunakan komponen shadcn/ui: `Tabs`, `Card`, `Badge` (lihat design.md)
  - _Requirements: 2.10_

- [x] 13. [Next.js] Buat/update halaman Login
  - Buat/update `frontend/src/app/(auth)/login/page.tsx`
  - Form dengan field email/username dan password
  - On submit: `POST /api/auth/login` → simpan `access_token` ke `localStorage`
  - Redirect ke `/dashboard` setelah login berhasil
  - Tampilkan error message jika login gagal
  - _Requirements: 2.11, 3.1_

- [x] 14. [Next.js] Buat/update halaman Dashboard Statistik
  - Buat/update `frontend/src/app/(dashboard)/dashboard/page.tsx`
  - Fetch `GET /api/dashboard` dengan Authorization header
  - Tampilkan: total kliping, distribusi sentimen (Positif/Netral/Negatif), topik teratas
  - Data bisa statis/dari DB — tidak perlu chart library kompleks, tabel atau card sudah cukup
  - _Requirements: 2.11, 3.7_

- [x] 15. [Next.js] Buat/update halaman Form Input Kliping
  - Buat/update `frontend/src/app/(dashboard)/input/page.tsx`
  - Implementasi sesuai design.md Section 9 (kode sudah lengkap di design):
    - Tab "Link Berita": field judul (opsional) + URL, submit `{ source_type: 'url', source_url }`
    - Tab "Paste Teks": field judul + textarea, submit `{ source_type: 'text', extracted_text }`
  - Loading state dengan spinner + text "Memproses AI... (5-15 detik)" selama request berlangsung
  - Setelah sukses: redirect ke `/arsip?highlight={data.id}`
  - Tampilkan error message jika request gagal
  - _Requirements: 2.11, 2.2_

- [x] 16. [Next.js] Buat/update halaman Arsip
  - Buat/update `frontend/src/app/(dashboard)/arsip/page.tsx`
  - Fetch `GET /api/articles?page=1&limit=20` dengan Authorization header
  - Tampilkan tabel daftar kliping (kolom: judul, sentimen, topik, tanggal)
  - Ketika row diklik: tampilkan `ArticleDetailTabs` untuk artikel tersebut (modal atau panel samping)
  - Support query param `?highlight={id}` untuk highlight artikel yang baru diproses
  - _Requirements: 2.10, 2.11, 3.8_

- [x] 17. [Next.js] Buat/update `(dashboard)/layout.tsx` — Sidebar Navigasi
  - Buat/update `frontend/src/app/(dashboard)/layout.tsx`
  - Sidebar dengan 3 link navigasi: Dashboard, Input Kliping, Arsip
  - Auth guard: cek `localStorage.access_token`, redirect ke `/login` jika tidak ada
  - _Requirements: 2.11_

---

## Phase 3 — Verification (setelah semua implementasi selesai)

- [ ] 18. Verifikasi bug condition exploration test sekarang LULUS
  - **Property 1: Expected Behavior** - Single-Shot Pipeline & Redis-Free Startup
  - **PENTING**: Jalankan ulang test yang SAMA dari task 1 — jangan tulis test baru
  - Test A: Start NestJS tanpa Redis → HARUS berhasil start (tidak crash)
  - Test B: FastAPI startup → HARUS < 3 detik
  - Test C: POST `/api/articles` → HARUS mengembalikan semua 6 field AI dalam satu response
  - Test D: Submit artikel → status HARUS `aktif` setelah response diterima
  - **EXPECTED OUTCOME**: Semua test LULUS — bug terkonfirmasi fixed
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 2.8, 2.9_

- [ ] 19. Verifikasi preservation tests masih LULUS
  - **Property 2: Preservation** - Auth, Scraping, dan DB Write Tetap Berjalan
  - **PENTING**: Jalankan ulang test yang SAMA dari task 2 — jangan tulis test baru
  - Login JWT: `POST /api/v1/auth/login` dengan credential valid → HARUS return token
  - Role check: token `admin` → bisa POST artikel; token `viewer` → 403 di endpoint write
  - Scraping: URL berita valid → teks terekstrak (trafilatura/BS4 tidak diubah)
  - DB write: artikel tersimpan di `news_clippings` dengan semua field
  - Health: FastAPI `GET /api/v1/health` → `200 OK`; NestJS health → `200 OK`
  - **EXPECTED OUTCOME**: Semua test LULUS — tidak ada regresi
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.9, 3.10_

- [ ] 20. Checkpoint — Verifikasi end-to-end flow
  - Pastikan semua service berjalan: FastAPI, NestJS, PostgreSQL
  - **Skenario 1 — URL**: Login → Input halaman → masukkan URL berita valid → klik "Proses dengan AI" → tunggu 5-15 detik → redirect ke Arsip → verifikasi artikel muncul dengan 4 tab terisi
  - **Skenario 2 — Teks**: Login → Input halaman → tab "Paste Teks" → paste teks berita → klik "Proses" → verifikasi semua 6 output AI muncul di tab
  - **Skenario 3 — Dashboard**: Buka `/dashboard` → verifikasi statistik muncul (tidak blank/error)
  - **Skenario 4 — Viewer restriction**: Login sebagai user dengan role `viewer` → coba POST artikel → verifikasi 403
  - Pastikan semua test dari task 18 dan 19 LULUS
  - Jika ada pertanyaan atau issue, diskusikan dengan tim sebelum dianggap selesai

## Notes

- **Urutan wajib antar fase**: Phase 1 (task 1–2) dijalankan SEBELUM Phase 2 dimulai. Phase 3 (task 18–20) dijalankan SETELAH semua task Phase 2 selesai.
- **Paralel dalam Phase 2**: Orang A (task 3–6), Orang B (task 7–11), dan Orang C (task 12–17) bisa dikerjakan bersamaan.
- **Dependensi internal Orang B**: Task 7 (Database Migration) harus selesai sebelum task 9, 10, dan 11 ditest secara integrated. Task 8 tidak bergantung ke 7.
- **Testing per task**: Setiap task punya langkah verifikasi sendiri di deskripsinya. Lakukan verifikasi tersebut sebelum menandai task sebagai selesai (checklist `[x]`).
- **GEMINI_API_KEY**: Pastikan environment variable ini sudah dikonfigurasi di `.env` sebelum test FastAPI pipeline.
- **DB fresh vs existing**: Migration task 7 aman dijalankan di DB development. Jangan jalankan di DB production yang sudah berisi data penting di tabel workflow/permissions.
- **Property 1 & 2**: Task 1 dan 2 adalah property-based test — dijalankan DUA KALI: sekali di kode original (Phase 1, expected: task 1 FAIL, task 2 PASS), sekali setelah fix (Phase 3, expected: keduanya PASS).
