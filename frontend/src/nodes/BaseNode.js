// BaseNode.js
// -----------------------------------------------------------------------------
// A single, config-driven abstraction for every node in the pipeline.
//
// A node is described declaratively:
//   {
//     title:   'Input',
//     icon:    '⇥',
//     description: 'Pass data into the pipeline',
//     inputs:  [{ id: 'system', label: 'system' }, ...]   // left handles
//     outputs: [{ id: 'value' }, ...]                     // right handles
//     fields:  [{ name, label, type: 'text'|'select'|'textarea'|'number', ... }]
//   }
//
// BaseNode renders the card, header, fields and handles, and persists every
// field value to the global store so the pipeline can be submitted intact.
// Custom content (e.g. the Text node) can be injected via `children`, and
// handles can be overridden at render time via `inputsOverride`.
// -----------------------------------------------------------------------------

import { Handle, Position } from 'reactflow';
import { useStore } from '../store';

const handleTop = (index, total) => `${((index + 1) / (total + 1)) * 100}%`;

const Field = ({ field, value, onChange }) => {
  const common = {
    className: 'node-field-control nodrag',
    value: value ?? '',
    onChange: (e) => onChange(field.name, e.target.value),
    placeholder: field.placeholder || '',
  };

  return (
    <label className="node-field">
      <span className="node-field-label">{field.label}</span>
      {field.type === 'select' ? (
        <select {...common}>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea rows={field.rows || 2} {...common} />
      ) : (
        <input type={field.type || 'text'} {...common} />
      )}
    </label>
  );
};

export const BaseNode = ({
  id,
  data,
  config,
  children,
  inputsOverride, // dynamic left handles (used by the Text node)
  style,
  selected,
}) => {
  const updateNodeField = useStore((state) => state.updateNodeField);

  const inputs = inputsOverride ?? config.inputs ?? [];
  const outputs = config.outputs ?? [];

  const fieldValue = (field) => {
    if (data?.[field.name] !== undefined) return data[field.name];
    return typeof field.default === 'function' ? field.default(id) : field.default;
  };

  const onFieldChange = (name, value) => updateNodeField(id, name, value);

  return (
    <div className={`node-card ${selected ? 'is-selected' : ''}`} style={style}>
      {/* left / target handles */}
      {inputs.map((h, i) => (
        <Handle
          key={h.id}
          type="target"
          position={Position.Left}
          id={`${id}-${h.id}`}
          className="node-handle"
          style={{ top: handleTop(i, inputs.length) }}
        >
          {h.label && <span className="handle-label handle-label-left">{h.label}</span>}
        </Handle>
      ))}

      <div className="node-header">
        <span className="node-icon">{config.icon}</span>
        <span className="node-title">{config.title}</span>
      </div>

      {config.description && (
        <div className="node-description">{config.description}</div>
      )}

      {(config.fields?.length > 0 || children) && (
        <div className="node-body">
          {config.fields?.map((field) => (
            <Field
              key={field.name}
              field={field}
              value={fieldValue(field)}
              onChange={onFieldChange}
            />
          ))}
          {children}
        </div>
      )}

      {/* right / source handles */}
      {outputs.map((h, i) => (
        <Handle
          key={h.id}
          type="source"
          position={Position.Right}
          id={`${id}-${h.id}`}
          className="node-handle"
          style={{ top: handleTop(i, outputs.length) }}
        >
          {h.label && <span className="handle-label handle-label-right">{h.label}</span>}
        </Handle>
      ))}
    </div>
  );
};

// Factory: turn a config object into a ready-to-register node component.
export const createNode = (config) => {
  const NodeComponent = ({ id, data, selected }) => (
    <BaseNode id={id} data={data} config={config} selected={selected} />
  );
  NodeComponent.displayName = `${config.title}Node`;
  return NodeComponent;
};
