from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
import trafilatura
from trafilatura.settings import use_config

from bs4 import BeautifulSoup, Comment


# --------------------------------------------------------------------------- #
# Trafilatura config — aggressive ad / nav / comment filtering                #
# --------------------------------------------------------------------------- #
_traf_config = use_config()
_traf_config.set("DEFAULT", "MIN_EXTRACTED_SIZE", "400")
_traf_config.set("DEFAULT", "MIN_OUTPUT_SIZE", "200")
_traf_config.set("DEFAULT", "EXTRACTION_TIMEOUT", "30")

# Tags to strip before BS4 fallback
_NOISE_TAGS = {
    "script", "style", "noscript", "nav", "header", "footer", "aside",
    "form", "button", "figure", "figcaption", "iframe", "ins",
    "advertisement", "ads", "ad",
}

# CSS class / id substrings that almost always mean "not content"
_NOISE_PATTERNS = re.compile(
    r"(ads?|iklan|sponsor|promo|sidebar|widget|related|recommend|newsletter"
    r"|popup|banner|nav|footer|header|social|share|comment|pagination"
    r"|breadcrumb|tag|label|meta|category|aside)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ScrapeResult:
    content: str
    method: str
    status: str


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def _fetch_html(url: str) -> str | None:
    """Download raw HTML, follow pagination if needed."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    }
    try:
        with httpx.Client(follow_redirects=True, timeout=30) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text
    except Exception:
        # Fallback: let trafilatura handle it
        return trafilatura.fetch_url(url)


def _collect_paginated_html(url: str, base_html: str) -> str:
    """
    Try to follow a 'next page' link (Detik, Kompas, Tribun, etc.) and
    concatenate body text from all pages.  Maximum 5 pages to be safe.
    """
    combined = base_html
    visited = {url}
    current_url = url

    for _ in range(4):  # up to 4 extra pages
        soup = BeautifulSoup(combined, "html.parser")
        # Common next-page link patterns used by Indonesian news sites
        next_link = (
            soup.find("a", rel="next")
            or soup.find("a", string=re.compile(r"(selanjutnya|next|halaman\s*\d+|»|\>)", re.I))
            or soup.find("a", class_=re.compile(r"(next|pagination-next|paging-next)", re.I))
        )
        if not next_link:
            break
        next_href = next_link.get("href", "")
        if not next_href or next_href in visited:
            break
        if not next_href.startswith("http"):
            from urllib.parse import urljoin
            next_href = urljoin(current_url, next_href)

        page_html = _fetch_html(next_href)
        if not page_html:
            break
        visited.add(next_href)
        current_url = next_href
        # Only append the body — we don't need another <head>
        page_soup = BeautifulSoup(page_html, "html.parser")
        body = page_soup.find("body")
        if body:
            combined += str(body)

    return combined


def _clean_bs4(html: str) -> str:
    """
    BS4 fallback: strip noise elements then extract <p> text from the
    most article-like container found.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Remove HTML comments
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    # Remove obvious noise tags
    for tag in soup.find_all(_NOISE_TAGS):
        tag.decompose()

    # Remove elements whose class/id strongly suggests they are not content
    for tag in soup.find_all(True):
        classes = " ".join(tag.get("class", []))
        tag_id = tag.get("id", "")
        if _NOISE_PATTERNS.search(classes) or _NOISE_PATTERNS.search(tag_id):
            tag.decompose()

    # Find the best content container
    candidates = [
        soup.find("article"),
        soup.find(class_=re.compile(r"(content|body|article|post|entry|detail)", re.I)),
        soup.find(id=re.compile(r"(content|body|article|post|entry|detail)", re.I)),
        soup.body,
        soup,
    ]
    container = next((c for c in candidates if c), soup)

    paragraphs = [
        p.get_text(" ", strip=True)
        for p in container.find_all("p")
        if len(p.get_text(strip=True)) > 40  # skip tiny / nav <p> elements
    ]
    return "\n\n".join(paragraphs).strip()


# --------------------------------------------------------------------------- #
# Public API                                                                   #
# --------------------------------------------------------------------------- #
def extract_article_text(url: str) -> ScrapeResult:
    # 1. Fetch HTML
    html = _fetch_html(url)
    if not html:
        return ScrapeResult(content="", method="fallback_failed", status="extraction_failed")

    # 2. Follow pagination (concatenate pages)
    full_html = _collect_paginated_html(url, html)

    # 3. Try trafilatura first (best at filtering ads / nav)
    extracted = trafilatura.extract(
        full_html,
        include_comments=False,
        include_tables=False,
        no_fallback=False,
        favor_precision=False,
        favor_recall=True,   # capture more body text
        config=_traf_config,
    )
    if extracted and len(extracted.strip()) > 200:
        return ScrapeResult(content=extracted.strip(), method="trafilatura", status="ok")

    # 4. BS4 fallback
    cleaned = _clean_bs4(full_html)
    if cleaned and len(cleaned) > 100:
        return ScrapeResult(content=cleaned, method="beautifulsoup", status="ok")

    return ScrapeResult(content="", method="fallback_failed", status="extraction_failed")
