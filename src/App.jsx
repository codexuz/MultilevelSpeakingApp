import React, { useState, useCallback, useRef, useEffect } from 'react';
import questions from './data/questions.json';
import QuestionCard from './components/QuestionCard';
import CircleTimer from './components/CircleTimer';
import AudioVisualizer from './components/AudioVisualizer';
import ResultsScreen from './components/ResultsScreen';
import { useTimer } from './hooks/useTimer';
import { useAudioRecorder } from './hooks/useAudioRecorder';

const SCREENS = {
  HOME: 'home',
  TEST: 'test',
  RESULTS: 'results',
};

function App() {
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [questionPhase, setQuestionPhase] = useState('idle'); // idle, reading, prep, speaking, done

  const timer = useTimer();
  const recorder = useAudioRecorder();

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;
  const ttsRef = useRef(null);
  const autoStartedRef = useRef(false);

  // Speak question text using TTS
  const speakQuestion = useCallback((text) => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to find an English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en-'));
        if (englishVoice) utterance.voice = englishVoice;
        
        utterance.onend = resolve;
        utterance.onerror = resolve;
        ttsRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }, []);

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Start the test
  const handleStartTest = useCallback(() => {
    autoStartedRef.current = false;
    setScreen(SCREENS.TEST);
    setCurrentIndex(0);
    setTestStarted(false);
    setQuestionPhase('idle');
    timer.reset();
  }, [timer]);

  // Auto-start question when entering test screen or moving to next question
  useEffect(() => {
    if (screen === SCREENS.TEST && questionPhase === 'idle' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      // Small delay to let the UI render the question card first
      const timeout = setTimeout(() => {
        handleBeginQuestion();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [screen, questionPhase, currentIndex]);

  // Auto-advance to next question when current one is done
  useEffect(() => {
    if (questionPhase === 'done') {
      const timeout = setTimeout(() => {
        handleNextQuestion();
      }, 1500); // Brief pause so user sees "done" state
      return () => clearTimeout(timeout);
    }
  }, [questionPhase]);

  // Begin a question flow: TTS → prep timer → beep → speaking timer → beep
  const handleBeginQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    setTestStarted(true);
    setQuestionPhase('reading');

    // Read the question aloud
    await speakQuestion(currentQuestion.q_text);

    setQuestionPhase('prep');

    // Start timer: prep → speaking
    timer.start(
      currentQuestion.prep_timer,
      currentQuestion.speaking_timer,
      // On speaking start
      () => {
        setQuestionPhase('speaking');
        recorder.startRecording(currentQuestion.id);
      },
      // On complete
      () => {
        setQuestionPhase('done');
        recorder.stopRecording();
      }
    );
  }, [currentQuestion, speakQuestion, timer, recorder]);

  // Move to next question
  const handleNextQuestion = useCallback(() => {
    if (isLastQuestion) {
      setScreen(SCREENS.RESULTS);
      setTestStarted(false);
      return;
    }
    autoStartedRef.current = false;
    setCurrentIndex((prev) => prev + 1);
    setTestStarted(false);
    setQuestionPhase('idle');
    timer.reset();
  }, [isLastQuestion, timer]);

  // Skip current (stop recording and move on)
  const handleSkip = useCallback(() => {
    window.speechSynthesis.cancel();
    timer.stop();
    recorder.stopRecording();
    setQuestionPhase('done');
    
    setTimeout(() => {
      handleNextQuestion();
    }, 300);
  }, [timer, recorder, handleNextQuestion]);

  // Restart
  const handleRestart = useCallback(() => {
    window.speechSynthesis.cancel();
    timer.reset();
    setScreen(SCREENS.HOME);
    setCurrentIndex(0);
    setTestStarted(false);
    setQuestionPhase('idle');
  }, [timer]);

  // HOME SCREEN
  if (screen === SCREENS.HOME) {
    return (
      <div className="app">
        <div className="home-screen">
          <div className="home-screen__glow home-screen__glow--1" />
          <div className="home-screen__glow home-screen__glow--2" />

          <div className="home-screen__content">
            <div className="home-screen__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#mic-gradient)" strokeWidth="1.5">
                <defs>
                  <linearGradient id="mic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6c63ff" />
                    <stop offset="100%" stopColor="#00e676" />
                  </linearGradient>
                </defs>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>

            <h1 className="home-screen__title">Speaking Practice</h1>
            <p className="home-screen__subtitle">
              Master your speaking skills with timed practice sessions.
              <br />
              {questions.length} questions across all parts.
            </p>

            <div className="home-screen__parts">
              {[
                { part: '1.1', label: 'Introduction', count: questions.filter(q => q.part === '1.1').length, color: '#6c63ff', icon: '💬' },
                { part: '1.2', label: 'Visual', count: questions.filter(q => q.part === '1.2').length, color: '#00c9a7', icon: '🖼️' },
                { part: '2', label: 'Long Turn', count: questions.filter(q => q.part === '2').length, color: '#f7971e', icon: '🎤' },
                { part: '3', label: 'Discussion', count: questions.filter(q => q.part === '3').length, color: '#fc5c7d', icon: '💡' },
              ].map((item) => (
                <div key={item.part} className="home-screen__part-card">
                  <span className="home-screen__part-icon">{item.icon}</span>
                  <span className="home-screen__part-label" style={{ color: item.color }}>
                    Part {item.part}
                  </span>
                  <span className="home-screen__part-name">{item.label}</span>
                  <span className="home-screen__part-count">{item.count} questions</span>
                </div>
              ))}
            </div>

            <button className="btn btn--start" onClick={handleStartTest}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Practice Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (screen === SCREENS.RESULTS) {
    return (
      <div className="app">
        <ResultsScreen
          questions={questions}
          recordings={recorder.recordings}
          onRestart={handleRestart}
          downloadRecording={recorder.downloadRecording}
          downloadAll={recorder.downloadAll}
        />
      </div>
    );
  }

  // TEST SCREEN
  return (
    <div className="app">
      <div className="test-screen">
        {/* Top bar */}
        <div className="test-screen__topbar">
          <button className="btn btn--ghost" onClick={handleRestart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Exit
          </button>
          <div className="test-screen__progress">
            <span className="test-screen__progress-text">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="test-screen__progress-bar">
              <div
                className="test-screen__progress-fill"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            className="btn btn--ghost"
            onClick={handleSkip}
          >
            Skip
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Question Card */}
        <QuestionCard question={currentQuestion} isActive={testStarted} />

        {/* Timer */}
        <div className="test-screen__timer-section">
          <CircleTimer
            timeLeft={timer.timeLeft}
            totalTime={timer.totalTime}
            phase={timer.phase}
            size={180}
          />
        </div>

        {/* Audio Visualizer */}
        <AudioVisualizer
          analyserNode={recorder.getAnalyser()}
          isRecording={recorder.isRecording}
          phase={timer.phase}
        />

        {/* Status Indicator */}
        <div className="test-screen__actions">
          {questionPhase === 'idle' && (
            <div className="test-screen__status">
              <div className="test-screen__status-dot reading" />
              Starting...
            </div>
          )}
          {questionPhase === 'reading' && (
            <div className="test-screen__status">
              <div className="test-screen__status-dot reading" />
              Reading question aloud...
            </div>
          )}
          {questionPhase === 'prep' && (
            <div className="test-screen__status">
              <div className="test-screen__status-dot prep" />
              Get ready to speak...
            </div>
          )}
          {questionPhase === 'speaking' && (
            <div className="test-screen__status">
              <div className="test-screen__status-dot speaking" />
              Recording your answer...
            </div>
          )}
          {questionPhase === 'done' && (
            <div className="test-screen__status">
              <div className="test-screen__status-dot prep" />
              {isLastQuestion ? 'Finishing test...' : 'Moving to next question...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
