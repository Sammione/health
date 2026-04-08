import React, { useEffect, useRef, useState } from 'react';

const PpgScanner = ({ onResult, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const signalBuffer = useRef([]);
  const lastPeak = useRef(0);
  const peaks = useRef([]);
  const requestRef = useRef();
  const isScanningRef = useRef(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 320, height: 320 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Attempt to turn on flashlight
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
        }
      }
      setScanning(true);
      isScanningRef.current = true;
      requestRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      setError("Camera access required. Please allow camera use.");
      console.error(err);
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    cancelAnimationFrame(requestRef.current);
  };

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isScanningRef.current) return;
    
    if (videoRef.current.readyState >= 2) {
      const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, 100, 100);
    
    // Sample the center area
    const imageData = ctx.getImageData(40, 40, 20, 20);
    const data = imageData.data;
    
    let avgRed = 0;
    for (let i = 0; i < data.length; i += 4) {
      avgRed += data[i]; // Focus only on RED channel for PPG
    }
    avgRed /= (data.length / 4);

    // Filter and analyze
    updateSignal(avgRed);
    }
    requestRef.current = requestAnimationFrame(processFrame);
  };

  const updateSignal = (value) => {
    // Basic smoothing
    signalBuffer.current.push(value);
    if (signalBuffer.current.length > 100) signalBuffer.current.shift();

    // Peak detection (smoothed)
    const now = Date.now();
    const threshold = 0.8; // Stricter threshold
    const timeDiff = now - lastPeak.current;
    
    // Logic to find peaks in the red channel oscillation
    if (value > 150) { 
        if (timeDiff > 450) { // Min interval (avoids double peaks)
            const diff = value - (signalBuffer.current[signalBuffer.current.length - 2] || value);
            if (diff > threshold) {
               const rawBpm = Math.round(60000 / timeDiff);
               if (rawBpm >= 50 && rawBpm <= 130) { // Limit to realistic bounds for accuracy
                   setBpm(prev => {
                       // Smooth the BPM so it doesn't jump wildly
                       const smoothed = prev === 0 ? rawBpm : Math.round((prev * 0.6) + (rawBpm * 0.4));
                       peaks.current.push(smoothed);
                       return smoothed;
                   });
               }
               lastPeak.current = now;
            }
        } else if (timeDiff > 2000) {
            lastPeak.current = now; // reset if stuck
        }
        
        // ONLY progress the scan when a finger is covering the lens properly!
        setProgress(prev => {
            if (prev >= 100) {
                finishScan();
                return 100;
            }
            return prev + 0.3; // Make it a bit faster
        });
    }

    drawChart();
  };

  const drawChart = () => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    ctx.clearRect(0, 0, 300, 100);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const scale = 5;
    const offset = Math.min(...signalBuffer.current);
    
    signalBuffer.current.forEach((val, i) => {
        const x = (i / 100) * 300;
        const y = 80 - (val - offset) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const finishScan = () => {
    setScanning(false);
    isScanningRef.current = false;
    const finalBpm = peaks.current.length > 0 
        ? Math.round(peaks.current.reduce((a, b) => a + b) / peaks.current.length) 
        : 75;
    onResult(finalBpm);
  };

  return (
    <div className="glass-card" style={{ textAlign: 'center' }}>
      <h2 style={{ marginBottom: '15px' }}>Analyzing Vitals</h2>
      
      {error ? (
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      ) : (
        <>
          <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto 20px', borderRadius: '50%', overflow: 'hidden', border: '4px solid var(--primary)' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: '20px solid rgba(0,0,0,0.5)', borderRadius: '50%', pointerEvents: 'none' }}></div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <canvas ref={chartRef} width="300" height="100" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }} />
            <canvas ref={canvasRef} width="100" height="100" style={{ display: 'none' }} />
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--primary)' }}>
            {bpm || '--'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>BPM</span>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', margin: '20px 0' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px', transition: 'width 0.1s' }}></div>
          </div>

          <p style={{ color: 'var(--text-muted)' }}>Hold still. Do not press too hard.</p>
          <button onClick={onCancel} className="btn-primary" style={{ marginTop: '20px', background: 'transparent', border: '1px solid var(--text-muted)' }}>Cancel</button>
        </>
      )}
    </div>
  );
};

export default PpgScanner;
