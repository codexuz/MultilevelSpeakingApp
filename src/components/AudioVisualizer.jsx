import React, { useRef, useEffect, useCallback } from 'react';

export default function AudioVisualizer({ analyserNode, isRecording, phase }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barsRef = useRef(new Array(48).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const barCount = barsRef.current.length;
    const barWidth = (WIDTH / barCount) * 0.7;
    const gap = (WIDTH / barCount) * 0.3;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (analyserNode && isRecording) {
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(dataArray);

      const step = Math.floor(dataArray.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        barsRef.current[i] = barsRef.current[i] * 0.7 + value * 0.3;
      }
    } else {
      // Idle simulation — gentle wave
      const time = Date.now() / 1000;
      for (let i = 0; i < barCount; i++) {
        const wave = Math.sin(time * 2 + i * 0.3) * 0.15 + 0.05;
        barsRef.current[i] = barsRef.current[i] * 0.9 + wave * 0.1;
      }
    }

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(2, barsRef.current[i] * HEIGHT * 0.85);
      const x = i * (barWidth + gap) + gap / 2;
      const y = (HEIGHT - barHeight) / 2;

      // Gradient based on phase
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      if (phase === 'speaking' || (isRecording && phase !== 'prep')) {
        gradient.addColorStop(0, '#ff1744');
        gradient.addColorStop(0.5, '#ff6090');
        gradient.addColorStop(1, '#ff1744');
      } else if (phase === 'prep') {
        gradient.addColorStop(0, '#00e676');
        gradient.addColorStop(0.5, '#69f0ae');
        gradient.addColorStop(1, '#00e676');
      } else {
        gradient.addColorStop(0, '#6c63ff');
        gradient.addColorStop(0.5, '#b388ff');
        gradient.addColorStop(1, '#6c63ff');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 3);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isRecording, phase]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <div className="audio-visualizer">
      <canvas
        ref={canvasRef}
        width={480}
        height={100}
        className="audio-visualizer__canvas"
      />
      {isRecording && (
        <div className="audio-visualizer__recording-indicator">
          <span className="audio-visualizer__dot" />
          REC
        </div>
      )}
    </div>
  );
}
