import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getAllTestSessions,
  getTestSessionDetails,
  deleteTestSession,
  getAllStudents,
  deleteStudent,
  getSetting,
  updatePin,
  updateAdminPassword,
} from '../services/database';

const TABS = { QUESTIONS: 'questions', RECORDS: 'records', SETTINGS: 'settings' };

const PART_OPTIONS = [
  { value: '1.1', label: 'Part 1.1 – Introduction', color: '#6c63ff' },
  { value: '1.2', label: 'Part 1.2 – Visual', color: '#00c9a7' },
  { value: '2', label: 'Part 2 – Long Turn', color: '#f7971e' },
  { value: '3', label: 'Part 3 – Discussion', color: '#fc5c7d' },
];

const PART_COLORS = { '1.1': '#6c63ff', '1.2': '#00c9a7', '2': '#f7971e', '3': '#fc5c7d' };
const PART_LABELS = { '1.1': 'Part 1.1', '1.2': 'Part 1.2', '2': 'Part 2', '3': 'Part 3' };

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState(TABS.QUESTIONS);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Question form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    q_text: '', part: '1.1', image: '', speaking_timer: 30, prep_timer: 5,
  });

  // Session detail modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState([]);

  // Settings
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [q, s, st] = await Promise.all([
        getAllQuestions(),
        getAllTestSessions(),
        getAllStudents(),
      ]);
      setQuestions(q);
      setSessions(s);
      setStudents(st);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Question CRUD ──────────────────────────────────────────
  const resetForm = () => {
    setForm({ q_text: '', part: '1.1', image: '', speaking_timer: 30, prep_timer: 5 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEditQuestion = (q) => {
    setForm({
      q_text: q.q_text,
      part: q.part,
      image: q.image || '',
      speaking_timer: q.speaking_timer,
      prep_timer: q.prep_timer,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!form.q_text.trim()) return;
    try {
      if (editingId) {
        await updateQuestion(editingId, form);
      } else {
        await addQuestion(form);
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error('Failed to save question:', err);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion(id);
    await loadData();
  };

  // ─── Session Details ────────────────────────────────────────
  const handleViewSession = async (session) => {
    setSelectedSession(session);
    const details = await getTestSessionDetails(session.id);
    setSessionDetails(details);
  };

  const handleDeleteSession = async (id) => {
    if (!confirm('Delete this test record?')) return;
    await deleteTestSession(id);
    setSelectedSession(null);
    await loadData();
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Delete this student and all their records?')) return;
    await deleteStudent(id);
    await loadData();
  };

  // ─── Settings ───────────────────────────────────────────────
  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (newPin.length !== 4 || isNaN(newPin)) {
      setSettingsMsg('PIN must be exactly 4 digits');
      return;
    }
    await updatePin(newPin);
    setNewPin('');
    setSettingsMsg('✅ Student PIN updated successfully');
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 3) {
      setSettingsMsg('Password must be at least 3 characters');
      return;
    }
    await updateAdminPassword(newPassword);
    setNewPassword('');
    setSettingsMsg('✅ Admin password updated successfully');
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr + 'Z').toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="admin">
      <div className="admin__glow admin__glow--1" />
      <div className="admin__glow admin__glow--2" />

      {/* Header */}
      <div className="admin__header">
        <div className="admin__header-left">
          <div className="admin__logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#admin-grad)" strokeWidth="1.5">
              <defs>
                <linearGradient id="admin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f7971e" />
                  <stop offset="100%" stopColor="#fc5c7d" />
                </linearGradient>
              </defs>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="admin__title">Admin Panel</h1>
        </div>
        <button className="btn btn--ghost" onClick={onLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="admin__tabs">
        {[
          { key: TABS.QUESTIONS, label: 'Questions', icon: '📝', count: questions.length },
          { key: TABS.RECORDS, label: 'Test Records', icon: '📊', count: sessions.length },
          { key: TABS.SETTINGS, label: 'Settings', icon: '⚙️' },
        ].map((t) => (
          <button
            key={t.key}
            className={`admin__tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="admin__tab-icon">{t.icon}</span>
            {t.label}
            {t.count !== undefined && <span className="admin__tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="admin__content">
        {loading ? (
          <div className="admin__loading">
            <div className="admin__spinner" />
            <span>Loading...</span>
          </div>
        ) : tab === TABS.QUESTIONS ? (
          <div className="admin__section">
            <div className="admin__section-header">
              <h2>Manage Questions</h2>
              <button
                className="btn btn--primary"
                onClick={() => { resetForm(); setShowForm(!showForm); }}
              >
                {showForm ? '✕ Cancel' : '+ Add Question'}
              </button>
            </div>

            {/* Question Form */}
            {showForm && (
              <form className="admin__form" onSubmit={handleSaveQuestion}>
                <div className="admin__form-grid">
                  <div className="admin__field admin__field--full">
                    <label>Question Text</label>
                    <textarea
                      value={form.q_text}
                      onChange={(e) => setForm({ ...form, q_text: e.target.value })}
                      placeholder="Enter the speaking question..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="admin__field">
                    <label>Part</label>
                    <select value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })}>
                      {PART_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin__field">
                    <label>Image Path (optional)</label>
                    <input
                      type="text"
                      value={form.image}
                      onChange={(e) => setForm({ ...form, image: e.target.value })}
                      placeholder="/image.png"
                    />
                  </div>
                  <div className="admin__field">
                    <label>Prep Timer (sec)</label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={form.prep_timer}
                      onChange={(e) => setForm({ ...form, prep_timer: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="admin__field">
                    <label>Speaking Timer (sec)</label>
                    <input
                      type="number"
                      min="5"
                      max="600"
                      value={form.speaking_timer}
                      onChange={(e) => setForm({ ...form, speaking_timer: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </div>
                <div className="admin__form-actions">
                  <button type="submit" className="btn btn--primary">
                    {editingId ? '💾 Update Question' : '➕ Add Question'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancel</button>
                </div>
              </form>
            )}

            {/* Questions List */}
            <div className="admin__list">
              {questions.length === 0 ? (
                <div className="admin__empty">
                  <span className="admin__empty-icon">📝</span>
                  <p>No questions yet. Add your first question!</p>
                </div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className="admin__question-row">
                    <div className="admin__question-info">
                      <div className="admin__question-top">
                        <span
                          className="admin__question-badge"
                          style={{ background: PART_COLORS[q.part] }}
                        >
                          {PART_LABELS[q.part]}
                        </span>
                        <span className="admin__question-num">#{i + 1}</span>
                      </div>
                      <p className="admin__question-text">{q.q_text}</p>
                      <div className="admin__question-meta">
                        <span>🕐 Prep: {q.prep_timer}s</span>
                        <span>🎤 Speaking: {q.speaking_timer}s</span>
                        {q.image && <span>🖼️ Has image</span>}
                      </div>
                    </div>
                    <div className="admin__question-actions">
                      <button
                        className="btn btn--small btn--outline"
                        onClick={() => handleEditQuestion(q)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn--small admin__btn-delete"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : tab === TABS.RECORDS ? (
          <div className="admin__section">
            <h2>Student Test Records</h2>

            {selectedSession ? (
              <div className="admin__detail-view">
                <button className="btn btn--ghost" onClick={() => setSelectedSession(null)}>
                  ← Back to all records
                </button>
                <div className="admin__detail-header">
                  <h3>{selectedSession.student_name}</h3>
                  <p className="admin__detail-date">{formatDate(selectedSession.started_at)}</p>
                  <div className="admin__detail-stats">
                    <span className="admin__stat">
                      <strong>{selectedSession.answered_questions}</strong> / {selectedSession.total_questions} answered
                    </span>
                    <span className={`admin__stat-badge ${selectedSession.completed_at ? 'completed' : 'incomplete'}`}>
                      {selectedSession.completed_at ? '✅ Completed' : '⏳ Incomplete'}
                    </span>
                  </div>
                </div>
                <div className="admin__detail-answers">
                  {sessionDetails.length === 0 ? (
                    <p className="admin__detail-empty">No answers recorded for this session.</p>
                  ) : (
                    sessionDetails.map((a, i) => (
                      <div key={a.id} className="admin__answer-row">
                        <span className="admin__answer-num">{i + 1}</span>
                        <span
                          className="admin__question-badge"
                          style={{ background: PART_COLORS[a.part], fontSize: '0.65rem', padding: '2px 8px' }}
                        >
                          {PART_LABELS[a.part]}
                        </span>
                        <span className="admin__answer-text">{a.q_text}</span>
                        <span className={`admin__answer-status ${a.has_recording ? 'recorded' : 'skipped'}`}>
                          {a.has_recording ? '🎤 Recorded' : '⏭️ Skipped'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="btn btn--small admin__btn-delete"
                  onClick={() => handleDeleteSession(selectedSession.id)}
                  style={{ marginTop: 16 }}
                >
                  🗑️ Delete this record
                </button>
              </div>
            ) : (
              <>
                {/* Students summary */}
                {students.length > 0 && (
                  <div className="admin__students-summary">
                    <h3 className="admin__students-title">
                      Students ({students.length})
                    </h3>
                    <div className="admin__students-list">
                      {students.map((s) => (
                        <div key={s.id} className="admin__student-chip">
                          <span>{s.full_name}</span>
                          <button
                            className="admin__student-remove"
                            onClick={() => handleDeleteStudent(s.id)}
                            title="Delete student"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sessions table */}
                {sessions.length === 0 ? (
                  <div className="admin__empty">
                    <span className="admin__empty-icon">📊</span>
                    <p>No test records yet. Students will appear here after they take tests.</p>
                  </div>
                ) : (
                  <div className="admin__table-wrapper">
                    <table className="admin__table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student</th>
                          <th>Date</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s, i) => (
                          <tr key={s.id}>
                            <td>{i + 1}</td>
                            <td className="admin__table-name">{s.student_name}</td>
                            <td>{formatDate(s.started_at)}</td>
                            <td>
                              <span className="admin__score">
                                {s.answered_questions}/{s.total_questions}
                              </span>
                            </td>
                            <td>
                              <span className={`admin__status ${s.completed_at ? 'completed' : 'incomplete'}`}>
                                {s.completed_at ? 'Completed' : 'Incomplete'}
                              </span>
                            </td>
                            <td>
                              <div className="admin__table-actions">
                                <button className="btn btn--small btn--outline" onClick={() => handleViewSession(s)}>
                                  View
                                </button>
                                <button className="btn btn--small admin__btn-delete" onClick={() => handleDeleteSession(s.id)}>
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Settings Tab */
          <div className="admin__section">
            <h2>Settings</h2>
            {settingsMsg && (
              <div className="admin__settings-msg">{settingsMsg}</div>
            )}

            <div className="admin__settings-grid">
              <div className="admin__settings-card">
                <h3>🔢 Student PIN</h3>
                <p>Change the 4-digit PIN code that students use to access the test.</p>
                <form onSubmit={handleUpdatePin} className="admin__settings-form">
                  <input
                    type="text"
                    maxLength={4}
                    className="admin__settings-input"
                    placeholder="New 4-digit PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  <button type="submit" className="btn btn--primary btn--small" disabled={newPin.length !== 4}>
                    Update PIN
                  </button>
                </form>
              </div>

              <div className="admin__settings-card">
                <h3>🔑 Admin Password</h3>
                <p>Change the admin panel password.</p>
                <form onSubmit={handleUpdatePassword} className="admin__settings-form">
                  <input
                    type="password"
                    className="admin__settings-input"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="submit" className="btn btn--primary btn--small" disabled={newPassword.length < 3}>
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
