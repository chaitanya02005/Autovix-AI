import json
from urllib.error import URLError

import pytest

from rag import llm_client


class _Response:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_generate_answer_calls_local_chat_api(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["body"] = json.loads(request.data)
        captured["timeout"] = timeout
        return _Response({"message": {"content": "Grounded answer"}})

    monkeypatch.setattr(llm_client, "urlopen", fake_urlopen)
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:7b")

    assert llm_client.generate_answer("system", "question") == "Grounded answer"
    assert captured["url"] == "http://localhost:11434/api/chat"
    assert captured["body"]["model"] == "qwen2.5:7b"
    assert captured["body"]["messages"] == [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "question"},
    ]
    assert captured["body"]["stream"] is False


def test_unreachable_ollama_has_setup_message(monkeypatch):
    def fake_urlopen(_request, timeout):
        raise URLError("connection refused")

    monkeypatch.setattr(llm_client, "urlopen", fake_urlopen)
    with pytest.raises(llm_client.LLMUnavailableError, match="ollama pull llama3.1:8b"):
        llm_client.generate_answer("system", "question")


def test_health_check_reports_missing_model(monkeypatch):
    monkeypatch.setattr(llm_client, "_request_json", lambda *_args, **_kwargs: {"models": []})
    status = llm_client.check_local_llm()
    assert status["ready"] is False
    assert "ollama pull llama3.1:8b" in status["message"]


def test_no_public_llm_provider_references_in_source_or_requirements():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    forbidden = ("gr" + "oq", "api." + "openai.com", "api." + "anthropic.com")
    source_paths = [
        path for path in root.rglob("*")
        if path.is_file()
        and path.suffix in {".py", ".jsx", ".js", ".ts", ".tsx", ".md", ".txt"}
        and not {"venv", ".git", "node_modules", "data", "dist"}.intersection(path.parts)
    ]
    for path in source_paths:
        content = path.read_text(encoding="utf-8", errors="ignore").lower()
        if path.name == "test_llm_client.py":
            continue
        assert not any(term in content for term in forbidden), f"Public LLM reference in {path}"
    requirements = (root / "requirements.txt").read_text(encoding="utf-8").lower()
    assert "gr" + "oq" not in requirements
