import pytest

from rag import embeddings


def test_embedding_model_loads_from_local_cache_only(monkeypatch):
    captured = {}

    class FakeModel:
        def __init__(self, *args, **kwargs):
            captured["args"] = args
            captured["kwargs"] = kwargs

    monkeypatch.setattr(embeddings, "SentenceTransformer", FakeModel)
    embeddings.EmbeddingModel()

    assert captured["kwargs"]["local_files_only"] is True


def test_missing_local_embedding_model_has_clear_error(monkeypatch):
    def missing_model(*_args, **_kwargs):
        raise OSError("missing cache")

    monkeypatch.setattr(embeddings, "SentenceTransformer", missing_model)
    with pytest.raises(embeddings.EmbeddingModelUnavailableError, match="not available"):
        embeddings.EmbeddingModel()


def test_embedding_model_is_reused(monkeypatch):
    calls = []

    class FakeModel:
        def __init__(self, *_args, **_kwargs):
            calls.append(1)

    monkeypatch.setattr(embeddings, "SentenceTransformer", FakeModel)
    embeddings.get_embedding_model.cache_clear()
    first = embeddings.get_embedding_model()
    second = embeddings.get_embedding_model()
    embeddings.get_embedding_model.cache_clear()

    assert first is second
    assert calls == [1]
