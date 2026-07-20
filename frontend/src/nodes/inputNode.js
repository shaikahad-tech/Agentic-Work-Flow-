// inputNode.js
// Rebuilt on the BaseNode abstraction — the whole node is just this config.

import { createNode } from './BaseNode';

export const InputNode = createNode({
  title: 'Input',
  icon: '⇥',
  description: 'Pass data into the pipeline',
  outputs: [{ id: 'value' }],
  fields: [
    {
      name: 'inputName',
      label: 'Name',
      type: 'text',
      default: (id) => id.replace('customInput-', 'input_'),
    },
    { name: 'inputType', label: 'Type', type: 'select', options: ['Text', 'File'], default: 'Text' },
  ],
});
