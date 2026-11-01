import { useEffect, useState } from 'react';
import { api } from './api.js';
import SimulationTab from './components/SimulationTab.jsx';
import CompareTab from './components/CompareTab.jsx';
import ScalabilityTab from './components/ScalabilityTab.jsx';
import AblationTab from './components/AblationTab.jsx';
import TheoryTab from './components/TheoryTab.jsx';

const TABS = [
  ['sim', '1. Live Simulation'],
  ['compare', '2. Compare Algorithms'],
  ['scale', '3. Scalability'],
  ['ablation', '4. Ablation Study'],
  ['theory', '5. How It Works'],
];

export default function App() {
  const [tab, setTab] = useState('sim');
  const [info, setInfo] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.info().then(setInfo).catch(() => setError('Cannot reach the backend. Start it with "npm start" in the backend folder.'));
    api.savedResults().then(setSaved).catch(() => setSaved(null)); // optional
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="title-row">
            <h1>SmartStock · Warehouse Robot Path Planning</h1>
            <span className="subtitle">DAA course project — CA-RHPP vs. A*, Prioritized Planning, RHCR and CBS</span>
          </div>
          <nav className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {error && <div className="card error">{error}</div>}
        {!info && !error && <div className="card hint">Loading…</div>}
        {info && (
          <>
            {/* Simulation stays mounted so switching tabs does not lose the animation */}
            <div style={{ display: tab === 'sim' ? 'contents' : 'none' }}><SimulationTab info={info} /></div>
            {tab === 'compare' && <CompareTab info={info} saved={saved} />}
            {tab === 'scale' && <ScalabilityTab info={info} saved={saved} />}
            {tab === 'ablation' && <AblationTab info={info} saved={saved} />}
            {tab === 'theory' && <TheoryTab info={info} />}
          </>
        )}
      </main>
    </>
  );
}
