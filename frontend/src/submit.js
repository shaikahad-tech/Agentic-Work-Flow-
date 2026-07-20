// submit.js
// Part 4: send the pipeline to the backend and show the parse result.

import { useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';

const selector = (state) => ({
  nodes: state.nodes,
  edges: state.edges,
});

const ResultModal = ({ result, error, onClose }) => (
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

export const SubmitButton = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('http://localhost:8000/pipelines/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      setResult(await response.json());
    } catch (err) {
      setError(
        err.message.includes('fetch')
          ? 'Could not reach the backend. Is it running on http://localhost:8000?'
          : err.message
      );
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  return (
    <>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Analyzing…' : 'Submit pipeline'}
      </button>
      {open && (
        <ResultModal result={result} error={error} onClose={() => setOpen(false)} />
      )}
    </>
  );
};
