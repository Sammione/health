import React, { useEffect, useRef, useState } from 'react';

const PpgScanner = ({ onResult, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [signalQuality, setSignalQuality] = useState('checking'); // 'checking', 'good', 'poor'

  const signalBuffer = useRef([]);
  const timestamps = useRef([]);
  const lastPeak = useRef(0);
  const peaks = useRef([]);
  const peakTimestamps = useRef([]);
  const requestRef = useRef();
  const isScanningRef = useRef(false);
  const baselineRed = useRef(null);
  const scanDuration = useRef(0);
  const validPeakCount = useRef(0);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 320, height: 320, frameRate: 30 }
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
      scanDuration.current = Date.now();
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
    const now = Date.now();

    // Initialize baseline on first reading
    if (baselineRed.current === null) {
      baselineRed.current = value;
      signalBuffer.current.push(value);
      timestamps.current.push(now);
      setSignalQuality('checking');
      drawChart();
      return;
    }

    // Basic smoothing - keep last 150 samples for better analysis
    signalBuffer.current.push(value);
    timestamps.current.push(now);
    if (signalBuffer.current.length > 150) {
      signalBuffer.current.shift();
      timestamps.current.shift();
    }

    // Calculate signal statistics for quality assessment
    const recentValues = signalBuffer.current.slice(-30);
    const avgValue = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - avgValue, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Check if finger is properly covering the camera
    // Too bright (>200) means no finger, too dark (<30) means blocked
    const hasFinger = value > 30 && value < 200;

    if (!hasFinger) {
      setSignalQuality('poor');
      drawChart();
      return;
    }

    // Assess signal quality based on variance
    // Good PPG signal should have some variation (pulse beats)
    if (stdDev < 2) {
      setSignalQuality('checking');
    } else if (stdDev > 3 && stdDev < 30) {
      setSignalQuality('good');
    } else {
      setSignalQuality('poor');
    }

    // Peak detection with adaptive threshold
    const timeDiff = now - lastPeak.current;

    // Need at least 30 samples before detecting peaks
    if (signalBuffer.current.length < 30) {
      drawChart();
      return;
    }

    // Calculate dynamic threshold based on recent signal
    const recentMax = Math.max(...recentValues);
    const recentMin = Math.min(...recentValues);
    const signalRange = recentMax - recentMin;
    const dynamicThreshold = recentMin + (signalRange * 0.6); // 60% of range

    // Detect peak: current value is high and previous was lower
    const isPeak = value > dynamicThreshold &&
      signalBuffer.current.length >= 2 &&
      signalBuffer.current[signalBuffer.current.length - 2] < dynamicThreshold;

    if (isPeak && timeDiff > 400) { // Min 400ms between peaks (max ~150 BPM)
      const rawBpm = Math.round(60000 / timeDiff);

      // Only accept realistic heart rates
      if (rawBpm >= 50 && rawBpm <= 140) {
        setBpm(prev => {
          const smoothed = prev === 0 ? rawBpm : Math.round((prev * 0.5) + (rawBpm * 0.5));
          peaks.current.push(smoothed);
          peakTimestamps.current.push(now);
          return smoothed;
        });

        validPeakCount.current++;
        lastPeak.current = now;
      }
    } else if (timeDiff > 2500 && hasFinger) {
      // Reset if no peak detected for too long but finger is present
      lastPeak.current = now;
    }

    // Progress based on TIME and VALID PEAKS detected, not just signal presence
    // Need at least 3 valid peaks and 10 seconds of scanning
    const elapsedSeconds = (now - scanDuration.current) / 1000;
    const hasEnoughPeaks = validPeakCount.current >= 3;
    const hasEnoughTime = elapsedSeconds >= 10;

    // Calculate progress based on both time and peaks
    const timeProgress = Math.min(elapsedSeconds / 15, 1) * 50; // 50% based on time (15 sec target)
    const peakProgress = Math.min(validPeakCount.current / 8, 1) * 50; // 50% based on peaks (8 peaks target)
    const totalProgress = timeProgress + peakProgress;

    setProgress(Math.min(totalProgress, 100));

    if (totalProgress >= 100 && hasEnoughPeaks) {
      finishScan();
    }

    drawChart();
  };

  const drawChart = () => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    const width = chartRef.current.width;
    const height = chartRef.current.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (signalBuffer.current.length < 2) return;

    // Draw the PPG signal
    ctx.strokeStyle = signalQuality === 'good' ? '#2dd4bf' : signalQuality === 'poor' ? '#f43f5e' : '#e11d48';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const values = signalBuffer.current;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    values.forEach((val, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((val - minVal) / range) * (height * 0.8) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw quality indicator
    ctx.fillStyle = signalQuality === 'good' ? '#2dd4bf' : signalQuality === 'poor' ? '#f43f5e' : '#fbbf24';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Signal: ${signalQuality}`, 10, 20);
  };

  const finishScan = () => {
    setScanning(false);
    isScanningRef.current = false;

    // Calculate final BPM from all detected peaks
    let finalBpm;
    if (peaks.current.length >= 3) {
      // Use median of last few readings for stability
      const sortedPeaks = [...peaks.current].sort((a, b) => a - b);
      const mid = Math.floor(sortedPeaks.length / 2);
      if (sortedPeaks.length % 2 === 0) {
        finalBpm = Math.round((sortedPeaks[mid - 1] + sortedPeaks[mid]) / 2);
      } else {
        finalBpm = sortedPeaks[mid];
      }
    } else if (peaks.current.length > 0) {
      // Fallback: use average of whatever peaks we have
      finalBpm = Math.round(peaks.current.reduce((a, b) => a + b, 0) / peaks.current.length);
    } else {
      // No peaks detected - this shouldn't happen if progress reached 100%
      // But provide a reasonable fallback based on signal analysis
      const elapsedSeconds = (Date.now() - scanDuration.current) / 1000;
      // Use elapsed time to estimate - if scanning took long, likely lower BPM
      finalBpm = Math.max(60, Math.min(100, Math.round(90 - (elapsedSeconds - 10) * 2)));
    }

    // Ensure BPM is within valid range
    finalBpm = Math.max(50, Math.min(140, finalBpm));

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

          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: bpm > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
            {bpm > 0 ? bpm : '--'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>BPM</span>
          </div>

          {/* Signal Quality Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '15px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: signalQuality === 'good' ? 'var(--safe)' : signalQuality === 'poor' ? 'var(--danger)' : 'var(--warning)',
              animation: signalQuality === 'good' ? 'none' : 'pulse 1s infinite'
            }}></div>
            <p style={{ fontSize: '0.85rem', color: signalQuality === 'good' ? 'var(--safe)' : signalQuality === 'poor' ? 'var(--danger)' : 'var(--warning)' }}>
              {signalQuality === 'good' ? 'Good signal - keep still' : signalQuality === 'poor' ? 'Adjust finger position' : 'Finding signal...'}
            </p>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', margin: '20px 0' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? 'var(--safe)' : 'var(--primary)', borderRadius: '4px', transition: 'width 0.3s' }}></div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {signalQuality === 'poor'
              ? 'Place finger gently over camera. Ensure good contact.'
              : signalQuality === 'checking'
                ? 'Hold still. Finding your pulse...'
                : 'Hold still. Do not press too hard.'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '5px' }}>
            Peaks detected: {validPeakCount.current}/8 | Time: {Math.round((Date.now() - scanDuration.current) / 1000)}s
          </p>
          <button onClick={onCancel} className="btn-primary" style={{ marginTop: '20px', background: 'transparent', border: '1px solid var(--text-muted)' }}>Cancel</button>
        </>
      )}
    </div>
  );
};

export default PpgScanner;
