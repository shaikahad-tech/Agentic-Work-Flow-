// nodeConfigs.js
// -----------------------------------------------------------------------------
// Part 1 demo: five brand-new nodes, each defined in a handful of lines.
// Adding a node = one config here + one entry in ui.js and toolbar.js.
// -----------------------------------------------------------------------------

import { createNode } from './BaseNode';

export const APINode = createNode({
  title: 'API Request',
  icon: '⇄',
  description: 'Call an external HTTP endpoint',
  inputs: [{ id: 'body', label: 'body' }],
  outputs: [{ id: 'response', label: 'response' }],
  fields: [
    { name: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
    { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com' },
  ],
});

export const ConditionNode = createNode({
  title: 'Condition',
  icon: '⑂',
  description: 'Branch on an expression',
  inputs: [{ id: 'value', label: 'value' }],
  outputs: [
    { id: 'true', label: 'true' },
    { id: 'false', label: 'false' },
  ],
  fields: [
    { name: 'expression', label: 'Expression', type: 'text', placeholder: 'value > 10' },
  ],
});

export const MathNode = createNode({
  title: 'Math',
  icon: '∑',
  description: 'Combine two numbers',
  inputs: [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
  ],
  outputs: [{ id: 'result', label: 'result' }],
  fields: [
    { name: 'operation', label: 'Operation', type: 'select', options: ['add', 'subtract', 'multiply', 'divide'], default: 'add' },
  ],
});

export const DelayNode = createNode({
  title: 'Delay',
  icon: '◷',
  description: 'Pause the pipeline',
  inputs: [{ id: 'in' }],
  outputs: [{ id: 'out' }],
  fields: [
    { name: 'seconds', label: 'Seconds', type: 'number', default: '5' },
  ],
});

export const NoteNode = createNode({
  title: 'Note',
  icon: '✎',
  description: 'Annotate your pipeline',
  fields: [
    { name: 'note', label: 'Note', type: 'textarea', rows: 3, placeholder: 'Write a comment…' },
  ],
});
