// textNode.js
// -----------------------------------------------------------------------------
// Text node (built on BaseNode) with two extra behaviours (Part 3):
//   1. The textarea — and the node — grow as the user types.
//   2. Every valid JS identifier wrapped in {{ double curlies }} becomes a
//      labelled target handle on the left side of the node.
// -----------------------------------------------------------------------------

import { useMemo, useRef, useEffect } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import { BaseNode } from './BaseNode';
import { useStore } from '../store';

const VARIABLE_REGEX = /\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}/g;

const extractVariables = (text) => {
  const seen = new Set();
  const vars = [];
  for (const match of text.matchAll(VARIABLE_REGEX)) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      vars.push(match[1]);
    }
  }
  return vars;
};

const config = {
  title: 'Text',
  icon: '¶',
  description: 'Compose text with {{variables}}',
  outputs: [{ id: 'output' }],
};

export const TextNode = ({ id, data, selected }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const updateNodeInternals = useUpdateNodeInternals();
  const textareaRef = useRef(null);

  const text = data?.text ?? '{{input}}';
  const variables = useMemo(() => extractVariables(text), [text]);
  const variableKey = variables.join(',');

  // width follows the longest line; height follows content (textarea autosize)
  const longestLine = Math.max(...text.split('\n').map((l) => l.length), 0);
  const width = Math.min(Math.max(220, longestLine * 7.5 + 60), 480);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [text, width]);

  // re-measure handle positions whenever the variable set changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [variableKey, id, updateNodeInternals]);

  const inputs = variables.map((v) => ({ id: v, label: v }));

  return (
    <BaseNode
      id={id}
      data={data}
      config={config}
      inputsOverride={inputs}
      selected={selected}
      style={{ width }}
    >
      <label className="node-field">
        <span className="node-field-label">Text</span>
        <textarea
          ref={textareaRef}
          className="node-field-control nodrag text-node-textarea"
          value={text}
          rows={1}
          onChange={(e) => updateNodeField(id, 'text', e.target.value)}
          placeholder="Type here — use {{name}} to add inputs"
        />
      </label>
      {variables.length > 0 && (
        <div className="text-node-vars">
          {variables.map((v) => (
            <span key={v} className="text-node-var">{v}</span>
          ))}
        </div>
      )}
    </BaseNode>
  );
};
