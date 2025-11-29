import Dialer from './components/Dialer';

function App() {
  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Vercel-ready</p>
          <h1>Modern Web Dialer</h1>
          <p className="muted">
            A composable React component that brings SIP calling, registration, and DTMF
            in a clean UI. Drop it into any page or embed it as a widget.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="eyebrow">Quick start</p>
            <code>{`import { Dialer } from './components/Dialer'`}</code>
          </div>
          <p className="muted">
            Configure your SIP WebSocket URL, SIP URI, and credentials, then place calls
            instantly from the browser.
          </p>
        </div>
      </header>

      <main>
        <Dialer title="Workspace Dialer" />
      </main>
    </div>
  );
}

export default App;
