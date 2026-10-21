# AI Knowledge Inbox

A small personal knowledge base. Save short notes or URLs, ask questions over them, and get answers from a retrieval-augmented (RAG) pipeline with numbered citations back to the source items.

Built as a take-home for Turium.

## Overview

- Save a **note** or a **URL** (fetched and text-extracted server-side). Each item is chunked, embedded locally, and stored.
- Ask a **question**: top-k chunks are retrieved by cosine similarity, filtered by a score threshold, and passed to an LLM that must answer only from that context and cite `[n]`. The response returns the answer and the cited sources.
- Without an LLM API key the app runs in **retrieval-only mode**: `/query` returns ranked snippets with `answer: null` and `llm_configured: false`, and the UI says so.

Stack: FastAPI (Python 3.12+), SQLite, fastembed (local embeddings), an OpenAI-compatible LLM client, React 18 + TypeScript + Vite + Tailwind v4.

## Repository layout

```
backend/
  app/
    main.py            app factory
    config.py          pydantic-settings, reads .env
    logging_config.py  JSON logs, request-id middleware, X-Request-ID header
    errors.py          AppError hierarchy -> consistent error JSON
    schemas.py         request/response models
    db.py, repository.py   SQLite schema and data access
    vector_index.py    in-memory numpy index
    middleware.py      request logging and X-Request-ID
    api/routes.py      HTTP routes
    services/          chunking, embeddings, fetcher, llm, ingest, query
  tests/               pytest suite (fake embedder + fake LLM, no network)
frontend/
  src/                 React app; hooks useItems / useAsk; typed API client
samples/
  DEMO_DATA.md         sample notes, URLs and questions for trying the app
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements-dev.txt   # runtime deps + test tools
cp .env.example .env          # optionally set OPENAI_API_KEY
uvicorn app.main:app_factory --factory --reload --port 8000
pytest
```

The first ingest downloads the local embedding model (BAAI/bge-small-en-v1.5, about 130 MB). This happens once and is cached by fastembed.

### Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

### Configuration

Set in `backend/.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | unset | Enables answer generation. Optional. |
| `OPENAI_BASE_URL` | OpenAI default | Any OpenAI-compatible endpoint (OpenRouter, Ollama, etc.). |
| `LLM_MODEL` | `gpt-4o-mini` | Chat model name. |
| `DATABASE_PATH` | `data/inbox.db` | SQLite file. |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins. |
| `MIN_SCORE` | `0.5` | Cosine similarity threshold; chunks below it are dropped. bge-small scores unrelated text around 0.5, so lower values barely filter. |
| `FETCH_CONTACT` | unset | URL or email added to the fetcher's User-Agent. Some sites, including Wikipedia, return 403 to bots without one. |

**Free LLM option.** Any OpenAI-compatible provider works. For example, with a free [Groq](https://console.groq.com) key:

```env
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=qwen/qwen3.8-27b
```

Free model names change often; `GET {OPENAI_BASE_URL}/models` lists the ones your key can use.

### Trying it out

[samples/DEMO_DATA.md](samples/DEMO_DATA.md) has five short notes to paste, URLs to save, and questions to ask. Most notes describe made-up personal details, so a correct answer can only come from retrieval, not from the model's training data.

## API

All errors share one shape:

```json
{"error": {"code": "validation_error", "message": "..."}}
```

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| GET | `/health` | 200 `{status, llm_configured, items}` | |
| POST | `/ingest` | 201 `Item` | 422, 502 |
| GET | `/items` | 200 `{items: [Item]}`, newest first | |
| POST | `/query` | 200 `{answer, llm_configured, sources}` | 422, 502 |

**Ingest body**

```json
{"type": "note", "content": "...", "title": "optional"}
{"type": "url", "url": "https://example.com/article"}
```

**Item**: `{id, source_type, title, url, preview, chunk_count, created_at}`

**Query body**: `{"question": "...", "top_k": 5}`

**Source**: `{citation, item_id, title, source_type, url, snippet, score}`

Error codes:

- Ingest 422: `validation_error`, `unsupported_content`, `empty_content`, `blocked_url`
- Ingest 502: `fetch_failed`
- Query 422: `validation_error`
- Query 502: `llm_error`

### Examples

Ingest a note:

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"type": "note", "content": "Postgres vacuum runs autovacuum by default; tune autovacuum_vacuum_scale_factor for large tables.", "title": "pg notes"}'
```

Ask a question:

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I tune autovacuum?", "top_k": 5}'
```

On Windows PowerShell, use `curl.exe` (the `curl` alias is `Invoke-WebRequest`).

## Architecture

```
INGEST  POST /ingest
  request
    -> [url only] fetcher: httpx GET (10s timeout, 2 MB cap, http/https only,
                          private/loopback IPs blocked) -> BeautifulSoup text
    -> chunking: paragraph-aware recursive split (~800 chars, ~100 overlap)
    -> embeddings: fastembed bge-small-en-v1.5 (384-d, ONNX, CPU)
                   run in a threadpool so the event loop is not blocked
    -> SQLite: raw content, metadata, chunks, float32 embedding blobs
    -> vector_index: append to in-memory matrix

QUERY   POST /query
  question
    -> embed question (threadpool)
    -> vector_index: cosine top-k (dot product on normalised vectors)
    -> drop chunks below MIN_SCORE
    -> numbered context [1..n] -> LLM ("answer only from context, cite [n]")
    -> answer + sources whose citation numbers appear in the answer
```

On startup the in-memory index is rebuilt from the embedding blobs in SQLite. SQLite is the source of truth; the index is derived and can always be rebuilt.

## Design decisions and tradeoffs

### 1. Chunking

Chunks are produced by a paragraph-aware recursive splitter targeting about 800 characters with about 100 characters of overlap. The split order is paragraphs, then sentences, then a hard character split only when a single sentence is still too long.

Why:

- Notes are short and often fit in a single chunk, so the common case is not split at all.
- Keeping paragraphs and sentences intact preserves semantic units, which gives better embedding quality than cutting at arbitrary offsets.
- Small chunks give precise citations (the snippet points at the relevant passage, not a whole article) and keep the prompt small.
- Overlap keeps a fact that straddles a boundary retrievable from at least one chunk.

Why characters, not tokens: it is simpler, has no tokenizer dependency, and is good enough. The embedding model accepts 512 tokens, and 800 characters of English prose is comfortably under that limit with margin for tokenizer variance.

Alternatives considered:

- **Fixed-size windows**: simplest, but they cut mid-sentence and degrade both embeddings and snippets.
- **Semantic chunking** (split where embedding similarity drops): costs an embedding pass per sentence at ingest time and adds tuning complexity. Overkill for short personal notes.

### 2. Vector store: SQLite plus an in-memory numpy matrix

SQLite holds the source of truth: raw content, metadata, chunk text, and each chunk's embedding as a float32 blob. A numpy matrix of normalised vectors is kept in memory and searched with a single dot product.

Why:

- Zero infrastructure. One file, no service to run, trivial to reset.
- Rebuildable. The matrix is derived from SQLite at startup, so it cannot drift from storage in a way that matters.
- Exact search. Brute force gives exact top-k, with no recall loss from an approximate index.
- Fast enough. A dot product over tens of thousands of 384-d vectors takes on the order of a millisecond, which is far below the cost of the LLM call.

Why not Chroma, pgvector, or FAISS: each adds a dependency or a service to operate, and at single-user scale they buy nothing measurable. The migration path is clear (see section 5), and the repository boundary keeps the change local.

### 3. Embeddings and LLM

Embeddings use a local fastembed model (BAAI/bge-small-en-v1.5). The app needs no API key to ingest or search, there is no per-call cost, data never leaves the machine, and results are deterministic for a given model version.

Tradeoffs: the first ingest downloads about 130 MB, and retrieval quality is below large hosted embedding models. For this corpus size the gap is acceptable.

The LLM is accessed through the OpenAI-compatible client, with the base URL and model configurable. Switching between OpenAI, OpenRouter, or a local Ollama server is a configuration change, not a code change. Retrieval-only mode makes the LLM optional.

### 4. What breaks at scale

- **Whole index in RAM, O(n) search.** Memory grows with chunk count and each query scans every vector. Around 100k+ chunks this gets slow and memory-heavy.
- **Single-process index.** Each uvicorn worker holds its own matrix and would diverge on writes. Run one worker.
- **SQLite write contention.** Fine for one writer; concurrent ingests serialize and can hit lock timeouts.
- **Synchronous ingest.** A slow URL holds the request open for up to the fetch timeout. CPU-bound embedding runs in-process and competes with request handling.
- **No deduplication, updates, or deletes.** Re-ingesting a URL creates a second item.
- **JS-rendered pages extract poorly.** The fetcher does not execute JavaScript.
- **Prompt grows with top_k.** Context size and LLM cost scale linearly with `top_k`; there is no token budget.
- **No auth or tenancy.** Anyone who can reach the API can read every item.

### 5. Production changes

What I would change before this served more than one user:

- **Storage and search:** Postgres with pgvector (HNSW), or a managed vector database, behind the existing repository interface. Add hybrid search (BM25 plus vectors) and a reranker.
- **Ingestion:** background job queue (arq, Celery, or RQ) with item status (`pending` / `ready` / `failed`) that the UI polls. `/ingest` returns 202.
- **Embeddings:** hosted or batched calls, with model name and version stored per chunk so re-embedding is possible. Token-aware chunking to match the model's tokenizer.
- **Dedup:** by normalised URL and content hash.
- **Security:** auth and per-user tenancy; rate limiting; stricter SSRF protection (pin the resolved IP for the connection, or use an egress proxy).
- **Extraction:** readability-grade extraction and a headless-browser path for JS-heavy pages.
- **Caching and streaming:** cache query embeddings and answers; stream answers to the UI.
- **Observability and evaluation:** OpenTelemetry traces, per-stage latency metrics, and a labelled question set run in CI to catch retrieval and answer regressions.

## Debuggability

- **Structured logs.** Every log line is a JSON object; each request is logged with `request_id` and duration.
- **Request IDs.** The middleware sets `X-Request-ID` on responses. Quote that ID when reporting a problem and find its log lines directly.
- **Consistent errors.** All errors share the `{"error": {"code", "message"}}` shape, so clients can branch on `code`.
- **Honest status codes.** 201 on create, 200 on reads and queries, 422 for caller-fixable input, 502 when an upstream (fetched URL or LLM) fails, 500 only for bugs.
- **Retrieval-only mode** exposes ranked sources directly, so retrieval can be inspected without an LLM.

## Testing

```bash
cd backend
pytest
```

The suite runs fully offline. Tests use a fake embedder and a fake LLM client, so no model download and no network access are needed.

## Time spent and scope notes

Time spent: about 8 hours.

Scope notes:

- All functional requirements are covered: notes and URLs, chunking, local embeddings, vector search, an LLM answer with cited sources, and a React UI for adding, listing and asking.
- Left out on purpose: auth, deleting or editing items, and background ingestion. Section 4 explains what these limits mean and section 5 how I would add them.
- Added beyond the brief: retrieval-only mode when no LLM is configured, an SSRF guard on URL fetching, and request IDs in logs and responses.
