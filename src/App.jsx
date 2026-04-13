import React, { useState, useEffect } from 'react';
import { Heart, Activity, AlertTriangle, ShieldCheck, Info, MessageSquare, ChevronRight, History } from 'lucide-react';
import PpgScanner from './components/PpgScanner';
import './index.css';

const App = () => {
  const [view, setView] = useState('HOME');
  const [history, setHistory] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [userGender, setUserGender] = useState('female'); // 'female' or 'male'
  const [showGenderModal, setShowGenderModal] = useState(true);

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

    // Gender-specific prompts and fallbacks
    const isFemale = userGender === 'female';
    const addressTerm = isFemale ? "Mama" : "Papa";
    const systemPrompt = isFemale
      ? "You are Hema-AI, a maternal health assistant for Nigerian mothers. SPEAK ONLY IN WARM, CLEAR NIGERIAN PIDGIN ENGLISH. Explain the scan results. If the status is SAFE, tell her 'No shaking, you and pikin dey fine.' If the status is DANGER, tell her 'Abeg, call doctor sharp-sharp, no delay!' Use local food examples for safety (like Moin-Moin, Akara). Keep it very short (max 3 sentences)."
      : "You are Hema-AI, a health assistant for Nigerian fathers/caregivers. SPEAK ONLY IN WARM, CLEAR NIGERIAN PIDGIN ENGLISH. Explain the scan results. If the status is SAFE, tell him 'No shaking, you dey strong!' If the status is DANGER, tell him 'Abeg, see doctor sharp-sharp, no delay!' Keep it very short (max 3 sentences).";

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
            content: systemPrompt
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
      // More specific fallback messages based on actual values
      let fallback = "";
      if (result.status === 'SAFE') {
        if (result.bpm < 70) {
          fallback = `${addressTerm}, your heart rate dey low ( ${result.bpm} BPM). You fit be athlete type! Just maintain am with balanced diet and rest.`;
        } else if (result.bpm > 90) {
          fallback = `${addressTerm}, your heart rate dey on higher side (${result.bpm} BPM). Reduce stress, drink more water, and rest well today.`;
        } else {
          fallback = `${addressTerm}, no worry, your vitals dey perfect! Heart rate ${result.bpm} BPM and Shock Index ${result.si} dey normal range. Continue am!`;
        }
      } else if (result.status === 'WARNING') {
        if (result.si > 0.85) {
          fallback = `${addressTerm}, your Shock Index dey high (${result.si}). Make you rest well, avoid stress, and monitor am close. If e no reduce, see doctor.`;
        } else {
          fallback = `${addressTerm}, take am easy today. Your heart rate dey slightly elevated. Rest, drink plenty water, and check again later.`;
        }
      } else {
        if (result.bpm > 110) {
          fallback = `${addressTerm}, abeg call doctor sharp-sharp! Your heart rate very high (${result.bpm} BPM). No waste time!`;
        } else {
          fallback = `${addressTerm}, your Shock Index critical (${result.si}). This fit mean internal issue. Abeg, see doctor immediately, no delay!`;
        }
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
      {/* Gender Selection Modal */}
      {showGenderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: '30px', textAlign: 'center', maxWidth: '350px', margin: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--primary)' }}>Welcome to HemaPulse</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.95rem' }}>Select your gender for personalized health insights:</p>
            <button
              className="btn-primary"
              onClick={() => { setUserGender('female'); setShowGenderModal(false); }}
              style={{ marginBottom: '15px', background: 'linear-gradient(135deg, #ec4899, #f472b6)' }}
            >
              👩 Female
            </button>
            <button
              className="btn-primary"
              onClick={() => { setUserGender('male'); setShowGenderModal(false); }}
              style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)' }}
            >
              👨 Male
            </button>
            <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              You can change this in settings anytime.
            </p>
          </div>
        </div>
      )}

      {view === 'HOME' && (
        <>
          <div className="glass-card pulse-animation" style={{ padding: '30px', textAlign: 'center', border: '1px solid var(--primary-glow)' }}>
            <Activity size={48} color="rgba(255,255,255,0.7)" style={{ marginBottom: '15px' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Ready for Scan</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px' }}>
              {userGender === 'female'
                ? 'Check your vitals to ensure perfect health post-delivery.'
                : 'Check your vitals to monitor your health and fitness.'}
            </p>
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
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {userGender === 'female'
                    ? 'Checking your vitals twice a day for the first week can prevent 90% of PPH complications.'
                    : 'Regular heart rate monitoring can help detect early signs of cardiovascular issues and stress.'}
                </p>
              </div>
            </div>
          </div>

          {/* Gender Settings */}
          <div className="glass-card" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>Gender Setting</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current: {userGender === 'female' ? 'Female' : 'Male'}</p>
            </div>
            <button
              onClick={() => setShowGenderModal(true)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Change
            </button>
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
          <button onClick={() => setView('HOME')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
            <Heart color={view === 'HOME' ? "var(--primary)" : "var(--text-muted)"} fill={view === 'HOME' ? "var(--primary)" : "none"} />
          </button>
          <button onClick={() => setView('SCANNING')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
            <Activity color={view === 'SCANNING' ? "var(--primary)" : "var(--text-muted)"} />
          </button>
          <button onClick={() => currentResult && setView('RESULTS')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', opacity: currentResult ? 1 : 0.4 }}>
            <MessageSquare color={view === 'RESULTS' ? "var(--primary)" : "var(--text-muted)"} />
          </button>
          <button onClick={() => alert("SOS Emergency Alert triggered!")} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
            <AlertTriangle color="var(--text-muted)" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
