// llmNode.js
// Rebuilt on the BaseNode abstraction — the whole node is just this config.
// Now includes provider, model, temperature, and max_tokens fields so the
// backend can route to the right LLM API.

import { createNode } from './BaseNode';

const ALL_MODELS = [
  // OpenAI
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'o1-mini',
  'o3-mini',
  // Anthropic
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  // Google
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

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
      options: ALL_MODELS,
      default: 'gpt-4o',
    },
    {
      name: 'temperature',
      label: 'Temperature',
      type: 'text',
      placeholder: '0.7',
      default: '0.7',
    },
    {
      name: 'max_tokens',
      label: 'Max Tokens',
      type: 'text',
      placeholder: '1000',
      default: '1000',
    },
  ],
});
