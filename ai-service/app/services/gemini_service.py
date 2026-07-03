"""
gemini_service.py
-----------------
Thin async wrapper around the Gemini 2.5 Flash REST API.
Used for:
  - Article summarisation (called from response_formatter)
  - Chatbot / Quick Ask endpoint
"""
from __future__ import annotations

import os
import logging

import httpx

logger = logging.getLogger(__name__)

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

_SUMMARISE_SYSTEM = (
    "Kamu adalah Asisten Editor Ahli untuk Humas DPRD. "
    "Tugasmu: buat ringkasan berita yang sangat padat, objektif, dan terstruktur. "
    "Langsung ke poin utama (siapa, apa, mengapa, dampak). Hindari basa-basi atau pengulangan. "
    "Maksimal 3-5 kalimat singkat namun sangat komprehensif."
)

_CHAT_SYSTEM = (
    "Kamu adalah Konsultan AI Senior untuk NewsMind, platform analitik berita Humas DPRD. "
    "Selalu berikan jawaban yang cerdas, profesional, analitis, dan solutif. "
    "Jika diminta membuat draft atau analisis, sajikan dalam format yang mudah dibaca (gunakan bullet points jika perlu). "
    "Tunjukkan pemahaman mendalam tentang pemerintahan daerah dan media relations."
)


def _build_payload(system_instruction: str, user_message: str, temperature: float = 0.4) -> dict:
    return {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 1024,
            "topP": 0.9,
        },
    }


def _call_gemini(payload: dict) -> str:
    """Synchronous Gemini call (runs in FastAPI thread-pool via pipeline routes)."""
    if not _GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    url = f"{_BASE_URL}?key={_GEMINI_API_KEY}"
    with httpx.Client(timeout=60) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Gemini response structure: %s", data)
        raise RuntimeError("Failed to parse Gemini response") from exc


def _call_nvidia_chat(system_instruction: str, history: list[dict], user_message: str, temperature: float = 0.6) -> str:
    from openai import OpenAI
    nvidia_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not nvidia_key:
        raise ValueError("NVIDIA_API_KEY tidak dikonfigurasi")

    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=nvidia_key
    )

    messages = [{"role": "system", "content": system_instruction}]
    for msg in history:
        # Convert Gemini history format to OpenAI format
        role = "assistant" if msg["role"] == "model" else "user"
        content = msg["parts"][0]["text"]
        messages.append({"role": role, "content": content})
    
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",
        messages=messages,
        temperature=temperature,
        max_tokens=800,
    )
    return response.choices[0].message.content.strip()


# --------------------------------------------------------------------------- #
# Public helpers                                                               #
# --------------------------------------------------------------------------- #
def gemini_summarise(article_text: str) -> str:
    """Summarise a full article body using Gemini 2.5 Flash."""
    if not _GEMINI_API_KEY or not article_text.strip():
        # Graceful degradation: return first 3 sentences
        import re
        sentences = re.split(r"(?<=[.!?])\s+", article_text)
        return " ".join(sentences[:3]) or article_text[:300]

    # Feed at most 12 000 chars to stay within a fast inference window
    truncated = article_text[:12_000]
    prompt = (
        f"Berikut adalah teks berita yang sudah diekstrak:\n\n{truncated}\n\n"
        "Buatkan ringkasan yang informatif, akurat, dan padat dalam 4–6 kalimat."
    )
    try:
        return _call_gemini(_build_payload(_SUMMARISE_SYSTEM, prompt, temperature=0.3))
    except Exception as gemini_exc:
        logger.warning("Gemini summarise failed, trying NVIDIA fallback: %s", gemini_exc)
        try:
            return _call_nvidia_chat(_SUMMARISE_SYSTEM, [], prompt, temperature=0.3)
        except Exception as nvidia_exc:
            logger.error("NVIDIA summarise fallback failed: %s", nvidia_exc)
            import re
            sentences = re.split(r"(?<=[.!?])\s+", article_text)
            return " ".join(sentences[:3]) or article_text[:300]


def gemini_chat(history: list[dict], user_message: str) -> str:
    """
    Stateless chat call.  `history` is a list of {"role": "user"|"model", "parts": [{"text": "..."}]}.
    Returns the assistant reply string.
    """
    if not _GEMINI_API_KEY:
        return (
            "Maaf, AI Service belum terkonfigurasi (GEMINI_API_KEY belum diset). "
            "Silakan hubungi administrator sistem."
        )

    # Build multi-turn contents
    contents = list(history) + [{"role": "user", "parts": [{"text": user_message}]}]
    payload = {
        "system_instruction": {"parts": [{"text": _CHAT_SYSTEM}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": 800,
            "topP": 0.95,
        },
    }
    try:
        url = f"{_BASE_URL}?key={_GEMINI_API_KEY}"
        with httpx.Client(timeout=60) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as gemini_exc:
        logger.warning("Gemini chat failed, trying NVIDIA fallback: %s", gemini_exc)
        try:
            return _call_nvidia_chat(_CHAT_SYSTEM, history, user_message, temperature=0.6)
        except Exception as nvidia_exc:
            logger.error("NVIDIA chat fallback failed: %s", nvidia_exc)
            return "Maaf, terjadi kesalahan pada semua provider AI (Gemini & NVIDIA). Coba lagi sebentar ya!"
