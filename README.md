# VectorShift Frontend Technical Assessment

Pipeline builder with a config-driven node system, minimal unified design, smart Text node, and FastAPI backend integration.

## Running

Backend:

```bash
cd backend
pip install fastapi uvicorn
uvicorn main:app --reload
```

Frontend (in a second terminal):

```bash
cd frontend
npm i
npm start
```

Open http://localhost:3000 — the backend runs on http://localhost:8000.

## Part 1 — Node Abstraction

`src/nodes/BaseNode.js` renders any node from a declarative config: title, icon, description, input/output handles, and typed fields (text, select, textarea, number). A `createNode(config)` factory turns a config object into a registered node component, and every field value is persisted to the zustand store so the submitted pipeline carries real data.

The four original nodes (`inputNode.js`, `outputNode.js`, `llmNode.js`, `textNode.js`) were rebuilt on this abstraction, and five new nodes demonstrate it in `src/nodes/nodeConfigs.js`: API Request, Condition, Math, Delay, and Note. Each new node is roughly ten lines of config — no JSX, no handle math, no styling.

## Part 2 — Styling

A single design system in `src/index.css`: white surfaces, one indigo accent, subtle borders, and quiet shadows, with CSS variables for theming. The layout is a header (brand + submit), a drag palette, and a full-height canvas. Node cards, handles, edges, controls, minimap, and the result modal all share the same language.

## Part 3 — Text Node Logic

The Text node auto-sizes: width follows the longest line, height follows the textarea's scroll height. Typing a valid JavaScript identifier in double curly braces (e.g. `{{input}}`) creates a labelled target handle on the left side, one per unique variable, with `useUpdateNodeInternals` keeping React Flow's handle positions in sync. Detected variables are also shown as chips under the field.

## Part 4 — Backend Integration

The submit button POSTs `{nodes, edges}` to `POST /pipelines/parse`. The backend (FastAPI + pydantic, CORS enabled for the dev server) counts nodes and edges and runs Kahn's algorithm to decide whether the pipeline is a DAG, returning `{num_nodes, num_edges, is_dag}`. The frontend shows the result in a styled modal — including a friendly error if the backend isn't running.
