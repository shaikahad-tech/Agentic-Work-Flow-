// inputNode.js
// Rebuilt on the BaseNode abstraction — the whole node is just this config.
// Now includes an "inputValue" field so users can type the actual data that
// flows into the pipeline (used when no upstream node is connected).

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
    {
      name: 'inputValue',
      label: 'Value',
      type: 'textarea',
      rows: 3,
      placeholder: 'Type the data to feed into the pipeline…',
    },
  ],
});
