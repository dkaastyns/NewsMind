# Bugfix Requirements Document

## Introduction

Sistem NewsMind saat ini berjalan secara fungsional dasar namun terlalu berat untuk di-deploy di server gratisan dan terlalu kompleks untuk tim 3 magang. Masalah utama terdiri dari: (1) Approval Workflow 2-level yang tidak diperlukan untuk demo, (2) RBAC dengan 3 role + tabel permissions/role_permissions yang over-engineered, (3) BullMQ async queue dengan 4 queue terpisah yang membutuhkan Redis dan sangat berat, (4) Semantic Router dengan 3 AI provider + fallback chain yang over-engineering untuk MVP demo, dan (5) pgvector embedding yang belum stabil di production. Efeknya adalah sistem tidak bisa berjalan di server gratisan (Railway, Render, Fly.io free tier), startup lambat karena Redis + BullMQ + semantic-router initialization, dan terlalu sulit dipahami tim magang. Target perbaikan adalah sistem yang ringan, stabil, bisa demo hari ini, dan dipahami oleh 3 orang magang.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN sistem dijalankan di environment server gratisan (tanpa Redis) THEN sistem crash karena BullMQ membutuhkan koneksi Redis yang tidak tersedia

1.2 WHEN artikel baru disubmit melalui frontend THEN sistem tidak langsung memberikan response karena semua AI processing dimasukkan ke BullMQ async queue yang membutuhkan worker terpisah berjalan

1.3 WHEN FastAPI AI service di-start THEN semantic_router melakukan inisialisasi FastEmbedEncoder + SemanticRouter yang memakan waktu lama (10-30 detik) dan membutuhkan resource besar di server gratis

1.4 WHEN user mencoba login dengan role apapun THEN sistem mengecek tabel `permissions` dan `role_permissions` yang membutuhkan join query kompleks walau hanya 2 role sederhana yang dibutuhkan

1.5 WHEN konten berhasil di-generate AI THEN konten masuk ke approval workflow 2-level (`pending_review → reviewed → approved`) yang tidak diperlukan untuk demo dan membingungkan tim magang

1.6 WHEN modul WorkflowModule, ContentGenModule, NotificationsModule, EmbeddingProcessor, ContentGenProcessor, NotificationProcessor di-load oleh NestJS THEN app.module.ts menjadi berat dan lambat startup tanpa benefit untuk demo

1.7 WHEN AI service dipanggil THEN semantic router memanggil salah satu dari 3 provider (Gemini, NVIDIA, OpenRouter) berdasarkan routing logic kompleks, namun NVIDIA dan OpenRouter seringkali tidak terkonfigurasi, menyebabkan fallback error yang tidak informatif

1.8 WHEN artikel diproses THEN response_formatter.py menggunakan keyword-based sentiment analysis dan topic classification yang menghasilkan output tidak akurat, bukan menggunakan Gemini untuk analisis komprehensif

1.9 WHEN frontend menampilkan hasil AI THEN data yang ditampilkan hanya `summary` sedangkan field penting seperti `ai_review`, `ai_sentiment`, `ai_topic`, `ai_caption_social`, `ai_caption_web` yang sudah ada di tabel `news_clippings` tidak ditampilkan

1.10 WHEN halaman workflow, generate-konten, dan pengguna diakses THEN halaman tersebut ada di frontend tapi tidak memiliki fungsi nyata untuk demo dan menambah kompleksitas navigasi

### Expected Behavior (Correct)

2.1 WHEN sistem dijalankan di environment server gratisan (tanpa Redis) THEN sistem SHALL berjalan normal karena tidak ada dependency Redis/BullMQ — semua AI processing dilakukan secara sinkron langsung di HTTP request

2.2 WHEN artikel baru disubmit melalui frontend THEN sistem SHALL langsung return response berisi hasil analisis AI lengkap (ringkasan, sentimen, topik, caption, draft berita) dalam satu HTTP request sinkron ke FastAPI

2.3 WHEN FastAPI AI service di-start THEN sistem SHALL start dalam waktu kurang dari 3 detik karena tidak ada SemanticRouter/FastEmbedEncoder initialization — langsung gunakan single Gemini endpoint

2.4 WHEN user login dengan role `admin` atau `viewer` THEN sistem SHALL mengecek role langsung dari kolom `role` di tabel `users` tanpa join ke tabel permissions/role_permissions yang sudah dihapus

2.5 WHEN konten berhasil di-generate AI THEN sistem SHALL langsung menyimpan dengan status `aktif` tanpa melewati approval workflow — konten bisa langsung dilihat di tabel arsip

2.6 WHEN NestJS app module di-load THEN sistem SHALL hanya memuat modul yang dibutuhkan: Auth, Users, Articles, Archive, Dashboard, AiProxy, Database, Health — tanpa WorkflowModule, ContentGenModule, NotificationsModule, QueueModule

2.7 WHEN AI service dipanggil dengan URL berita atau teks PDF THEN sistem SHALL memanggil Gemini 2.5 Flash dengan single-shot system prompt yang menghasilkan JSON berisi semua 6 output (ringkasan 3 poin 5W+1H, ulasan dampak citra, sentimen, topik maks 2, caption Instagram, draft berita website) sekaligus

2.8 WHEN Gemini 2.5 Flash dipanggil THEN sistem SHALL menggunakan `response_mime_type: "application/json"` agar output JSON terkunci dan tidak perlu parsing kompleks

2.9 WHEN hasil AI diterima oleh NestJS THEN sistem SHALL langsung menyimpan semua field ke tabel `news_clippings` (ai_summary, ai_review, ai_sentiment, ai_topic, ai_caption_social, ai_caption_web) dan update status ke `aktif`

2.10 WHEN frontend menampilkan detail kliping THEN sistem SHALL menampilkan semua hasil analisis AI dalam komponen tab atau card: Tab 1 (Ringkasan), Tab 2 (Ulasan & Sentimen), Tab 3 (Caption Instagram), Tab 4 (Draft Berita Website)

2.11 WHEN user mengakses aplikasi THEN frontend SHALL hanya menampilkan 4 halaman: Dashboard Statistik, Form Input Kliping (Link/PDF + tombol Proses AI), Tabel Arsip dengan semua hasil AI, Login — tanpa halaman workflow/pengguna/generate-konten terpisah

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user melakukan login dengan username dan password yang valid THEN sistem SHALL CONTINUE TO mengautentikasi user dan mengembalikan JWT token yang valid

3.2 WHEN user dengan role `admin` mengakses endpoint yang membutuhkan autentikasi THEN sistem SHALL CONTINUE TO memvalidasi JWT token dan mengizinkan akses

3.3 WHEN user dengan role `viewer` mengakses endpoint write/create THEN sistem SHALL CONTINUE TO menolak akses dengan HTTP 403

3.4 WHEN URL berita valid disubmit ke AI service THEN sistem SHALL CONTINUE TO melakukan web scraping menggunakan trafilatura/BeautifulSoup untuk mengekstrak teks artikel

3.5 WHEN file PDF diupload THEN sistem SHALL CONTINUE TO mengekstrak teks dari PDF menggunakan PyMuPDF/pdfplumber sebelum dikirim ke Gemini

3.6 WHEN artikel berhasil diproses THEN sistem SHALL CONTINUE TO menyimpan data ke tabel `news_clippings` di PostgreSQL dengan semua field yang relevan

3.7 WHEN user mengakses halaman Dashboard THEN sistem SHALL CONTINUE TO menampilkan statistik (jumlah kliping, sentimen, topik teratas) meski data masih statis/dari DB

3.8 WHEN user mengakses halaman Arsip THEN sistem SHALL CONTINUE TO menampilkan tabel semua kliping yang sudah diproses dengan kemampuan filter dan pencarian

3.9 WHEN FastAPI health endpoint dipanggil (`GET /api/v1/health`) THEN sistem SHALL CONTINUE TO mengembalikan status healthy

3.10 WHEN NestJS health endpoint dipanggil THEN sistem SHALL CONTINUE TO mengembalikan status healthy

3.11 WHEN kolom `embedding` tetap ada di skema database THEN sistem SHALL CONTINUE TO tidak error karena kolom tersebut dibiarkan ada tapi tidak aktif diisi (nullable, tidak ada worker yang mengisi)
