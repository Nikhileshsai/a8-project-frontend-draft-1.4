import { useState } from 'react'
import axios from 'axios'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { Activity, Settings, Layout, Share2, X } from 'lucide-react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [algo, setAlgo] = useState('deutsch-jozsa')
  const [params, setParams] = useState({
    n_qubits: 3,
    oracle_type: 'balanced',
    marked_state: '101',
    p_layers: 1,
    gamma: 1.047, // pi/3
    beta: 0.785,  // pi/4
    target_noisy_qubit: 0,
    phase_drift: 0.25,
    backend_name: 'FakeManilaV2'
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [zoomImage, setZoomImage] = useState<{ content: string, title: string } | null>(null)

  // Builder State
  const [builderGates, setBuilderGates] = useState<any[]>([])
  const [selectedGate, setSelectedGate] = useState<string | null>(null)
  const [cxControl, setCxControl] = useState<number | null>(null)

  const GATES = ['H', 'X', 'Y', 'Z', 'CX', 'RZ']
  const BACKENDS = [
    { id: 'FakeManilaV2', name: 'Manila (5 Qubits)', qubits: 5 },
    { id: 'FakeBelemV2', name: 'Belem (5 Qubits)', qubits: 5 },
    { id: 'FakeQuitoV2', name: 'Quito (5 Qubits)', qubits: 5 },
    { id: 'FakeLimaV2', name: 'Lima (5 Qubits)', qubits: 5 },
    { id: 'FakeJakartaV2', name: 'Jakarta (7 Qubits)', qubits: 7 },
    { id: 'FakeLagosV2', name: 'Lagos (7 Qubits)', qubits: 7 },
    { id: 'FakeNairobiV2', name: 'Nairobi (7 Qubits)', qubits: 7 },
    { id: 'FakeCasablancaV2', name: 'Casablanca (7 Qubits)', qubits: 7 },
    { id: 'FakeGuadalupeV2', name: 'Guadalupe (16 Qubits)', qubits: 16 },
  ]

  const currentMaxQubits = BACKENDS.find(b => b.id === params.backend_name)?.qubits || 5

  const generateQASM = () => {
    let qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n';
    qasm += `qreg q[${params.n_qubits}];\ncreg c[${params.n_qubits}];\n`;
    
    builderGates.forEach(g => {
      if (g.type === 'CX') {
        qasm += `cx q[${g.control}],q[${g.target}];\n`;
      } else if (g.type === 'RZ') {
        qasm += `rz(pi/2) q[${g.qubit}];\n`;
      } else {
        qasm += `${g.type.toLowerCase()} q[${g.qubit}];\n`;
      }
    });

    qasm += `measure q -> c;\n`;
    return qasm;
  }

  const handleRun = async () => {
    if (algo === 'grover' && params.marked_state.length !== params.n_qubits) {
      alert(`Marked state must be exactly ${params.n_qubits} bits long.`);
      return;
    }

    setLoading(true)
    try {
      let payload: any = { ...params }
      let endpoint = `${API_BASE}/algorithms/${algo}`

      if (algo === 'qaoa') {
        payload.edges = [[0, 1], [1, 2], [0, 2]]
      } else if (algo === 'custom') {
        endpoint = `${API_BASE}/algorithms/custom`
        payload.qasm = generateQASM()
      }

      const response = await axios.post(endpoint, payload)
      setResults(response.data)
    } catch (err) {
      console.error(err)
      alert('Error running simulation. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleWireClick = (qubitIndex: number) => {
    if (!selectedGate) return;

    if (selectedGate === 'CX') {
      if (cxControl === null) {
        setCxControl(qubitIndex);
      } else if (cxControl !== qubitIndex) {
        setBuilderGates([...builderGates, { type: 'CX', control: cxControl, target: qubitIndex }]);
        setCxControl(null);
      }
    } else {
      setBuilderGates([...builderGates, { type: selectedGate, qubit: qubitIndex }]);
    }
  }

  // Improved chartData logic to handle all keys from both datasets
  const chartData = results ? Array.from(new Set([
    ...Object.keys(results.metrics.counts_ideal),
    ...Object.keys(results.metrics.counts_noisy)
  ])).sort().map(key => ({
    name: key,
    ideal: results.metrics.counts_ideal[key] || 0,
    noisy: results.metrics.counts_noisy[key] || 0
  })) : []

  return (
    <div className="dashboard">
      <header className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Activity size={32} color="var(--primary)" />
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-h)' }}>Visualizing Quantum Algorithms in the NISQ Era</h1>
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
            <select value={algo} onChange={(e) => {
              setAlgo(e.target.value);
              setResults(null);
            }}>
              <option value="deutsch-jozsa">Deutsch-Jozsa</option>
              <option value="grover">Grover's Search</option>
              <option value="qaoa">QAOA (Max-Cut)</option>
              <option value="custom">Custom (Circuit Builder)</option>
            </select>
          </div>

          <div className="input-group">
            <label>Target Backend</label>
            <select 
              value={params.backend_name} 
              onChange={(e) => {
                const newBackend = BACKENDS.find(b => b.id === e.target.value);
                const newMax = newBackend?.qubits || 5;
                const safeQubits = Math.min(params.n_qubits, newMax);
                setParams({
                  ...params, 
                  backend_name: e.target.value,
                  n_qubits: safeQubits,
                  target_noisy_qubit: Math.min(params.target_noisy_qubit, safeQubits - 1)
                });
              }}
            >
              {BACKENDS.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Number of Qubits (1 - {currentMaxQubits})</label>
            <input 
              type="number" 
              min="1" 
              max={currentMaxQubits}
              value={params.n_qubits} 
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                const safeVal = Math.max(1, Math.min(val, currentMaxQubits));
                setParams({
                  ...params, 
                  n_qubits: safeVal,
                  target_noisy_qubit: Math.min(params.target_noisy_qubit, safeVal - 1)
                });
              }} 
            />
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
              <label>Marked State ({params.n_qubits} bits)</label>
              <input 
                type="text" 
                maxLength={params.n_qubits}
                value={params.marked_state} 
                onChange={(e) => setParams({...params, marked_state: e.target.value.replace(/[^01]/g, '')})} 
              />
            </div>
          )}

          {algo === 'qaoa' && (
            <>
              <div className="input-group">
                <label>Layers (p)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5"
                  value={params.p_layers} 
                  onChange={(e) => setParams({...params, p_layers: Math.max(1, parseInt(e.target.value) || 1)})} 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label>Gamma (Cost)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={params.gamma} 
                    onChange={(e) => setParams({...params, gamma: parseFloat(e.target.value)})} 
                  />
                </div>
                <div className="input-group">
                  <label>Beta (Mixer)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={params.beta} 
                    onChange={(e) => setParams({...params, beta: parseFloat(e.target.value)})} 
                  />
                </div>
              </div>
            </>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />

          <div className="input-group">
            <label>Target Noisy Qubit (for ZX)</label>
            <input 
              type="number" 
              min="0" 
              max={params.n_qubits - 1}
              value={params.target_noisy_qubit} 
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setParams({...params, target_noisy_qubit: Math.max(0, Math.min(val, params.n_qubits - 1))});
              }} 
            />
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Phase Drift (π units)</label>
              <span style={{ fontSize: '0.8rem', color: '#475569' }}>{params.phase_drift}π</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="2"
              step="0.05"
              value={params.phase_drift} 
              onChange={(e) => setParams({...params, phase_drift: parseFloat(e.target.value)})} 
            />
          </div>

          <button className="btn" onClick={handleRun} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Executing Simulation...' : 'Run Simulation'}
          </button>
        </div>

        {/* Right: Builder Workspace or Readiness Placeholder */}
        <div className="card" style={{ minHeight: '400px' }}>
          {algo === 'custom' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Layout size={20} />
                <h2 style={{ margin: 0 }}>Circuit Builder Workspace</h2>
              </div>

              {/* Gate Palette */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', padding: '1rem', background: 'var(--code-bg)', borderRadius: '8px' }}>
                {GATES.map(gate => (
                  <button 
                    key={gate}
                    onClick={() => { setSelectedGate(gate); setCxControl(null); }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: selectedGate === gate ? 'var(--primary)' : 'var(--card-bg)',
                      color: selectedGate === gate ? 'white' : 'var(--text)',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {gate}
                  </button>
                ))}
                <button 
                  onClick={() => { setBuilderGates([]); setCxControl(null); }}
                  style={{ marginLeft: 'auto', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Clear All
                </button>
              </div>

              {/* Workspace Grid */}
              <div style={{ 
                overflowX: 'auto', 
                padding: '2rem 1rem', 
                background: 'var(--card-bg)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px',
                minHeight: '300px'
              }}>
                {Array.from({ length: params.n_qubits }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', height: '50px', position: 'relative' }}>
                    <div style={{ width: '50px', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-h)' }}>q[{i}]</div>
                    <div 
                      onClick={() => handleWireClick(i)}
                      style={{ 
                        flex: 1, 
                        height: '2px', 
                        background: cxControl === i ? 'var(--primary)' : 'var(--border)', 
                        cursor: 'crosshair',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '15px', position: 'absolute', top: '-20px', left: '10px' }}>
                        {builderGates.filter(g => g.qubit === i || g.control === i || g.target === i).map((g, idx) => (
                          <div 
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setBuilderGates(builderGates.filter((_, bIdx) => builderGates.indexOf(g) !== bIdx));
                            }}
                            style={{
                              width: '40px',
                              height: '40px',
                              background: g.type === 'CX' ? 'var(--secondary)' : 'var(--primary)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: 'var(--shadow)'
                            }}
                          >
                            {g.type === 'CX' ? (g.control === i ? '●' : '⊕') : g.type}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--code-bg)', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-h)' }}>Status / Instructions:</div>
                <div style={{ color: 'var(--text)' }}>
                  {selectedGate === 'CX' && cxControl === null && "→ Click a wire to set the CONTROL qubit."}
                  {selectedGate === 'CX' && cxControl !== null && `→ Click a DIFFERENT wire to set the TARGET qubit for CNOT.`}
                  {selectedGate && selectedGate !== 'CX' && `→ Click any wire to place a ${selectedGate} gate.`}
                  {!selectedGate && "→ Select a gate from the palette above to start building your circuit."}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
              <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3>Ready for Simulation</h3>
              <p>Configure your parameters and click "Run Simulation" to see the NISQ analysis below.</p>
            </div>
          )}
        </div>
      </div>

      {results && (
        <>
          {/* Results Comparison Chart */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Activity size={20} />
              <h2 style={{ margin: 0 }}>{results.metrics.chart_title}</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', color: 'var(--text)', marginBottom: '0.5rem' }}>Hellinger Fidelity</div>
                <div className={`metrics-badge ${results.metrics.hellinger_fidelity > 0.8 ? 'fidelity-high' : 'fidelity-low'}`} style={{ fontSize: '2rem' }}>
                  {(results.metrics.hellinger_fidelity * 100).toFixed(2)}%
                </div>
              </div>

              <div style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar dataKey="ideal" fill={results.metrics.colors[0]} name={results.metrics.legend_labels[0]} />
                    <Bar dataKey="noisy" fill={results.metrics.colors[1]} name={results.metrics.legend_labels[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ZX Calculus Visualization */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Layout size={20} />
              <h2 style={{ margin: 0 }}>Topological ZX-Calculus Visualization</h2>
            </div>
            
            <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ideal Flow Graph</div>
                <div 
                  className="svg-container clickable" 
                  onClick={() => setZoomImage({ content: results.zx_graphs.ideal, title: 'Ideal Flow Graph' })}
                  dangerouslySetInnerHTML={{ __html: results.zx_graphs.ideal }} 
                />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#991b1b' }}>Systematic Phase Drift (Injected)</div>
                <div 
                  className="svg-container clickable" 
                  onClick={() => setZoomImage({ content: results.zx_graphs.noisy, title: 'Systematic Phase Drift (Injected)' })}
                  dangerouslySetInnerHTML={{ __html: results.zx_graphs.noisy }} 
                />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>Propagated Error (Simplified)</div>
                <div 
                  className="svg-container clickable" 
                  onClick={() => setZoomImage({ content: results.zx_graphs.propagated, title: 'Propagated Error (Simplified)' })}
                  dangerouslySetInnerHTML={{ __html: results.zx_graphs.propagated }} 
                />
              </div>
            </div>
          </div>

          {/* Circuit Transpilation */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Share2 size={20} />
              <h2 style={{ margin: 0 }}>Transpilation (Logical vs. Physical)</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
               <div>
                 <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Logical Circuit</div>
                 <div 
                   className="svg-container clickable" 
                   onClick={() => setZoomImage({ content: results.logical_circuit_svg, title: 'Logical Circuit' })}
                   dangerouslySetInnerHTML={{ __html: results.logical_circuit_svg }} 
                 />
               </div>
               <div>
                 <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#475569' }}>Physical Circuit ({results.metrics.backend})</div>
                 <div 
                   className="svg-container clickable" 
                   onClick={() => setZoomImage({ content: results.physical_circuit_svg, title: `Physical Circuit (${results.metrics.backend})` })}
                   dangerouslySetInnerHTML={{ __html: results.physical_circuit_svg }} 
                 />
               </div>
            </div>
          </div>
        </>
      )}

      {/* Full-Screen Zoom Modal */}
      {zoomImage && (
        <div className="modal-overlay" onClick={() => setZoomImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setZoomImage(null)}>
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{zoomImage.title}</h3>
            <div 
              className="zoom-svg-container" 
              dangerouslySetInnerHTML={{ __html: zoomImage.content }} 
            />
          </div>
        </div>
      )}

      <footer style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
        Development Proof of Concept for the paper "Visualizing Quantum Algorithms in the NISQ Era"
      </footer>
    </div>
  )
}

export default App
