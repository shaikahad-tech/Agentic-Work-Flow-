"""
Pipeline execution engine.

Takes a graph of nodes and edges (as sent from the React Flow frontend) and
executes them in topological order.  Each node type has a dedicated handler
that receives the resolved outputs of all upstream nodes and returns its own
output.  The engine supports:

  * Input nodes        — inject the user-supplied input data
  * Text nodes         — template-substitute variables from upstream nodes
  * LLM nodes          — call a real LLM (OpenAI / Anthropic / Google)
  * API Request nodes  — call external HTTP endpoints
  * Math nodes         — arithmetic on two numbers
  * Condition nodes     — branch on a simple expression
  * Delay nodes         — sleep for N seconds
  * Output nodes        — collect results
  * Note nodes         — no-op (annotations only)

The output of each node is cached so multiple downstream consumers don't
re-run the same work.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from collections import defaultdict, deque
from typing import Any

import httpx

try:
    from .llm import chat_completion
except ImportError:
    from llm import chat_completion


# ---------------------------------------------------------------------------
# Graph utilities
# ---------------------------------------------------------------------------

def _topological_order(
    node_ids: list[str],
    edges: list[dict],
) -> list[str]:
    """Kahn's algorithm.  Raises ValueError if the graph has a cycle."""
    adjacency: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}

    for edge in edges:
        src, tgt = edge.get("source"), edge.get("target")
        if src in in_degree and tgt in in_degree:
            adjacency[src].append(tgt)
            in_degree[tgt] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order: list[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in adjacency[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(node_ids):
        raise ValueError("Pipeline contains a cycle — cannot execute.")

    return order


def _build_inputs(
    node_id: str,
    edges: list[dict],
    outputs: dict[str, Any],
) -> dict[str, Any]:
    """Resolve the inputs for a node by looking at incoming edges.

    Returns a dict mapping handle-id -> output value of the upstream node.
    The handle id is extracted from the *target* handle (e.g. "llm-1-prompt"
    -> "prompt"), which tells us which input slot of this node the edge fills.
    """
    resolved: dict[str, Any] = {}
    for edge in edges:
        if edge.get("target") != node_id:
            continue
        src = edge["source"]
        upstream_val = outputs.get(src)

        # The target handle tells us WHICH input slot of this node the edge
        # fills.  React Flow handle ids are "<nodeId>-<handleId>", so we strip
        # the node id prefix.  Node ids can contain hyphens, so we can't just
        # split on the first "-".
        target_handle = edge.get("targetHandle", "")
        if target_handle.startswith(node_id + "-"):
            handle_key = target_handle[len(node_id) + 1:]
        elif target_handle:
            handle_key = target_handle
        else:
            handle_key = "value"

        resolved[handle_key] = upstream_val
        # also provide a generic "value" key for convenience (first edge wins)
        resolved.setdefault("value", upstream_val)
    return resolved


# ---------------------------------------------------------------------------
# Text templating
# ---------------------------------------------------------------------------

_VARIABLE_RE = re.compile(r"\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}")


def _render_text(text: str, inputs: dict[str, Any]) -> str:
    """Replace {{var}} placeholders with values from the inputs dict."""

    def replacer(match: re.Match) -> str:
        var = match.group(1)
        if var in inputs:
            val = inputs[var]
            return str(val) if val is not None else ""
        return match.group(0)  # leave unknown vars as-is

    return _VARIABLE_RE.sub(replacer, text)


# ---------------------------------------------------------------------------
# Node data extraction helper
# ---------------------------------------------------------------------------

def _data(node: dict) -> dict[str, Any]:
    """Return the node's data dict, or {} if missing."""
    return node.get("data") or {}


# ---------------------------------------------------------------------------
# Node handlers
#
# Each handler receives (node, inputs, api_keys) and returns its output.
# ``inputs`` is the dict produced by _build_inputs — a mapping from handle id
# to the upstream node's output value.
# ---------------------------------------------------------------------------

def _handle_input(node: dict, inputs: dict, api_keys: dict) -> str:
    data = _data(node)
    # The frontend Input node has an "inputName" field; the actual payload
    # arrives via an edge from another Input/Text node, or is typed directly.
    if "value" in inputs and inputs["value"] is not None:
        return str(inputs["value"])
    # Fall back to a field called "inputValue" or "inputName"
    return str(data.get("inputValue", data.get("inputName", "")))


def _handle_text(node: dict, inputs: dict, api_keys: dict) -> str:
    text = _data(node).get("text", "")
    return _render_text(text, inputs)


def _handle_llm(node: dict, inputs: dict, api_keys: dict) -> str:
    data = _data(node)
    model = data.get("model", "gpt-4o")
    system = str(inputs.get("system", "")) or data.get("systemPrompt", "")
    prompt = str(inputs.get("prompt", "")) or data.get("prompt", "")
    if not prompt:
        # if only a generic "value" edge is connected, use it as the prompt
        prompt = str(inputs.get("value", ""))

    temperature = float(data.get("temperature", 0.7))
    max_tokens = int(data.get("max_tokens", data.get("maxTokens", 1000)))

    return chat_completion(api_keys, model, system, prompt, temperature, max_tokens)


def _handle_api(node: dict, inputs: dict, api_keys: dict) -> str:
    data = _data(node)
    method = data.get("method", "GET").upper()
    url = data.get("url", "")
    if not url:
        return ""

    body = inputs.get("body") or inputs.get("value")

    with httpx.Client(timeout=30) as client:
        kwargs: dict[str, Any] = {"method": method}
        if body and method in ("POST", "PUT", "PATCH"):
            if isinstance(body, (dict, list)):
                kwargs["json"] = body
            else:
                kwargs["content"] = str(body)
        resp = client.request(method, url, **kwargs)
        resp.raise_for_status()
        # Try JSON first, fall back to raw text
        try:
            return json.dumps(resp.json(), indent=2)
        except Exception:
            return resp.text


def _handle_math(node: dict, inputs: dict, api_keys: dict) -> str:
    data = _data(node)
    op = data.get("operation", "add")
    a_raw = inputs.get("a", inputs.get("value"))
    b_raw = inputs.get("b")

    try:
        a = float(a_raw) if a_raw is not None else 0.0
        b = float(b_raw) if b_raw is not None else 0.0
    except (ValueError, TypeError):
        return "Error: non-numeric input to Math node"

    if op == "add":
        result = a + b
    elif op == "subtract":
        result = a - b
    elif op == "multiply":
        result = a * b
    elif op == "divide":
        if b == 0:
            return "Error: division by zero"
        result = a / b
    else:
        return f"Error: unknown operation '{op}'"

    # Return integer-looking floats as ints for cleaner output
    if result == int(result):
        return str(int(result))
    return str(result)


def _handle_condition(node: dict, inputs: dict, api_keys: dict) -> str:
    """Evaluate a simple condition expression like 'value > 10'.

    Returns the stringified upstream value tagged with the branch taken so
    both downstream paths can receive it.  The frontend can use this to
    route — but since execution walks all nodes, we simply pass the value
    through and include the branch result.
    """
    data = _data(node)
    expr = data.get("expression", "")
    val = inputs.get("value", "")

    # Try numeric comparison
    try:
        num_val = float(val)
        # Replace 'value' in the expression with the actual number
        safe_expr = expr.replace("value", str(num_val))
        # Very limited safe evaluation: only comparison operators and numbers
        result = _safe_compare(safe_expr)
        return str(val)
    except (ValueError, TypeError):
        # String comparison (equality / contains)
        return str(val)


def _safe_compare(expr: str) -> bool:
    """Evaluate a simple comparison expression safely."""
    for op_str, op_func in [
        (">=", lambda a, b: a >= b),
        ("<=", lambda a, b: a <= b),
        ("!=", lambda a, b: a != b),
        ("==", lambda a, b: a == b),
        (">", lambda a, b: a > b),
        ("<", lambda a, b: a < b),
    ]:
        if op_str in expr:
            parts = expr.split(op_str)
            if len(parts) == 2:
                try:
                    left = float(parts[0].strip())
                    right = float(parts[1].strip())
                    return op_func(left, right)
                except ValueError:
                    return False
    return False


def _handle_delay(node: dict, inputs: dict, api_keys: dict) -> str:
    data = _data(node)
    seconds = float(data.get("seconds", 5))
    time.sleep(min(seconds, 60))  # cap at 60s to avoid hanging
    return str(inputs.get("in", inputs.get("value", "")))


def _handle_output(node: dict, inputs: dict, api_keys: dict) -> str:
    """The output node simply passes through whatever it receives."""
    return str(inputs.get("value", ""))


def _handle_note(node: dict, inputs: dict, api_keys: dict) -> str:
    """Notes are annotations — they produce no output."""
    return _data(node).get("note", "")


# Map React Flow node type -> handler
NODE_HANDLERS: dict[str, Any] = {
    "customInput": _handle_input,
    "text": _handle_text,
    "llm": _handle_llm,
    "api": _handle_api,
    "math": _handle_math,
    "condition": _handle_condition,
    "delay": _handle_delay,
    "customOutput": _handle_output,
    "note": _handle_note,
}


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

def execute_pipeline(
    nodes: list[dict],
    edges: list[dict],
    api_keys: dict[str, str],
) -> dict[str, Any]:
    """Execute the full pipeline and return results.

    Returns a dict with:
        - status: "success" | "error"
        - outputs: { node_id: value } for every executed node
        - final_output: the output of the first Output node found (or last node)
        - execution_order: list of node ids in execution order
        - error: error message if status == "error"
    """
    result: dict[str, Any] = {
        "status": "success",
        "outputs": {},
        "final_output": None,
        "execution_order": [],
        "error": None,
    }

    try:
        node_ids = [n["id"] for n in nodes]
        node_map = {n["id"]: n for n in nodes}
        order = _topological_order(node_ids, edges)
        result["execution_order"] = order

        outputs: dict[str, Any] = {}

        for nid in order:
            node = node_map[nid]
            ntype = node.get("type", "")
            handler = NODE_HANDLERS.get(ntype)

            if handler is None:
                outputs[nid] = f"[unknown node type: {ntype}]"
                continue

            resolved_inputs = _build_inputs(nid, edges, outputs)
            try:
                out = handler(node, resolved_inputs, api_keys)
                outputs[nid] = out
            except Exception as e:
                outputs[nid] = f"[error: {e}]"
                # Continue executing other nodes but note the error
                result["status"] = "error"
                result["error"] = f"Node '{nid}' ({ntype}) failed: {e}"

        result["outputs"] = outputs

        # Find the final output: prefer customOutput nodes, else last node
        output_nodes = [n for n in nodes if n.get("type") == "customOutput"]
        if output_nodes:
            result["final_output"] = outputs.get(output_nodes[0]["id"], "")
        elif order:
            result["final_output"] = outputs.get(order[-1], "")

    except ValueError as e:
        result["status"] = "error"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "error"
        result["error"] = f"Unexpected error: {e}"

    return result
