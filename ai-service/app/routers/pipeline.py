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

from app.services.gemini_service import gemini_chat

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
pemerintah daerah. Gunakan Bahasa Indonesia yang natural, mengalir, sangat cerdas dan tajam, layaknya seorang PR/Humas elit.

ATURAN WAJIB:
1. ringkasan: array TEPAT 3 string, masing-masing satu poin penting (masalah inti, aktor yang terlibat, dampak nyata) dengan sangat informatif.
2. ulasan: 1 paragraf (3-5 kalimat) analisis strategis mengenai sentimen media, citra DPRD, dan rekomendasi aksi/tanggapan.
3. sentimen: HANYA salah satu dari: "Positif", "Netral", "Negatif"
4. topik: array 1-2 topik dari daftar berikut SAJA (jangan buat topik baru):
   {", ".join(_TOPIK_LIST)}
5. caption_instagram: 1 teks caption siap posting yang sangat engaging, informatif, ramah, (150-250 karakter) + 5-7 hashtag. Format: teks caption\n\n#hashtag1 #hashtag2 ...
6. draft_berita: object dengan "judul" (menarik, persuasif, maks 12 kata) dan "paragraf" (array
   TEPAT 3 string, bahasa jurnalistik kelas atas yang mengalir natural, 80-120 kata per paragraf, dengan kutipan simulasi jika memungkinkan).

PASTIKAN SEMUA FIELD TERISI LENGKAP. Kualitas narasi harus luar biasa dan siap cetak.
""".strip()

_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "ringkasan": {
            "type": "array",
            "items": {"type": "string"},
        },
        "ulasan": {"type": "string"},
        "sentimen": {"type": "string", "enum": ["Positif", "Netral", "Negatif"]},
        "topik": {
            "type": "array",
            "items": {"type": "string"},
        },
        "caption_instagram": {"type": "string"},
        "draft_berita": {
            "type": "object",
            "properties": {
                "judul": {"type": "string"},
                "paragraf": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["judul", "paragraf"],
        },
    },
    "required": ["ringkasan", "ulasan", "sentimen", "topik",
                 "caption_instagram", "draft_berita"],
}


# ── Chat models (existing /chat endpoint) ────────────────────────────────── #
class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


# ── Analyze request / response models ────────────────────────────────────── #
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
            max_output_tokens=8192,
            response_mime_type="application/json",
            response_schema=_OUTPUT_SCHEMA,
        ),
    )

    truncated = article_text[:12_000]
    prompt = f"Analisis berita berikut dan hasilkan 6 output sesuai instruksi:\n\n{truncated}"

    try:
        response = model.generate_content(prompt)
        import json
        return json.loads(response.text)
    except Exception as exc:
        logger.error("Gemini call failed: %s", exc)
        raise HTTPException(status_code=502,
                            detail=f"Gagal memanggil Gemini: {exc}") from exc


def _call_nvidia(article_text: str) -> dict:
    """Call NVIDIA NIM (meta/llama-3.1-70b-instruct) as a fallback."""
    import json
    from openai import OpenAI

    nvidia_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not nvidia_key:
        raise ValueError("NVIDIA_API_KEY belum dikonfigurasi untuk fallback")

    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=nvidia_key
    )

    truncated = article_text[:12_000]
    prompt = (
        f"Analisis berita berikut dan hasilkan 6 output sesuai instruksi.\n"
        f"PENTING: Output Anda HARUS berupa JSON murni tanpa markdown (tanpa ```json).\n\n"
        f"{truncated}"
    )

    response = client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    raw_content = response.choices[0].message.content or "{}"
    # Bersihkan markdown formatting jika AI menambahkannya
    import re
    cleaned = re.sub(r"^```json\s*", "", raw_content)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    
    return json.loads(cleaned)


# ── Routes ────────────────────────────────────────────────────────────────── #
@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(payload: ChatRequest):
    """Stateless chat endpoint backed by Gemini 2.5 Flash."""
    # Convert frontend history format to Gemini contents format
    gemini_history = [
        {"role": msg.role, "parts": [{"text": msg.content}]}
        for msg in payload.history
    ]
    reply = gemini_chat(gemini_history, payload.message)
    return ChatResponse(reply=reply)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_article(payload: AnalyzeRequest) -> AnalyzeResponse:
    """
    Single-shot analysis: scrape (if URL) → Gemini 2.5 Flash (fallback to NVIDIA) → return 6 outputs.
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

    # 2. Call AI with fallback
    model_used = _MODEL_NAME
    try:
        result = _call_gemini(article_text)
    except Exception as gemini_exc:
        logger.warning("Gemini failed, trying NVIDIA NIM fallback... (%s)", gemini_exc)
        try:
            result = _call_nvidia(article_text)
            model_used = "meta/llama-3.1-70b-instruct (NVIDIA)"
        except Exception as nvidia_exc:
            logger.error("NVIDIA fallback also failed: %s", nvidia_exc)
            raise HTTPException(
                status_code=502,
                detail=f"Semua AI provider gagal. Gemini: {gemini_exc} | NVIDIA: {nvidia_exc}"
            )

    # 3. Return structured response
    return AnalyzeResponse(
        article_id=payload.article_id,
        ringkasan=result["ringkasan"],
        ulasan=result["ulasan"],
        sentimen=result["sentimen"],
        topik=result["topik"],
        caption_instagram=result["caption_instagram"],
        draft_berita=DraftBerita(**result["draft_berita"]),
        model=model_used,
    )
