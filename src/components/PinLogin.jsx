import React, { useState, useCallback } from 'react';

export default function PinLogin({ onStudentLogin, onAdminLogin }) {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('student'); // 'student' | 'admin'
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const triggerError = useCallback((msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleStudentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      triggerError('Enter student password');
      return;
    }
    
    // Validated format, now require name
    setShowNameInput(true);
  };

  const handleNameSubmit = async () => {
    if (!studentName.trim()) {
      triggerError('Please enter your name');
      return;
    }
    const result = await onStudentLogin(password, studentName.trim());
    if (result === false) {
      triggerError('Incorrect password');
      setPassword('');
      setShowNameInput(false);
    } else {
      setSuccess(true);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      triggerError('Enter admin password');
      return;
    }
    const result = await onAdminLogin(password);
    if (result === false) {
      triggerError('Incorrect password');
      setPassword('');
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="pin-login">
        <div className="pin-login__success">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Welcome!</span>
        </div>
      </div>
    );
  }

  if (showNameInput && mode === 'student') {
    return (
      <div className="pin-login">
        <div className="pin-login__glow pin-login__glow--1" />
        <div className="pin-login__glow pin-login__glow--2" />
        <div className="pin-login__card">
          <div className="pin-login__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#user-grad)" strokeWidth="1.5">
              <defs>
                <linearGradient id="user-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6c63ff" />
                  <stop offset="100%" stopColor="#00e676" />
                </linearGradient>
              </defs>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="pin-login__title">Enter Your Name</h2>
          <p className="pin-login__hint">Please provide your full name to start the test</p>
          
          <form onSubmit={(e) => { e.preventDefault(); handleNameSubmit(); }} className="pin-login__name-form">
            <input
              type="text"
              className="pin-login__text-input"
              placeholder="Full Name"
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <p className="pin-login__error">{error}</p>}
            <button type="submit" className="btn btn--start" style={{ width: '100%', justifyContent: 'center' }}>
              Start Test
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-login">
      <div className="pin-login__glow pin-login__glow--1" />
      <div className="pin-login__glow pin-login__glow--2" />

      <div className={`pin-login__card ${shake ? 'shake' : ''}`}>
        <div className="pin-login__icon">
          {mode === 'student' ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#lock-grad)" strokeWidth="1.5">
              <defs>
                <linearGradient id="lock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6c63ff" />
                  <stop offset="100%" stopColor="#00e676" />
                </linearGradient>
              </defs>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#shield-grad)" strokeWidth="1.5">
              <defs>
                <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f7971e" />
                  <stop offset="100%" stopColor="#fc5c7d" />
                </linearGradient>
              </defs>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          )}
        </div>

        <h2 className="pin-login__title">
          {mode === 'student' ? 'Student Login' : 'Admin Login'}
        </h2>
        <p className="pin-login__hint">
          {mode === 'student'
            ? 'Enter student password'
            : 'Enter admin password'
          }
        </p>

        <form onSubmit={mode === 'student' ? handleStudentSubmit : handleAdminSubmit} className="pin-login__admin-form">
          <input
            type="password"
            className="pin-login__text-input"
            placeholder={mode === 'student' ? 'Student Password' : 'Admin Password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            autoFocus
          />
          {error && <p className="pin-login__error">{error}</p>}
          <button type="submit" className="btn btn--start" style={{ width: '100%', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Login
          </button>
        </form>

        <button
          className="pin-login__toggle"
          onClick={() => { setMode(mode === 'student' ? 'admin' : 'student'); setPassword(''); setError(''); }}
        >
          {mode === 'student' ? '🛡️ Admin Panel' : '🎓 Student Login'}
        </button>
      </div>
    </div>
  );
}

