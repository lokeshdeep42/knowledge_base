NOTE = {"type": "note", "content": "Kubernetes pods are scheduled onto nodes by the scheduler.\nMore detail."}


def ingest_note(client, content: str, **extra):
    response = client.post("/ingest", json={"type": "note", "content": content, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def assert_error(response, status: int, code: str):
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert body["error"]["message"]
    return body["error"]["message"]


def test_health_reports_state(client, client_without_llm):
    assert client.get("/health").json() == {"status": "ok", "llm_configured": True, "items": 0}
    assert client_without_llm.get("/health").json()["llm_configured"] is False


def test_ingest_note_returns_item(client):
    item = client.post("/ingest", json=NOTE)
    assert item.status_code == 201
    body = item.json()
    assert body["source_type"] == "note"
    assert body["title"] == "Kubernetes pods are scheduled onto nodes by the scheduler."
    assert body["url"] is None
    assert body["preview"].endswith("More detail.")
    assert body["chunk_count"] == 1
    assert body["created_at"].endswith("Z")
    assert item.headers["X-Request-ID"]


def test_note_title_override_and_truncation(client):
    assert ingest_note(client, "x" * 200)["title"] == "x" * 80
    assert ingest_note(client, "body", title="Custom")["title"] == "Custom"


def test_items_listed_newest_first(client):
    first = ingest_note(client, "first note")
    second = ingest_note(client, "second note")
    ids = [i["id"] for i in client.get("/items").json()["items"]]
    assert ids == [second["id"], first["id"]]
    assert client.get("/health").json()["items"] == 2


def test_ingest_url_uses_fetcher(client):
    response = client.post("/ingest", json={"type": "url", "url": "https://example.com/rust"})
    assert response.status_code == 201
    body = response.json()
    assert (body["source_type"], body["title"], body["url"]) == ("url", "Fetched page", "https://example.com/rust")


def test_blocked_private_url_is_rejected(tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import FakeEmbedder, make_settings

    with TestClient(create_app(make_settings(tmp_path), embedder=FakeEmbedder())) as real_fetcher_client:
        for url in ("http://127.0.0.1/admin", "http://169.254.169.254/latest", "http://[::1]/"):
            assert_error(real_fetcher_client.post("/ingest", json={"type": "url", "url": url}), 422, "blocked_url")


def test_validation_errors_use_error_shape(client):
    message = assert_error(client.post("/ingest", json={"type": "note", "content": "   "}), 422, "validation_error")
    assert message.startswith("content:")
    assert_error(client.post("/ingest", json={"type": "url", "url": "ftp://x.com"}), 422, "validation_error")
    assert_error(client.post("/ingest", json={"type": "other"}), 422, "validation_error")
    assert_error(client.post("/query", json={"question": "q", "top_k": 11}), 422, "validation_error")


def test_query_returns_cited_sources_and_answer(client, generator):
    kube = ingest_note(client, "Kubernetes schedules pods onto cluster nodes")
    ingest_note(client, "Sourdough bread needs flour water and salt")
    response = client.post("/query", json={"question": "How does Kubernetes schedule pods?", "top_k": 3})
    assert response.status_code == 200
    body = response.json()
    assert body["llm_configured"] is True
    top = body["sources"][0]
    assert top["citation"] == 1 and top["item_id"] == kube["id"]
    assert top["snippet"] == "Kubernetes schedules pods onto cluster nodes"
    assert top["score"] == round(top["score"], 3) > 0.2
    assert all(s["item_id"] != "" for s in body["sources"])
    assert body["answer"] == "The answer is in " + " ".join(f"[{s['citation']}]" for s in body["sources"])
    assert generator.calls[0][0] == "How does Kubernetes schedule pods?"


def test_query_filters_low_scores(client):
    ingest_note(client, "Sourdough bread needs flour water and salt")
    body = client.post("/query", json={"question": "quantum chromodynamics"}).json()
    assert body == {"answer": None, "llm_configured": True, "sources": []}


def test_query_without_llm_returns_sources_only(client_without_llm):
    ingest_note(client_without_llm, "Kubernetes schedules pods onto cluster nodes")
    body = client_without_llm.post("/query", json={"question": "Kubernetes pods"}).json()
    assert body["answer"] is None
    assert body["llm_configured"] is False
    assert len(body["sources"]) == 1


def test_query_on_empty_inbox(client):
    assert client.post("/query", json={"question": "anything"}).json() == {
        "answer": None,
        "llm_configured": True,
        "sources": [],
    }


def test_index_is_rebuilt_from_database(tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import FakeEmbedder, make_settings

    settings = make_settings(tmp_path)
    with TestClient(create_app(settings, embedder=FakeEmbedder())) as first:
        ingest_note(first, "Kubernetes schedules pods onto cluster nodes")
    with TestClient(create_app(settings, embedder=FakeEmbedder())) as second:
        assert len(second.post("/query", json={"question": "Kubernetes pods"}).json()["sources"]) == 1
