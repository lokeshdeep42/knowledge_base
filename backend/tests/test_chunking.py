from app.services.chunking import chunk_text


def test_short_text_is_single_chunk():
    assert chunk_text("Hello world.") == ["Hello world."]


def test_empty_text_has_no_chunks():
    assert chunk_text("  \n\n  ") == []


def test_paragraphs_are_packed_up_to_limit():
    paragraphs = [f"Paragraph {i} " + "x" * 300 for i in range(4)]
    chunks = chunk_text("\n\n".join(paragraphs), max_chars=700, overlap=0)
    assert len(chunks) == 2
    assert chunks[0] == "\n\n".join(paragraphs[:2])


def test_oversized_paragraph_splits_on_sentences():
    sentences = [f"Sentence number {i} is here." for i in range(40)]
    chunks = chunk_text(" ".join(sentences), max_chars=200, overlap=0)
    assert len(chunks) > 1
    assert all(len(c) <= 200 for c in chunks)
    assert all(c.endswith(".") for c in chunks)


def test_giant_sentence_is_hard_split():
    chunks = chunk_text("a" * 2000, max_chars=800, overlap=0)
    assert [len(c) for c in chunks] == [800, 800, 400]


def test_consecutive_chunks_overlap_on_word_boundary():
    text = "\n\n".join(f"alpha{i} " * 60 for i in range(3))
    chunks = chunk_text(text, max_chars=500, overlap=100)
    assert len(chunks) == 3
    tail = chunks[0][-60:].split()[-1]
    assert tail in chunks[1][:120]
    assert not chunks[1].startswith("lpha")
