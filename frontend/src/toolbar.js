// toolbar.js

import { DraggableNode } from './draggableNode';

const NODE_PALETTE = [
  { type: 'customInput', label: 'Input', icon: '⇥' },
  { type: 'llm', label: 'LLM', icon: '✦' },
  { type: 'customOutput', label: 'Output', icon: '⇤' },
  { type: 'text', label: 'Text', icon: '¶' },
  { type: 'api', label: 'API', icon: '⇄' },
  { type: 'condition', label: 'Condition', icon: '⑂' },
  { type: 'math', label: 'Math', icon: '∑' },
  { type: 'delay', label: 'Delay', icon: '◷' },
  { type: 'note', label: 'Note', icon: '✎' },
];

export const PipelineToolbar = () => {
    return (
        <div className="toolbar">
            <span className="toolbar-hint">Drag a node onto the canvas</span>
            <div className="toolbar-nodes">
                {NODE_PALETTE.map((node) => (
                    <DraggableNode key={node.type} {...node} />
                ))}
            </div>
        </div>
    );
};
