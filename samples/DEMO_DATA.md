# Demo data for AI Knowledge Inbox

Notes to paste, URLs to save, and questions to ask during a demo.
Each note is well under the 20,000-character limit. Paste the text inside each code block as the note content and use the heading as the title.

Most of the notes describe made-up personal and work details (a project kickoff, a home server, a trip). A language model cannot have memorized these, so a correct answer can only come from retrieval. This is the clearest way to show that the RAG pipeline works.

---

## Notes

### Note 1: Project Atlas kickoff - 14 Sep 2026

```text
Project Atlas kickoff meeting, 14 September 2026. Attendees: Priya (PM), Daniel (backend), Mei (design), Arjun (QA).

Goal: replace the internal ticket search with a semantic search tool so support agents can find past resolutions in under 10 seconds.

Decisions:
- Database: we will use PostgreSQL with the pgvector extension instead of a separate vector database. Reason: one system to back up and operate, and our corpus is only about 400,000 tickets.
- Embeddings: start with a small open-source model running on our own servers so ticket text never leaves the network.
- The first release is read-only. Agents can search but not edit tickets from Atlas.

Owners and dates:
- Daniel owns the ingestion pipeline. Due 10 October 2026.
- Mei delivers the search results page design by 3 October 2026.
- Arjun writes the evaluation set of 200 real support questions with known answers by 17 October 2026.
- Priya owns the beta launch to the Bangalore support team on 2 November 2026.

Budget: 18,000 USD for the quarter, mostly GPU time for re-embedding.

Risks raised: ticket text contains customer emails and phone numbers, so we must strip personal data before embedding. Arjun warned that search quality cannot be judged without the evaluation set, so it is a launch blocker.

Next meeting: 21 September 2026, 11:00.
```

### Note 2: Reading notes - B-trees vs LSM-trees

```text
Notes from Designing Data-Intensive Applications, chapter 3 (storage and retrieval).

B-trees keep data in fixed-size pages (usually 4 KB) arranged as a balanced tree. A write updates a page in place, and a write-ahead log protects against crashes halfway through a page split. Reads are predictable: a lookup touches about log(n) pages. Most relational databases, including PostgreSQL and SQLite, use B-trees.

LSM-trees (log-structured merge trees) buffer writes in an in-memory table (the memtable). When it fills up, it is written to disk as a sorted, immutable file called an SSTable. Background compaction merges SSTables and discards overwritten or deleted keys. Used by RocksDB, Cassandra and LevelDB.

When LSM-trees win: write-heavy workloads. Sequential writes are much faster than random page updates, and compression is better because files are immutable.

When B-trees win: read-heavy workloads and predictable latency. An LSM read may need to check several SSTables (bloom filters help), and compaction can cause latency spikes when it competes with foreground writes.

My takeaway: for an app that mostly reads, like a knowledge base, a B-tree store such as SQLite is the right default.
```

### Note 3: Home server setup log

```text
Home server setup log.

Hardware: Raspberry Pi 5 with 8 GB RAM and a 1 TB NVMe SSD on a PCIe hat. Static IP on the home network: 192.168.1.50.

Services:
- Jellyfin media server on port 8096.
- Pi-hole DNS ad blocking; the router hands out the Pi as the DNS server.
- Nextcloud for photo backup from phones, behind Caddy, which handles HTTPS.

Backups: a restic job runs every night at 02:30 and backs up the Nextcloud data folder to a Backblaze B2 bucket called pi-backup-2026. Retention is 7 daily, 4 weekly and 6 monthly snapshots. The restic password is in my password manager under "Pi restic", not on the Pi.

Remote access: only through Tailscale. No ports are forwarded on the router.

Problems so far: the Pi overheated during the first Jellyfin transcode, so I added the official active cooler. Temperature under load dropped from 85 C to 62 C.

To do: test a full restore from B2 before the end of October 2026.
```

### Note 4: Interview prep - designing a RAG system

```text
Interview prep notes: how I would explain a retrieval-augmented generation (RAG) system.

1. Ingestion: split documents into chunks of a few hundred tokens with some overlap, so a sentence that crosses a boundary still appears whole in at least one chunk.
2. Embeddings: turn each chunk into a vector. A small local model such as bge-small is fast, free, and keeps data private.
3. Retrieval: embed the question and take the top-k chunks by cosine similarity.
4. Similarity threshold: drop chunks that score below a minimum. Without it, the model always receives "the 5 closest chunks" even when none of them are relevant, and it starts guessing. With bge-small, unrelated text still scores around 0.5, so the threshold must sit above that.
5. Generation: give the model only the retrieved chunks, numbered, and tell it to cite them like [1] and to say "I don't know" if the answer is not there. Citations make answers checkable.
6. Graceful degradation: if the LLM is down or not configured, still return the retrieved sources.

Trade-offs to mention: an in-memory vector index is fine for thousands of chunks but needs an approximate nearest neighbour index (HNSW) or pgvector at millions. Re-ranking with a cross-encoder improves precision but adds latency.

How to evaluate: build a small set of questions with known answers, then measure whether the right chunk is retrieved (recall@k) separately from whether the final answer is correct.
```

### Note 5: Hampi weekend trip plan

```text
Hampi weekend trip, 24 to 26 October 2026.

Travel: overnight Hampi Express from Bangalore on Friday 24 October, departs 22:00, arrives Hospet around 07:40. Auto-rickshaw from Hospet to Hampi takes about 30 minutes.

Stay: Hampi Heritage Homestay, two nights, booking reference HHS-77412. Check-in from 12:00.

Plan:
- Saturday morning: Virupaksha Temple, then walk along the river to Vijaya Vittala Temple to see the stone chariot. Go early; it gets very hot after 11.
- Saturday sunset: Hemakuta Hill.
- Sunday: hire bicycles and visit the Lotus Mahal and the Elephant Stables, then cross by coracle to Anegundi.

Budget: about 9,000 INR per person, including train, stay and food.

Return: Sunday 26 October, Hampi Express from Hospet at 20:30.
Pack: sunscreen, a hat, cash (many small shops do not take cards), and a power bank.
```

---

## URLs

All of these were fetched successfully by the app's own fetcher on 21 October 2026.

| URL | Good question to ask |
| --- | --- |
| https://peps.python.org/pep-0020/ | What does the Zen of Python say about errors? |
| https://12factor.net/config | Where should an app keep its configuration? |
| https://www.sqlite.org/whentouse.html | When should I not use SQLite? |
| https://paulgraham.com/makersschedule.html | Why are meetings more costly for makers than for managers? |
| https://martinfowler.com/bliki/TechnicalDebt.html | What does Martin Fowler compare technical debt to? |
| https://owasp.org/www-community/attacks/Server_Side_Request_Forgery | What is server-side request forgery? |
| https://www.anthropic.com/engineering/building-effective-agents | What is the difference between workflows and agents? |
| https://simonwillison.net/2023/Oct/23/embeddings/ | What are embeddings? |
| https://en.wikipedia.org/wiki/Retrieval-augmented_generation | What problem does RAG solve? (needs `FETCH_CONTACT` set) |

The OWASP SSRF page is a good talking point: the app's URL fetcher blocks private and local addresses for exactly this reason. Try saving `http://localhost:8000/health` or `http://192.168.1.1` during the demo to show the `blocked_url` error.

---

## Questions for the notes

| Question | Shows |
| --- | --- |
| When is the Atlas beta launch and who owns it? | Exact facts from a private note (2 November 2026, Priya) |
| Why did we choose pgvector for Atlas? | Reasons, not just facts |
| When do LSM-trees beat B-trees? | Answering from a summary note |
| What time does my backup run and where does it go? | Precise detail retrieval (02:30, Backblaze B2) |
| Why should a RAG system use a similarity threshold? | Links to how this app works |
| What do I need to pack for Hampi? | Retrieval picks the right note out of several unrelated ones |
| What deadlines do I have in October 2026? | Combining several notes, with several citations |
| What is my manager's phone number? | The model says it does not know instead of making something up |
