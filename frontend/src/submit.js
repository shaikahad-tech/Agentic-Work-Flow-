// submit.js
// Submit buttons for the pipeline.
//
// Two actions:
//   1. "Analyze"  — POST /pipelines/parse  (DAG check, node/edge count)
//   2. "Run"      — POST /pipelines/run    (execute the pipeline with real LLM calls)
//
// API keys are loaded from localStorage (where the Settings panel saves them)
// and sent in the request body for /pipelines/run.

import { useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { getApiKeys } from './settings';

const API_BASE = 'http://localhost:8000';

const selector = (state) => ({
  nodes: state.nodes,
  edges: state.edges,
});

// ---------------------------------------------------------------------------
// Analyze modal (DAG check)
// ---------------------------------------------------------------------------
const AnalyzeModal = ({ result, error, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      {error ? (
        <>
          <div className="modal-icon modal-icon-error">✕</div>
          <h2 className="modal-title">Something went wrong</h2>
          <p className="modal-subtitle">{error}</p>
        </>
      ) : (
        <>
          <div className={`modal-icon ${result.is_dag ? 'modal-icon-ok' : 'modal-icon-warn'}`}>
            {result.is_dag ? '✓' : '!'}
          </div>
          <h2 className="modal-title">Pipeline analyzed</h2>
          <p className="modal-subtitle">
            {result.is_dag
              ? 'Your pipeline is a valid directed acyclic graph.'
              : 'Your pipeline contains a cycle — it is not a DAG.'}
          </p>
          <div className="modal-stats">
            <div className="modal-stat">
              <span className="modal-stat-value">{result.num_nodes}</span>
              <span className="modal-stat-label">Nodes</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{result.num_edges}</span>
              <span className="modal-stat-label">Edges</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-value">{result.is_dag ? 'Yes' : 'No'}</span>
              <span className="modal-stat-label">DAG</span>
            </div>
          </div>
        </>
      )}
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Run results modal (execution output)
// ---------------------------------------------------------------------------
const RunModal = ({ result, error, onClose }) => {
  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal-icon modal-icon-error">✕</div>
          <h2 className="modal-title">Execution failed</h2>
          <p className="modal-subtitle">{error}</p>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const outputs = result.outputs || {};
  const nodeEntries = (result.execution_order || []).map((id) => {
    // Find the node type from the nodes list in the store
    return { id, output: outputs[id] };
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-icon ${result.status === 'success' ? 'modal-icon-ok' : 'modal-icon-warn'}`}>
          {result.status === 'success' ? '✓' : '!'}
        </div>
        <h2 className="modal-title">
          {result.status === 'success' ? 'Pipeline executed' : 'Pipeline executed with errors'}
        </h2>
        <p className="modal-subtitle">
          {result.status === 'success'
            ? `${nodeEntries.length} node(s) executed successfully.`
            : result.error}
        </p>

        {result.final_output !== null && result.final_output !== undefined && (
          <div className="run-final-output">
            <span className="run-final-label">Final Output</span>
            <pre className="run-final-value">{String(result.final_output)}</pre>
          </div>
        )}

        <div className="run-outputs">
          <span className="run-outputs-label">Node outputs ({nodeEntries.length})</span>
          <div className="run-outputs-list">
            {nodeEntries.map(({ id, output }) => (
              <div key={id} className="run-output-item">
                <span className="run-output-id">{id}</span>
                <pre className="run-output-value">{String(output ?? '')}</pre>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Submit button cluster
// ---------------------------------------------------------------------------
export const SubmitButton = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // 'analyze' | 'run' | null
  const [analyzing, setAnalyzing] = useState(false);
  const [running, setRunning] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setAnalyzeResult(null);
    try {
      const response = await fetch(`${API_BASE}/pipelines/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      setAnalyzeResult(await response.json());
      setModal('analyze');
    } catch (err) {
      setError(
        err.message.includes('fetch')
          ? 'Could not reach the backend. Is it running on http://localhost:8000?'
          : err.message
      );
      setModal('analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const apiKeys = getApiKeys();
      const response = await fetch(`${API_BASE}/pipelines/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, api_keys: apiKeys }),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      const data = await response.json();
      setRunResult(data);
      setModal('run');
    } catch (err) {
      setError(
        err.message.includes('fetch')
          ? 'Could not reach the backend. Is it running on http://localhost:8000?'
          : err.message
      );
      setModal('run');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="header-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleAnalyze}
          disabled={analyzing || running}
        >
          {analyzing ? 'Analyzing…' : 'Analyze'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={analyzing || running}
        >
          {running ? 'Running…' : '▶ Run pipeline'}
        </button>
      </div>

      {modal === 'analyze' && (
        <AnalyzeModal
          result={analyzeResult}
          error={error}
          onClose={() => { setModal(null); setError(null); }}
        />
      )}
      {modal === 'run' && (
        <RunModal
          result={runResult}
          error={error}
          onClose={() => { setModal(null); setError(null); }}
        />
      )}
    </>
  );
};
