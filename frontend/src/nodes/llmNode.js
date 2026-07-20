// llmNode.js
// Rebuilt on the BaseNode abstraction — the whole node is just this config.

import { createNode } from './BaseNode';

export const LLMNode = createNode({
  title: 'LLM',
  icon: '✦',
  description: 'Query a large language model',
  inputs: [
    { id: 'system', label: 'system' },
    { id: 'prompt', label: 'prompt' },
  ],
  outputs: [{ id: 'response', label: 'response' }],
  fields: [
    {
      name: 'model',
      label: 'Model',
      type: 'select',
      options: ['gpt-4o', 'claude-sonnet', 'gemini-pro'],
      default: 'gpt-4o',
    },
  ],
});
