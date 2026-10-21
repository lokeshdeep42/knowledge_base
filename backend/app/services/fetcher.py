import asyncio
import ipaddress
import logging
import socket
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.errors import BlockedUrlError, EmptyContentError, FetchFailedError, UnsupportedContentError

logger = logging.getLogger(__name__)

MAX_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 10.0
USER_AGENT = "KnowledgeInbox/1.0"
_HTML_TYPES = {"text/html", "application/xhtml+xml"}
_NOISE_TAGS = ["head", "title", "script", "style", "nav", "footer", "header", "aside", "noscript"]
_BLOCK_TAGS = [
    "p", "div", "section", "article", "main", "li", "pre", "blockquote", "table", "tr", "br",
    "h1", "h2", "h3", "h4", "h5", "h6",
]


@dataclass(frozen=True)
class FetchedPage:
    title: str
    text: str


class UrlFetcher(Protocol):
    async def fetch(self, url: str) -> FetchedPage: ...


def extract_readable_text(html: str, fallback_title: str) -> FetchedPage:
    """Strip page chrome and collapse whitespace; title comes from <title> when present."""
    soup = BeautifulSoup(html, "html.parser")
    title = " ".join(soup.title.get_text().split()) if soup.title else ""
    for tag in soup(_NOISE_TAGS):
        tag.decompose()
    # Break only at block elements so inline tags (<a>, <code>, <em>) stay inside their sentence.
    for tag in soup(_BLOCK_TAGS):
        tag.insert_before("\n\n")
        tag.insert_after("\n\n")
    paragraphs = (" ".join(block.split()) for block in soup.get_text().split("\n\n"))
    text = "\n\n".join(p for p in paragraphs if p)
    return FetchedPage(title=title or fallback_title, text=text)


async def _resolves_to_public_ip(host: str) -> bool:
    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, host, None)
    except socket.gaierror:
        raise FetchFailedError(f"Could not resolve host {host!r}.") from None
    addresses = {ipaddress.ip_address(info[4][0].split("%")[0]) for info in infos}
    return all(addr.is_global for addr in addresses)


async def ensure_public_url(url: str) -> None:
    """SSRF guard: only http(s) URLs whose host resolves exclusively to public addresses."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise BlockedUrlError("Only http and https URLs are allowed.")
    if not await _resolves_to_public_ip(parsed.hostname):
        logger.warning("fetch_blocked", extra={"host": parsed.hostname})
        raise BlockedUrlError("That address points to a private or local network and was blocked.")


class HttpUrlFetcher:
    """Fetches a page server-side with timeouts, a size cap and per-hop SSRF checks."""

    def __init__(self, contact: str | None = None) -> None:
        # Some sites (Wikipedia among them) refuse bots whose User-Agent carries no contact URL or email.
        self._user_agent = f"{USER_AGENT} (+{contact})" if contact else f"{USER_AGENT} (+personal knowledge inbox)"

    async def fetch(self, url: str) -> FetchedPage:
        host = urlparse(url).hostname or ""
        try:
            response_text, content_type = await self._download(url)
        except httpx.HTTPError as exc:
            logger.warning("fetch_failed", extra={"host": host, "reason": type(exc).__name__})
            if isinstance(exc, httpx.TimeoutException):
                raise FetchFailedError("The request timed out.") from exc
            raise FetchFailedError(f"Could not reach the URL ({type(exc).__name__}).") from exc
        except FetchFailedError as exc:
            logger.warning("fetch_failed", extra={"host": host, "reason": exc.message})
            raise

        if content_type in _HTML_TYPES:
            page = extract_readable_text(response_text, fallback_title=url)
        elif content_type == "text/plain":
            page = FetchedPage(title=url, text=response_text.strip())
        else:
            raise UnsupportedContentError(f"Unsupported content type: {content_type or 'unknown'}.")
        if not page.text.strip():
            raise EmptyContentError("No readable text could be extracted from that page.")
        return page

    async def _download(self, url: str) -> tuple[str, str]:
        headers = {"User-Agent": self._user_agent, "Accept": "text/html,text/plain;q=0.9,*/*;q=0.1"}
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, headers=headers) as client:
            for _ in range(MAX_REDIRECTS + 1):
                await ensure_public_url(url)
                async with client.stream("GET", url) as response:
                    if response.is_redirect and (location := response.headers.get("location")):
                        url = urljoin(url, location)
                        continue
                    if response.status_code in (401, 403):
                        raise FetchFailedError(
                            f"The site refused the request (HTTP {response.status_code}); "
                            "it may block automated fetching. Paste the text as a note instead."
                        )
                    if not response.is_success:
                        raise FetchFailedError(f"The server responded with HTTP {response.status_code}.")
                    body = bytearray()
                    async for part in response.aiter_bytes():
                        body.extend(part)
                        if len(body) >= MAX_BYTES:
                            break
                    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                    return bytes(body[:MAX_BYTES]).decode(response.encoding or "utf-8", "replace"), content_type
        raise FetchFailedError("Too many redirects.")
