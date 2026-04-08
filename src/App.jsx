import React, { useState, useEffect } from 'react';
import { Heart, Activity, AlertTriangle, ShieldCheck, Info, MessageSquare, ChevronRight, History } from 'lucide-react';
import PpgScanner from './components/PpgScanner';
import './index.css';

const App = () => {
  const [view, setView] = useState('HOME');
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");

  const calculateShockIndex = (bpm) => {
    // In a real app, we'd estimate SBP or use user's last known SBP
    // For the demo, we use a constant baseline SBP of 110 for the index calculation
    const sbp = 110;
    return (bpm / sbp).toFixed(2);
  };

  const handleScanResult = async (bpm) => {
    const si = calculateShockIndex(bpm);
    const result = {
      bpm,
      si: parseFloat(si),
      status: si > 0.9 ? 'DANGER' : si > 0.8 ? 'WARNING' : 'SAFE',
      date: 'Just now'
    };
    
    setCurrentResult(result);
    setHistory(prev => [{ id: Date.now(), bpm: result.bpm, si: result.si, status: result.status === 'SAFE' ? 'Normal' : 'High', date: 'Just now' }, ...prev]);
    setView('RESULTS');
    
    // Call AI for analysis
    getAiAdvice(result);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.1; // Warmer tone
      window.speechSynthesis.speak(utterance);
    }
  };

  const getAiAdvice = async (result) => {
    setAiAnalysis("Hema-AI dey check your result...");
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{
            role: "system",
            content: "You are Hema-AI, a maternal health assistant for Nigerian mothers. SPEAK ONLY IN WARM, CLEAR NIGERIAN PIDGIN ENGLISH. Explain the scan results. If the status is SAFE, tell her 'No shaking, you and pikin dey fine.' If the status is DANGER, tell her 'Abeg, call doctor sharp-sharp, no delay!' Use local food examples for safety (like Moin-Moin, Akara). Keep it very short (max 3 sentences)."
          }, {
            role: "user",
            content: `My Heart Rate is ${result.bpm} and my Shock Index is ${result.si}. My status is ${result.status}. Tell me what to do in Pidgin.`
          }]
        })
      });
      const data = await response.json();
      const advice = data.choices[0].message.content;
      setAiAnalysis(advice);
      speak(advice); // Automatically speak the result
    } catch (err) {
      console.error(err);
      let fallback = "";
      if (result.status === 'SAFE') {
        fallback = "Mama, no worry, you dey very safe! Just chop better food and rest well.";
      } else if (result.status === 'WARNING') {
        fallback = "Mama, take am easy today. Make you rest and drink plenty water.";
      } else {
        fallback = "Abeg, call doctor sharp-sharp! Your vitals high small, no delay!";
      }
      setAiAnalysis(fallback);
      speak(fallback);
    }
  };

  return (
    <div className="container" style={{ padding: '20px', minHeight: '100vh', paddingBottom: '100px', position: 'relative' }}>
      <div className="vignette" style={{ position: 'absolute' }}></div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary)' }}>HemaPulse</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Guardian of African Motherhood</p>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '12px' }}>
          <ShieldCheck size={24} color="var(--safe)" />
        </div>
      </div>

      {/* Conditional Rendering of Views */}
      {view === 'HOME' && (
        <>
          <div className="glass-card pulse-animation" style={{ padding: '30px', textAlign: 'center', border: '1px solid var(--primary-glow)' }}>
            <Activity size={48} color="rgba(255,255,255,0.7)" style={{ marginBottom: '15px' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Ready for Scan</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px' }}>Check your vitals to ensure perfect health post-delivery.</p>
            <button className="btn-primary" onClick={() => setView('SCANNING')}>Start Vitality Check</button>
          </div>

          <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} /> Recent Checks
          </h3>
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              No recent checks. Do a scan to see your history!
            </div>
          )}
          {history.map(item => (
            <div key={item.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.status === 'Normal' ? 'var(--safe)' : 'var(--danger)' }}></div>
                <div>
                  <p style={{ fontWeight: '600' }}>{item.bpm} BPM</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shock Index: {item.si}</p>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.date}</p>
            </div>
          ))}

          <div className="glass-card" style={{ background: 'rgba(45, 212, 191, 0.1)', borderColor: 'rgba(45, 212, 191, 0.2)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Info color="var(--safe)" />
              <div>
                <p style={{ fontWeight: '600', color: 'var(--safe)' }}>Did you know?</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Checking your vitals twice a day for the first week can prevent 90% of PPH complications.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'SCANNING' && (
        <PpgScanner onResult={handleScanResult} onCancel={() => setView('HOME')} />
      )}

      {view === 'RESULTS' && currentResult && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            background: currentResult.status === 'SAFE' ? 'var(--safe)' : 'var(--danger)',
            margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${currentResult.status === 'SAFE' ? 'rgba(45, 212, 191, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
          }}>
            <ShieldCheck size={40} color="white" />
          </div>
          
          <h2 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Scan Complete</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Your current health baseline</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
            <div className="glass-card" style={{ marginBottom: 0 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Heart Rate</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>{currentResult.bpm} </p>
              <p style={{ fontSize: '0.7rem' }}>BPM</p>
            </div>
            <div className="glass-card" style={{ marginBottom: 0 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shock Index</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>{currentResult.si}</p>
              <p style={{ fontSize: '0.7rem' }}>Calculated</p>
            </div>
          </div>

          <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <MessageSquare size={18} color="var(--primary)" />
                <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>Hema-AI Analysis</p>
              </div>
              <button 
                onClick={() => speak(aiAnalysis)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}
                title="Hear it again"
              >
                <div style={{ background: 'var(--primary)', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                    <Activity size={14} color="white" />
                </div>
              </button>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{aiAnalysis}</p>
          </div>

          {currentResult.status === 'DANGER' && (
            <button className="btn-primary" style={{ background: 'var(--danger)', marginBottom: '15px' }}>CALL NEAREST CLINIC</button>
          )}
          
          <button className="btn-primary" onClick={() => setView('HOME')} style={{ background: 'transparent', border: '1px solid var(--text-muted)' }}>Done</button>
        </div>
      )}

      {/* Footer Nav */}
      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '440px', zIndex: 100 }}>
        <div className="glass-card" style={{ marginBottom: 0, padding: '15px', display: 'flex', justifyContent: 'space-around', borderRadius: '30px' }}>
          <button onClick={() => setView('HOME')} style={{background:'none', border:'none', cursor:'pointer', padding: '5px'}}>
            <Heart color={view === 'HOME' ? "var(--primary)" : "var(--text-muted)"} fill={view === 'HOME' ? "var(--primary)" : "none"} />
          </button>
          <button onClick={() => setView('SCANNING')} style={{background:'none', border:'none', cursor:'pointer', padding: '5px'}}>
            <Activity color={view === 'SCANNING' ? "var(--primary)" : "var(--text-muted)"} />
          </button>
          <button onClick={() => currentResult && setView('RESULTS')} style={{background:'none', border:'none', cursor:'pointer', padding: '5px', opacity: currentResult ? 1 : 0.4}}>
            <MessageSquare color={view === 'RESULTS' ? "var(--primary)" : "var(--text-muted)"} />
          </button>
          <button onClick={() => alert("SOS Emergency Alert triggered!")} style={{background:'none', border:'none', cursor:'pointer', padding: '5px'}}>
            <AlertTriangle color="var(--text-muted)" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
