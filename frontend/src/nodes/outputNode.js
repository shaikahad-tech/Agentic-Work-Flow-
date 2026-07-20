// outputNode.js
// Rebuilt on the BaseNode abstraction — the whole node is just this config.

import { createNode } from './BaseNode';

export const OutputNode = createNode({
  title: 'Output',
  icon: '⇤',
  description: 'Return data from the pipeline',
  inputs: [{ id: 'value' }],
  fields: [
    {
      name: 'outputName',
      label: 'Name',
      type: 'text',
      default: (id) => id.replace('customOutput-', 'output_'),
    },
    { name: 'outputType', label: 'Type', type: 'select', options: ['Text', 'Image'], default: 'Text' },
  ],
});
