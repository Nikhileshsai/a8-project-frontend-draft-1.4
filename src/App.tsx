import { useState } from 'react'
import axios from 'axios'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { Beaker, Activity, Settings, Layout, Share2, Info } from 'lucide-react'
import './App.css'

const API_BASE = 'http://localhost:8000'

function App() {
  const [algo, setAlgo] = useState('deutsch-jozsa')
  const [params, setParams] = useState({
    n_qubits: 3,
    oracle_type: 'balanced',
    marked_state: '101',
    p_layers: 1,
    target_noisy_qubit: 0,
    phase_drift: 0.25
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleRun = async () => {
    setLoading(true)
    try {
      let payload = { ...params }
      if (algo === 'qaoa') {
        // Default triangle graph for demo
        payload = { ...payload, edges: [[0, 1], [1, 2], [0, 2]] }
      }
      const response = await axios.post(`${API_BASE}/algorithms/${algo}`, payload)
      setResults(response.data)
    } catch (err) {
      console.error(err)
      alert('Error running simulation. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const chartData = results ? Object.keys(results.metrics.counts_ideal).map(key => ({
    name: key,
    ideal: results.metrics.counts_ideal[key] || 0,
    noisy: results.metrics.counts_noisy[key] || 0
  })) : []

  return (
    <div className="dashboard">
      <header className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity size={32} color="#2f4b7c" />
          <h1 style={{ margin: 0 }}>NISQ Visualizer Platform</h1>
        </div>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Visualizing Quantum Algorithms in the NISQ Era
        </div>
      </header>

      <div className="grid-cols-2">
        {/* Left: Configuration */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Settings size={20} />
            <h2 style={{ margin: 0 }}>Configuration</h2>
          </div>

          <div className="input-group">
            <label>Algorithm</label>
            <select value={algo} onChange={(e) => setAlgo(e.target.value)}>
              <option value="deutsch-jozsa">Deutsch-Jozsa</option>
              <option value="grover">Grover's Search</option>
              <option value="qaoa">QAOA (Max-Cut)</option>
            </select>
          </div>

          <div className="input-group">
            <label>Number of Qubits</label>
            <input type="number" value={params.n_qubits} 
              onChange={(e) => setParams({...params, n_qubits: parseInt(e.target.value)})} />
          </div>

          {algo === 'deutsch-jozsa' && (
            <div className="input-group">
              <label>Oracle Type</label>
              <select value={params.oracle_type} onChange={(e) => setParams({...params, oracle_type: e.target.value})}>
                <option value="balanced">Balanced</option>
                <option value="constant">Constant</option>
              </select>
            </div>
          )}

          {algo === 'grover' && (
            <div className="input-group">
              <label>Marked State (e.g. 101)</label>
              <input type="text" value={params.marked_state} 
                onChange={(e) => setParams({...params, marked_state: e.target.value})} />
            </div>
          )}

          {algo === 'qaoa' && (
            <div className="input-group">
              <label>Layers (p)</label>
              <input type="number" value={params.p_layers} 
                onChange={(e) => setParams({...params, p_layers: parseInt(e.target.value)})} />
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

          <div className="input-group">
            <label>Target Noisy Qubit (for ZX)</label>
            <input type="number" value={params.target_noisy_qubit} 
              onChange={(e) => setParams({...params, target_noisy_qubit: parseInt(e.target.value)})} />
          </div>

          <div className="input-group">
            <label>Phase Drift (π units)</label>
            <input type="number" step="0.05" value={params.phase_drift} 
              onChange={(e) => setParams({...params, phase_drift: parseFloat(e.target.value)})} />
          </div>

          <button className="btn" onClick={handleRun} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Executing on FakeManila...' : 'Run Simulation'}
          </button>
        </div>

        {/* Right: Results / Stats */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Activity size={20} />
            <h2 style={{ margin: 0 }}>Metrics & Benchmarks</h2>
          </div>

          {results ? (
            <>
              <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Hellinger Fidelity</div>
                <div className={`metrics-badge ${results.metrics.hellinger_fidelity > 0.8 ? 'fidelity-high' : 'fidelity-low'}`}>
                  {(results.metrics.hellinger_fidelity * 100).toFixed(2)}%
                </div>
              </div>

              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ideal" fill="#2f4b7c" name="Ideal Sim" />
                    <Bar dataKey="noisy" fill="#f95d6a" name="Manila Noise" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Select parameters and click "Run Simulation"
            </div>
          )}
        </div>
      </div>

      {results && (
        <>
          {/* ZX Calculus Visualization */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Layout size={20} />
              <h2 style={{ margin: 0 }}>Topological ZX-Calculus Visualization</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ideal Flow Graph</div>
                <div className="svg-container" dangerouslySetInnerHTML={{ __html: results.zx_graphs.ideal }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#991b1b' }}>Systematic Phase Drift (Injected)</div>
                <div className="svg-container" dangerouslySetInnerHTML={{ __html: results.zx_graphs.noisy }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2f4b7c' }}>Propagated Error (Simplified)</div>
                <div className="svg-container" dangerouslySetInnerHTML={{ __html: results.zx_graphs.propagated }} />
              </div>
            </div>
          </div>

          {/* Circuit QASM */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Share2 size={20} />
              <h2 style={{ margin: 0 }}>Transpilation (OpenQASM 2.0)</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
               <div>
                 <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Logical Circuit</div>
                 <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', maxHeight: '300px', overflow: 'auto' }}>
                   {results.logical_circuit_qasm}
                 </pre>
               </div>
               <div>
                 <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Physical Circuit ({results.metrics.backend})</div>
                 <pre style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', maxHeight: '300px', overflow: 'auto' }}>
                   {results.physical_circuit_qasm}
                 </pre>
               </div>
            </div>
          </div>
        </>
      )}

      <footer style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
        Development Proof of Concept for the paper "Visualizing Quantum Algorithms in the NISQ Era"
      </footer>
    </div>
  )
}

export default App
