import { useState } from 'react';
import { PipelineToolbar } from './toolbar';
import { PipelineUI } from './ui';
import { SubmitButton } from './submit';
import { SettingsPanel } from './settings';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">▲</span>
          <span className="app-name">Pipeline Builder</span>
        </div>
        <div className="header-actions">
          <SubmitButton />
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setSettingsOpen(true)}
            title="API Key Settings"
          >
            ⚙
          </button>
        </div>
      </header>
      <PipelineToolbar />
      <PipelineUI />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
