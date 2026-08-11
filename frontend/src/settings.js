// settings.js
// API key management panel.
//
// Keys are stored in localStorage so they survive page refreshes, and are
// sent to the backend with every /pipelines/run request.  They are never
// persisted on the backend — only used in-memory for that request.

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'agentic_api_keys';

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    hint: 'For GPT-4o, GPT-4o-mini, o1, o3, etc.',
    url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    hint: 'For Claude 3.5 Sonnet, Haiku, Opus',
    url: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    label: 'Google',
    placeholder: 'AIza...',
    hint: 'For Gemini 1.5 Pro, Gemini 2.0 Flash',
    url: 'https://aistudio.google.com/app/apikey',
  },
];

const loadKeys = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveKeys = (keys) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
};

export const getApiKeys = () => loadKeys();

export const SettingsPanel = ({ open, onClose }) => {
  const [keys, setKeys] = useState(loadKeys);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setKeys(loadKeys());
      setSaved(false);
    }
  }, [open]);

  const handleChange = (providerId, value) => {
    const updated = { ...keys, [providerId]: value };
    setKeys(updated);
    setSaved(false);
  };

  const handleSave = () => {
    saveKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = (providerId) => {
    const updated = { ...keys };
    delete updated[providerId];
    setKeys(updated);
    saveKeys(updated);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="modal-title">API Keys</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <p className="settings-subtitle">
          Keys are stored in your browser's localStorage and sent with each
          pipeline run. They are never saved on the backend.
        </p>
        <div className="settings-fields">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="settings-field">
              <div className="settings-field-header">
                <label className="settings-field-label">{p.label}</label>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="settings-field-link"
                >
                  Get key ↗
                </a>
              </div>
              <div className="settings-field-row">
                <input
                  type="password"
                  className="settings-field-input"
                  value={keys[p.id] || ''}
                  onChange={(e) => handleChange(p.id, e.target.value)}
                  placeholder={p.placeholder}
                  autoComplete="off"
                />
                {keys[p.id] && (
                  <button
                    className="settings-field-clear"
                    onClick={() => handleClear(p.id)}
                    title="Clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="settings-field-hint">{p.hint}</p>
            </div>
          ))}
        </div>
        <div className="settings-actions">
          {saved && <span className="settings-saved">✓ Saved</span>}
          <button className="btn btn-primary" onClick={handleSave}>
            Save keys
          </button>
        </div>
      </div>
    </div>
  );
};
