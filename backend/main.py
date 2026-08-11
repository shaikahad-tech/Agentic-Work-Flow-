"""
Agentic Work Flow — backend API.

Provides:
  GET  /                          — health check
  GET  /models                    — list available LLM models by provider
  GET  /keys                      — check which API keys are configured
  POST /pipelines/parse           — analyse a pipeline (node/edge count, DAG)
  POST /pipelines/run             — execute a pipeline with real LLM calls

API keys are supplied in the request body so the frontend can manage them
without the backend persisting secrets to disk.  Keys can also be loaded
from environment variables as a fallback.
"""

from __future__ import annotations

import os
from collections import defaultdict, deque
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import execute_pipeline
from llm import AVAILABLE_MODELS, ALL_MODELS

app = FastAPI(title="Agentic Work Flow API", version="1.0.0")

# Allow the React dev server to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Node(BaseModel):
    id: str

    class Config:
        extra = "allow"


class Edge(BaseModel):
    source: str
    target: str

    class Config:
        extra = "allow"


class Pipeline(BaseModel):
    nodes: list[Node]
    edges: list[Edge]


class RunRequest(BaseModel):
    """Request body for /pipelines/run.

    ``api_keys`` is optional — if omitted the backend falls back to
    environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY).
    """
    nodes: list[dict]
    edges: list[dict]
    api_keys: dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# DAG check (kept from the original code)
# ---------------------------------------------------------------------------

def is_dag(nodes: list[Node], edges: list[Edge]) -> bool:
    """Kahn's algorithm: the graph is a DAG iff a full topological order exists."""
    node_ids = {node.id for node in nodes}
    adjacency = defaultdict(list)
    in_degree = {node_id: 0 for node_id in node_ids}

    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            continue
        adjacency[edge.source].append(edge.target)
        in_degree[edge.target] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    visited = 0

    while queue:
        current = queue.popleft()
        visited += 1
        for neighbor in adjacency[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return visited == len(node_ids)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_api_keys(request_keys: dict[str, str]) -> dict[str, str]:
    """Merge request-supplied keys with environment variables.

    Request keys take priority; env vars fill the gaps.
    """
    env_map = {
        "openai": os.environ.get("OPENAI_API_KEY", ""),
        "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
        "google": os.environ.get("GOOGLE_API_KEY", ""),
    }
    merged: dict[str, str] = {}
    for provider in ("openai", "anthropic", "google"):
        val = (request_keys.get(provider) or "").strip()
        if val:
            merged[provider] = val
        elif env_map[provider]:
            merged[provider] = env_map[provider]
    return merged


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"Ping": "Pong"}


@app.get("/models")
def get_models():
    """Return the catalogue of available models grouped by provider."""
    return {"providers": AVAILABLE_MODELS, "all_models": ALL_MODELS}


@app.get("/keys")
def get_keys():
    """Check which providers have keys available via environment variables.

    Returns a dict like {"openai": true, "anthropic": false, "google": true}.
    Does NOT return the actual key values.
    """
    return {
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "google": bool(os.environ.get("GOOGLE_API_KEY")),
    }


@app.post("/pipelines/parse")
def parse_pipeline(pipeline: Pipeline):
    """Analyse a pipeline — count nodes/edges and check if it's a DAG."""
    return {
        "num_nodes": len(pipeline.nodes),
        "num_edges": len(pipeline.edges),
        "is_dag": is_dag(pipeline.nodes, pipeline.edges),
    }


@app.post("/pipelines/run")
def run_pipeline(req: RunRequest):
    """Execute a pipeline end-to-end.

    The frontend sends the full {nodes, edges} graph plus optional API keys.
    The engine executes nodes in topological order, calling real LLMs where
    LLM nodes are present, and returns the output of every node.
    """
    api_keys = _resolve_api_keys(req.api_keys)

    result = execute_pipeline(req.nodes, req.edges, api_keys)
    return result
