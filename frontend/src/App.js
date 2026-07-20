import { PipelineToolbar } from './toolbar';
import { PipelineUI } from './ui';
import { SubmitButton } from './submit';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">▲</span>
          <span className="app-name">Pipeline Builder</span>
        </div>
        <SubmitButton />
      </header>
      <PipelineToolbar />
      <PipelineUI />
    </div>
  );
}

export default App;
