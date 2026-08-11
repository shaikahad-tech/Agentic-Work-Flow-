# Agentic Work Flow

A visual pipeline builder for chaining LLM calls, API requests, text
templating, math operations, and more — using a drag-and-drop React Flow
canvas with a FastAPI execution engine backend.

## What's new

The original project was a VectorShift-style frontend assessment: a React
Flow canvas that POSTs `{nodes, edges}` to a backend which only checks if
the graph is a DAG. **This fork adds full pipeline execution with real LLM
integration.**

- **Backend execution engine** — nodes execute in topological order; each
  node type has a handler that receives upstream outputs and produces its
  own output.
- **Real LLM calls** — OpenAI (GPT-4o, GPT-4o-mini, o1, o3, …), Anthropic
  (Claude 3.5 Sonnet/Haiku/Opus), and Google Gemini (1.5 Pro, 2.0 Flash).
  No provider SDK required — all calls go through `httpx`.
- **API key management** — a settings panel (⚙ icon) lets you enter keys
  in the browser. Keys are stored in `localStorage` and sent with each run
  request. The backend never persists them. Keys can also be loaded from
  environment variables as a fallback.
- **Run pipeline** — the "▶ Run pipeline" button executes the full graph
  and shows the output of every node in a results modal.

## Architecture

```
frontend/                    React + React Flow
  src/
    App.js                   Header + canvas + settings
    store.js                 Zustand store (nodes, edges, fields)
    ui.js                    React Flow canvas, drag-and-drop
    toolbar.js               Node palette
    submit.js                Analyze + Run buttons, result modals
    settings.js              API key settings panel (localStorage)
    nodes/
      BaseNode.js            Config-driven node renderer
      inputNode.js           Input node (with value field)
      llmNode.js             LLM node (model, temperature, max_tokens)
      outputNode.js          Output node
      textNode.js            Text node ({{variable}} templating)
      nodeConfigs.js         API, Condition, Math, Delay, Note nodes

backend/                     FastAPI
  main.py                    API endpoints
  engine.py                  Pipeline execution engine
  llm/
    __init__.py
    providers.py             OpenAI / Anthropic / Google providers
  requirements.txt
  .env.example
```

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs on http://localhost:8000.

Optional: copy `.env.example` to `.env` and add API keys there as a
fallback (the UI settings panel takes priority):

```bash
cp .env.example .env
# Edit .env with your keys
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend runs on http://localhost:3000.

## Adding API keys

1. Open the app at http://localhost:3000
2. Click the **⚙** gear icon in the top-right
3. Enter your API keys for OpenAI, Anthropic, and/or Google
4. Click **Save keys**

You only need a key for the provider whose model you're using. For
example, if your LLM node uses `gpt-4o`, you only need an OpenAI key.

Get API keys from:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google: https://aistudio.google.com/app/apikey

## Using the pipeline builder

1. **Drag nodes** from the palette onto the canvas
2. **Connect nodes** by dragging from a right-side handle (output) to a
   left-side handle (input)
3. **Configure nodes** by editing their fields (click a node to see its
   fields)
4. **Run the pipeline** by clicking "▶ Run pipeline"

### Node types

| Node | What it does |
|------|-------------|
| **Input** | Injects data. Type the value in the "Value" field, or connect an upstream node. |
| **Text** | Templates text with `{{variable}}` placeholders. Each unique variable creates an input handle. |
| **LLM** | Calls a real LLM. Connect a system prompt and/or prompt via the input handles, or use the generic "value" input as the prompt. |
| **API Request** | Calls an external HTTP endpoint (GET/POST/PUT/DELETE). |
| **Math** | Arithmetic on two numbers (add/subtract/multiply/divide). |
| **Condition** | Branch on a comparison expression (e.g. `value > 10`). |
| **Delay** | Pauses execution for N seconds. |
| **Output** | Collects the final result. |
| **Note** | Annotation — produces no output. |

### Example: LLM summarization pipeline

1. Add an **Input** node, type your text in the "Value" field
2. Add a **Text** node, write `Summarize the following text: {{value}}`
3. Connect Input → Text (value handle)
4. Add an **LLM** node, select `gpt-4o-mini`
5. Connect Text → LLM (prompt handle)
6. Add an **Output** node
7. Connect LLM → Output
8. Click **▶ Run pipeline**

### Example: Multi-model comparison

1. Add an **Input** node with your prompt
2. Add two **LLM** nodes — one with `gpt-4o`, one with `claude-3-5-sonnet-20241022`
3. Connect Input → both LLM nodes (prompt handles)
4. Add two **Output** nodes, connect each LLM to its own output
5. Click **▶ Run pipeline** — you'll see both responses in the results modal

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/models` | List available LLM models by provider |
| GET | `/keys` | Check which providers have env-var keys configured |
| POST | `/pipelines/parse` | Analyse a pipeline (node/edge count, DAG check) |
| POST | `/pipelines/run` | Execute a pipeline with real LLM calls |

### POST /pipelines/run

```json
{
  "nodes": [
    {"id": "input-1", "type": "customInput", "data": {"inputValue": "Hello"}},
    {"id": "llm-1", "type": "llm", "data": {"model": "gpt-4o", "temperature": "0.7", "max_tokens": "1000"}},
    {"id": "output-1", "type": "customOutput", "data": {}}
  ],
  "edges": [
    {"source": "input-1", "sourceHandle": "input-1-value", "target": "llm-1", "targetHandle": "llm-1-prompt"},
    {"source": "llm-1", "sourceHandle": "llm-1-response", "target": "output-1", "targetHandle": "output-1-value"}
  ],
  "api_keys": {
    "openai": "sk-..."
  }
}
```

Response:

```json
{
  "status": "success",
  "outputs": {
    "input-1": "Hello",
    "llm-1": "Hi there! How can I help you today?",
    "output-1": "Hi there! How can I help you today?"
  },
  "final_output": "Hi there! How can I help you today?",
  "execution_order": ["input-1", "llm-1", "output-1"],
  "error": null
}
```

## Supported models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1-mini, o3-mini |
| Anthropic | claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229 |
| Google | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |
