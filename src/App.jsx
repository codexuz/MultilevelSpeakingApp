import React, { useState, useCallback, useRef, useEffect } from 'react';
import initialQuestions from './data/questions.json';
import QuestionCard from './components/QuestionCard';
import CircleTimer from './components/CircleTimer';
import AudioVisualizer from './components/AudioVisualizer';
import ResultsScreen from './components/ResultsScreen';
import PinLogin from './components/PinLogin';
import AdminDashboard from './components/AdminDashboard';
import { useTimer } from './hooks/useTimer';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import {
  verifyStudentPassword,
  verifyAdminPassword,
  seedQuestionsFromJson,
  getAllQuestions,
  getAllTests,
  getQuestionsByTestId,
  addStudent,
  createTestSession,
  completeTestSession,
  saveTestAnswer,
  updateStudentPassword,
  updateAdminPassword,
} from './services/database';

const SCREENS = {
  LOGIN: 'login',
  HOME: 'home',
  TEST: 'test',
  RESULTS: 'results',
  ADMIN: 'admin',
};

function App() {
  const [screen, setScreen] = useState(SCREENS.LOGIN);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [questionPhase, setQuestionPhase] = useState('idle');
  const [questions, setQuestions] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);

  const timer = useTimer();
  const recorder = useAudioRecorder();

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;
  const ttsRef = useRef(null);
  const autoStartedRef = useRef(false);

  // Initialize database
  useEffect(() => {
    async function init() {
      try {
        // Seed default questions from JSON on first run
        await seedQuestionsFromJson(initialQuestions);
        
        // Load tests from DB
        const dbTests = await getAllTests();
        setTests(dbTests);

        setDbReady(true);
      } catch (err) {
        console.error('DB init error:', err);
        // Fallback or handle error
        setDbReady(true);
      }
    }
    init();
  }, []);

  // Reload tests/questions from DB (after admin changes)
  const reloadData = useCallback(async () => {
    try {
      const dbTests = await getAllTests();
      setTests(dbTests);
      if (selectedTest) {
        const dbQuestions = await getQuestionsByTestId(selectedTest.id);
        setQuestions(dbQuestions);
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  }, [selectedTest]);

  // Speak question text using TTS
  const speakQuestion = useCallback((text) => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

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

  // ─── Login Handlers ─────────────────────────────────────────
  const handleStudentLogin = useCallback(async (password, studentName) => {
    const valid = await verifyStudentPassword(password);
    if (!valid) return false;

    // Create or find student
    let studentId = null;
    if (studentName) {
      studentId = await addStudent(studentName);
    }
    setCurrentStudentId(studentId);
    
    // Reload data from DB
    await reloadData();

    setScreen(SCREENS.HOME);
    return true;
  }, [reloadData]);

  const handleAdminLogin = useCallback(async (password) => {
    const valid = await verifyAdminPassword(password);
    if (!valid) return false;

    setScreen(SCREENS.ADMIN);
    return true;
  }, []);

  const handleAdminLogout = useCallback(async () => {
    await reloadData();
    const pinSet = await isPinSet();
    const adminSet = await isAdminPasswordSet();
    setPinConfigured(pinSet);
    setAdminConfigured(adminSet);
    setScreen(SCREENS.LOGIN);
  }, [reloadData]);

  // ─── Test Flow ──────────────────────────────────────────────
  const handleSelectTest = useCallback(async (test) => {
    const testQs = await getQuestionsByTestId(test.id);
    setQuestions(testQs);
    setSelectedTest(test);
  }, []);

  const handleStartTest = useCallback(async () => {
    if (!selectedTest || questions.length === 0) return;
    autoStartedRef.current = false;
    
    // Create a test session
    if (currentStudentId) {
      const sessionId = await createTestSession(currentStudentId, selectedTest.id, questions.length);
      setCurrentSessionId(sessionId);
    }

    setScreen(SCREENS.TEST);
    setCurrentIndex(0);
    setTestStarted(false);
    setQuestionPhase('idle');
    timer.reset();
  }, [timer, currentStudentId, questions.length, selectedTest]);

  // Auto-start question
  useEffect(() => {
    if (screen === SCREENS.TEST && questionPhase === 'idle' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const timeout = setTimeout(() => {
        handleBeginQuestion();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [screen, questionPhase, currentIndex]);

  // Auto-advance
  useEffect(() => {
    if (questionPhase === 'done') {
      const timeout = setTimeout(() => {
        handleNextQuestion();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [questionPhase]);

  const handleBeginQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    setTestStarted(true);
    setQuestionPhase('reading');

    await speakQuestion(currentQuestion.q_text);
    setQuestionPhase('prep');

    timer.start(
      currentQuestion.prep_timer,
      currentQuestion.speaking_timer,
      () => {
        setQuestionPhase('speaking');
        recorder.startRecording(currentQuestion.id);
      },
      async () => {
        setQuestionPhase('done');
        recorder.stopRecording();
        
        // Save answer to DB
        if (currentSessionId) {
          await saveTestAnswer(currentSessionId, currentQuestion.id, true);
        }
      }
    );
  }, [currentQuestion, speakQuestion, timer, recorder, currentSessionId]);

  const handleNextQuestion = useCallback(() => {
    if (isLastQuestion) {
      // Complete test session
      if (currentSessionId) {
        completeTestSession(currentSessionId, recorder.recordings.length);
      }
      setScreen(SCREENS.RESULTS);
      setTestStarted(false);
      return;
    }
    autoStartedRef.current = false;
    setCurrentIndex((prev) => prev + 1);
    setTestStarted(false);
    setQuestionPhase('idle');
    timer.reset();
  }, [isLastQuestion, timer, currentSessionId, recorder.recordings.length]);

  const handleSkip = useCallback(async () => {
    window.speechSynthesis.cancel();
    timer.stop();
    recorder.stopRecording();
    setQuestionPhase('done');

    // Save skipped answer
    if (currentSessionId && currentQuestion) {
      await saveTestAnswer(currentSessionId, currentQuestion.id, false);
    }

    setTimeout(() => {
      handleNextQuestion();
    }, 300);
  }, [timer, recorder, handleNextQuestion, currentSessionId, currentQuestion]);

  const handleRestart = useCallback(() => {
    window.speechSynthesis.cancel();
    timer.reset();
    setScreen(SCREENS.HOME);
    setCurrentIndex(0);
    setTestStarted(false);
    setQuestionPhase('idle');
    // Clear selected test to go back to list
    setSelectedTest(null);
    setQuestions([]);
  }, [timer]);

  const handleLogout = useCallback(() => {
    window.speechSynthesis.cancel();
    timer.reset();
    setScreen(SCREENS.LOGIN);
    setCurrentIndex(0);
    setTestStarted(false);
    setQuestionPhase('idle');
    setCurrentStudentId(null);
    setCurrentSessionId(null);
    setSelectedTest(null);
    setQuestions([]);
  }, [timer]);

  // ─── Loading State ─────────────────────────────────────────
  if (!dbReady) {
    return (
      <div className="app">
        <div className="app__loading">
          <div className="admin__spinner" />
          <span>Initializing...</span>
        </div>
      </div>
    );
  }

  // ─── LOGIN SCREEN ──────────────────────────────────────────
  if (screen === SCREENS.LOGIN) {
    return (
      <div className="app">
        <PinLogin
          onStudentLogin={handleStudentLogin}
          onAdminLogin={handleAdminLogin}
        />
      </div>
    );
  }

  // ─── ADMIN SCREEN ─────────────────────────────────────────
  if (screen === SCREENS.ADMIN) {
    return (
      <div className="app">
        <AdminDashboard onLogout={handleAdminLogout} />
      </div>
    );
  }

  // ─── HOME SCREEN (Test List + Details) ─────────────────────
  if (screen === SCREENS.HOME) {
    return (
      <div className="app">
        <div className="home-screen">
          <div className="home-screen__glow home-screen__glow--1" />
          <div className="home-screen__glow home-screen__glow--2" />

          <div className="home-screen__content">
            {!selectedTest ? (
              <>
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
                <h1 className="home-screen__title">Select Your Test</h1>
                <p className="home-screen__subtitle">Choose a practice test from the list below to begin.</p>
                
                <div className="home-screen__tests-grid">
                  {tests.map(test => (
                    <div key={test.id} className="home-screen__test-card" onClick={() => handleSelectTest(test)}>
                      <div className="test-card__status">Available</div>
                      <h3 className="test-card__title">{test.title}</h3>
                      <p className="test-card__description">{test.description || 'Practice your speaking skills with this mock test.'}</p>
                      <div className="test-card__footer">
                        <span>Part 1, 2, 3</span>
                        <div className="test-card__arrow">→</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="home-screen__actions">
                  <button className="btn btn--ghost" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="home-screen__icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#mic-gradient)" strokeWidth="1.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>

                <h1 className="home-screen__title">{selectedTest.title}</h1>
                <p className="home-screen__subtitle">
                  {selectedTest.description || 'Master your speaking skills with timed practice sessions.'}
                  <br />
                  {questions.length} questions across all parts.
                </p>

                <div className="home-screen__parts">
                  {[
                    { part: '1.1', label: 'Introduction', color: '#6c63ff', icon: '💬' },
                    { part: '1.2', label: 'Visual', color: '#00c9a7', icon: '🖼️' },
                    { part: '2', label: 'Long Turn', color: '#f7971e', icon: '🎤' },
                    { part: '3', label: 'Discussion', color: '#fc5c7d', icon: '💡' },
                  ].map((item) => (
                    <div key={item.part} className="home-screen__part-card">
                      <span className="home-screen__part-icon">{item.icon}</span>
                      <span className="home-screen__part-label" style={{ color: item.color }}>
                        Part {item.part}
                      </span>
                      <span className="home-screen__part-name">{item.label}</span>
                      <span className="home-screen__part-count">
                        {questions.filter(q => q.part === item.part).length} questions
                      </span>
                    </div>
                  ))}
                </div>

                <div className="home-screen__actions">
                  <button className="btn btn--start" onClick={handleStartTest} disabled={questions.length === 0}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Start Test
                  </button>
                  <button className="btn btn--ghost" onClick={() => setSelectedTest(null)}>
                    Back to Test List
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ────────────────────────────────────────
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

  // ─── TEST SCREEN ───────────────────────────────────────────
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
          <button className="btn btn--ghost" onClick={handleSkip}>
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
