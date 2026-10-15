"""Local LLM client used for grounded document answers."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.1:8b"


class LLMUnavailableError(RuntimeError):
    """Raised when the configured local model cannot serve requests."""


def provider_name():
    return os.environ.get("LLM_PROVIDER", "ollama").strip().lower()


def model_name():
    return os.environ.get("OLLAMA_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _base_url():
    return os.environ.get("OLLAMA_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _timeout():
    try:
        return max(1, float(os.environ.get("LLM_TIMEOUT_SECONDS", "120")))
    except ValueError:
        return 120.0


def _temperature():
    try:
        return float(os.environ.get("LLM_TEMPERATURE", "0.1"))
    except ValueError:
        return 0.1


def _request_json(path, payload=None, timeout=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{_base_url()}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if data is not None else "GET",
    )
    try:
        with urlopen(request, timeout=timeout or _timeout()) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code == 404 and "model" in detail.lower():
            raise LLMUnavailableError(_model_setup_message()) from None
        raise LLMUnavailableError(f"Local LLM request failed (HTTP {error.code}).") from None
    except (URLError, TimeoutError, OSError, json.JSONDecodeError):
        raise LLMUnavailableError(_model_setup_message()) from None


def _model_setup_message():
    return (
        "Local LLM is not running or the model is not available. Start Ollama and run "
        f"`ollama pull {model_name()}`."
    )


def check_local_llm():
    """Return readiness details without preventing the API from starting."""
    if provider_name() != "ollama":
        return {"ready": False, "provider": provider_name(), "model": model_name(),
                "message": "Unsupported local LLM provider."}
    try:
        response = _request_json("/api/tags", timeout=min(5.0, _timeout()))
    except LLMUnavailableError as error:
        return {"ready": False, "provider": "ollama", "model": model_name(), "message": str(error)}
    models = response.get("models", [])
    available = any(
        item.get("name") == model_name()
        or item.get("model") == model_name()
        or str(item.get("name", "")).split(":", 1)[0] == model_name().split(":", 1)[0]
        for item in models
    )
    return {
        "ready": available,
        "provider": "ollama",
        "model": model_name(),
        "message": "ready" if available else _model_setup_message(),
    }


def generate_answer(system_prompt, user_prompt):
    """Generate an answer with Ollama's local chat API."""
    if provider_name() != "ollama":
        raise LLMUnavailableError("Unsupported local LLM provider. Set LLM_PROVIDER=ollama.")
    response = _request_json(
        "/api/chat",
        {
            "model": model_name(),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": _temperature()},
        },
    )
    try:
        return response["message"]["content"]
    except (KeyError, TypeError):
        raise LLMUnavailableError("Local LLM returned an invalid response.") from None
