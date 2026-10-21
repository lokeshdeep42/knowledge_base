import httpx
import pytest
import respx

from app.errors import EmptyContentError, FetchFailedError, UnsupportedContentError
from app.services import fetcher as fetcher_module
from app.services.fetcher import HttpUrlFetcher, extract_readable_text

URL = "https://example.com/post"


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    async def always_public(host: str) -> bool:
        return True

    monkeypatch.setattr(fetcher_module, "_resolves_to_public_ip", always_public)


def test_extract_drops_chrome_and_collapses_whitespace():
    html = (
        "<html><head><title> My  Page </title><style>p{}</style></head><body>"
        "<nav>Menu</nav><header>Head</header><p>Hello   <b>world</b></p>"
        "<script>alert(1)</script><p>Second</p><footer>Foot</footer></body></html>"
    )
    page = extract_readable_text(html, "fallback")
    assert page.title == "My Page"
    assert page.text == "Hello world\n\nSecond"


@respx.mock
async def test_fetches_html():
    respx.get(URL).respond(200, html="<title>T</title><p>Body text</p>")
    page = await HttpUrlFetcher().fetch(URL)
    assert (page.title, page.text) == ("T", "Body text")


@respx.mock
async def test_plain_text_and_unsupported_type():
    respx.get(URL).respond(200, text="just text", headers={"content-type": "text/plain"})
    assert (await HttpUrlFetcher().fetch(URL)).text == "just text"
    respx.get(URL).respond(200, content=b"%PDF", headers={"content-type": "application/pdf"})
    with pytest.raises(UnsupportedContentError):
        await HttpUrlFetcher().fetch(URL)


@respx.mock
async def test_empty_page_and_upstream_errors():
    respx.get(URL).respond(200, html="<script>x</script>")
    with pytest.raises(EmptyContentError):
        await HttpUrlFetcher().fetch(URL)
    respx.get(URL).respond(404)
    with pytest.raises(FetchFailedError, match="404"):
        await HttpUrlFetcher().fetch(URL)
    respx.get(URL).mock(side_effect=httpx.ConnectTimeout("slow"))
    with pytest.raises(FetchFailedError, match="timed out"):
        await HttpUrlFetcher().fetch(URL)


@respx.mock
async def test_user_agent_includes_contact_when_configured():
    route = respx.get(URL).respond(200, html="<p>Body</p>")
    await HttpUrlFetcher("https://github.com/me/inbox").fetch(URL)
    assert route.calls.last.request.headers["user-agent"] == "KnowledgeInbox/1.0 (+https://github.com/me/inbox)"
