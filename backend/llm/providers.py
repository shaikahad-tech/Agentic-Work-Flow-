"""
LLM provider abstraction.

A single unified interface (`chat_completion`) that routes to OpenAI,
Anthropic, or Google Gemini based on the model name.  All HTTP calls go
through httpx so no provider-specific SDK is required.

Every provider implementation returns a plain string — the text content of
the assistant's reply — so the execution engine never has to know which
provider it's talking to.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Provider routing
# ---------------------------------------------------------------------------

def _provider_for(model: str) -> str:
    """Return the provider name for a given model id."""
    m = (model or "").lower()
    if m.startswith("gpt") or m.startswith("o1") or m.startswith("o3") or m.startswith("o4") or m.startswith("text-embedding"):
        return "openai"
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gemini"):
        return "google"
    # default to OpenAI-compatible
    return "openai"


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

def _openai_chat(
    client: httpx.Client,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    messages: list[dict[str, Any]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    resp = client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

def _anthropic_chat(
    client: httpx.Client,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system

    resp = client.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=body,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    # Anthropic returns a list of content blocks
    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    return "".join(parts)


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------

def _google_chat(
    client: httpx.Client,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents: list[dict[str, Any]] = [{"role": "user", "parts": [{"text": prompt}]}]
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    resp = client.post(
        url,
        headers={"Content-Type": "application/json"},
        json=body,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chat_completion(
    api_keys: dict[str, str],
    model: str,
    system: str,
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 1000,
) -> str:
    """Call the right LLM provider and return the assistant's text reply.

    ``api_keys`` is a dict with keys ``openai``, ``anthropic``, ``google``
    (any subset may be present; only the key for the routed provider is used).
    """
    provider = _provider_for(model)
    key = api_keys.get(provider, "")
    if not key:
        raise ValueError(
            f"No API key configured for provider '{provider}' (model '{model}'). "
            f"Set the {provider} API key in the UI settings panel."
        )

    with httpx.Client() as client:
        if provider == "openai":
            return _openai_chat(client, key, model, system, prompt, temperature, max_tokens)
        elif provider == "anthropic":
            return _anthropic_chat(client, key, model, system, prompt, temperature, max_tokens)
        else:
            return _google_chat(client, key, model, system, prompt, temperature, max_tokens)


# ---------------------------------------------------------------------------
# Model catalogue
# ---------------------------------------------------------------------------

AVAILABLE_MODELS = {
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "o1-mini",
        "o3-mini",
    ],
    "anthropic": [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
    ],
    "google": [
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
    ],
}

ALL_MODELS = [m for models in AVAILABLE_MODELS.values() for m in models]
