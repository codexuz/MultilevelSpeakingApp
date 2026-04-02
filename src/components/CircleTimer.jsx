import React, { useMemo } from 'react';

export default function CircleTimer({ timeLeft, totalTime, phase, size = 200 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const dashOffset = circumference * (1 - progress);

  const isPrep = phase === 'prep';
  const isSpeaking = phase === 'speaking';
  const isDone = phase === 'done';

  const primaryColor = isPrep ? '#00e676' : isSpeaking ? '#ff1744' : '#666';
  const glowColor = isPrep ? 'rgba(0, 230, 118, 0.3)' : isSpeaking ? 'rgba(255, 23, 68, 0.3)' : 'transparent';
  const bgTrackColor = isPrep ? 'rgba(0, 230, 118, 0.08)' : isSpeaking ? 'rgba(255, 23, 68, 0.08)' : 'rgba(255,255,255,0.05)';

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  const phaseLabel = isPrep ? 'PREPARE' : isSpeaking ? 'SPEAKING' : isDone ? 'DONE' : 'READY';

  const pulseClass = (isSpeaking && timeLeft <= 10) ? 'pulse-warning' : '';

  return (
    <div className={`circle-timer ${pulseClass}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="circle-timer__svg"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgTrackColor}
          strokeWidth="8"
        />

        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={primaryColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: 'stroke-dashoffset 0.95s linear, stroke 0.5s ease',
            filter: 'url(#glow)',
          }}
        />

        {/* Glow ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={glowColor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: 'stroke-dashoffset 0.95s linear',
          }}
        />
      </svg>

      <div className="circle-timer__content">
        <span className="circle-timer__label">{phaseLabel}</span>
        <span className="circle-timer__time" style={{ color: primaryColor }}>
          {timeDisplay}
        </span>
        <span className="circle-timer__unit">
          {phase === 'idle' ? '' : 'seconds'}
        </span>
      </div>
    </div>
  );
}
