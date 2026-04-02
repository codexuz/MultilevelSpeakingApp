import { useState, useRef, useCallback, useEffect } from 'react';

const PHASES = {
  IDLE: 'idle',
  PREP: 'prep',
  SPEAKING: 'speaking',
  DONE: 'done',
};

export function useTimer() {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const intervalRef = useRef(null);
  const callbackRef = useRef(null);
  const speakingTimeRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const playBeep = useCallback((frequency = 880, duration = 300, count = 1) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let startTime = ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(0.5, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration / 1000);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration / 1000);

      startTime += (duration + 150) / 1000;
    }
  }, []);

  const startCountdown = useCallback((seconds, currentPhase, onComplete) => {
    clearTimer();
    setTimeLeft(seconds);
    setTotalTime(seconds);
    setPhase(currentPhase);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          if (onComplete) onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const start = useCallback((prepTime, speakingTime, onSpeakingStart, onComplete) => {
    speakingTimeRef.current = speakingTime;
    callbackRef.current = { onSpeakingStart, onComplete };

    startCountdown(prepTime, PHASES.PREP, () => {
      // Prep done — beep and start speaking
      playBeep(880, 250, 2);
      if (callbackRef.current?.onSpeakingStart) {
        callbackRef.current.onSpeakingStart();
      }

      startCountdown(speakingTime, PHASES.SPEAKING, () => {
        // Speaking done — beep
        playBeep(660, 400, 3);
        setPhase(PHASES.DONE);
        if (callbackRef.current?.onComplete) {
          callbackRef.current.onComplete();
        }
      });
    });
  }, [startCountdown, playBeep]);

  const stop = useCallback(() => {
    clearTimer();
    setPhase(PHASES.DONE);
    setTimeLeft(0);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setPhase(PHASES.IDLE);
    setTimeLeft(0);
    setTotalTime(0);
  }, [clearTimer]);

  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    phase,
    timeLeft,
    totalTime,
    progress,
    start,
    stop,
    reset,
    playBeep,
    PHASES,
  };
}
