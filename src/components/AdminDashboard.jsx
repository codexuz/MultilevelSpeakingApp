import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllTests,
  addTest,
  updateTest,
  deleteTest,
  getQuestionsByTestId,
  deleteQuestions,
  deleteTests,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getAllTestSessions,
  getTestSessionDetails,
  deleteTestSession,
  getAllStudents,
  deleteStudent,
  addStudent,
  getSetting,
  updateStudentPassword,
  updateAdminPassword,
} from '../services/database';
import { pickAndSaveImage, resolveImagePath } from '../services/storage';

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
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection states
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);

  // Form states
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  const [testForm, setTestForm] = useState({ title: '', description: '' });

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    q_text: '', part: '1.1', image: '', speaking_timer: 30, prep_timer: 5,
  });
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    let active = true;
    if (questionForm.image) {
      resolveImagePath(questionForm.image).then(url => {
        if (active) setPreviewImg(url);
      });
    } else {
      setPreviewImg(null);
    }
    return () => { active = false; };
  }, [questionForm.image]);

  // Session detail modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState([]);
  const [newStudentName, setNewStudentName] = useState('');

  // Settings
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s, st] = await Promise.all([
        getAllTests(),
        getAllTestSessions(),
        getAllStudents(),
      ]);
      setTests(t);
      setSessions(s);
      setStudents(st);

      if (selectedTest) {
        const q = await getQuestionsByTestId(selectedTest.id);
        setQuestions(q);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
    setSelectedTestIds([]);
    setSelectedQuestionIds([]);
  }, [selectedTest]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Test CRUD ──────────────────────────────────────────────
  const resetTestForm = () => {
    setTestForm({ title: '', description: '' });
    setEditingTestId(null);
    setShowTestModal(false);
  };

  const handleEditTest = (t) => {
    setTestForm({ title: t.title, description: t.description || '' });
    setEditingTestId(t.id);
    setShowTestModal(true);
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (!testForm.title.trim()) return;
    try {
      if (editingTestId) {
        await updateTest(editingTestId, testForm.title, testForm.description);
      } else {
        await addTest(testForm.title, testForm.description);
      }
      await loadData();
      resetTestForm();
    } catch (err) {
      console.error('Failed to save test:', err);
    }
  };

  const handleDeleteTest = async (id) => {
    if (!confirm('Delete this test and all its questions?')) return;
    await deleteTest(id);
    if (selectedTest?.id === id) setSelectedTest(null);
    await loadData();
  };

  const handleDeleteTests = async () => {
    if (!confirm(`Delete ${selectedTestIds.length} selected tests and all their questions?`)) return;
    await deleteTests(selectedTestIds);
    if (selectedTestIds.includes(selectedTest?.id)) setSelectedTest(null);
    await loadData();
  };

  const toggleTestSelection = (id) => {
    setSelectedTestIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectTest = async (test) => {
    setLoading(true);
    const qs = await getQuestionsByTestId(test.id);
    setQuestions(qs);
    setSelectedTest(test);
    setLoading(false);
  };

  // ─── Question CRUD ──────────────────────────────────────────
  const resetQuestionForm = () => {
    setQuestionForm({ q_text: '', part: '1.1', image: '', speaking_timer: 30, prep_timer: 5 });
    setEditingQuestionId(null);
    setShowQuestionModal(false);
  };

  const handleEditQuestion = (q) => {
    setQuestionForm({
      q_text: q.q_text,
      part: q.part,
      image: q.image || '',
      speaking_timer: q.speaking_timer,
      prep_timer: q.prep_timer,
    });
    setEditingQuestionId(q.id);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.q_text.trim() || !selectedTest) return;
    try {
      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, questionForm);
      } else {
        await addQuestion(selectedTest.id, questionForm);
      }
      await loadData();
      resetQuestionForm();
    } catch (err) {
      console.error('Failed to save question:', err);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion(id);
    await loadData();
  };

  const handleDeleteQuestions = async () => {
    if (!confirm(`Delete ${selectedQuestionIds.length} selected questions?`)) return;
    await deleteQuestions(selectedQuestionIds);
    await loadData();
  };

  const toggleQuestionSelection = (id) => {
    setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePickImage = async () => {
    try {
      const savedPath = await pickAndSaveImage();
      if (savedPath) {
        setQuestionForm({ ...questionForm, image: savedPath });
      }
    } catch (err) {
      alert('Failed to pick and save image: ' + err.message);
    }
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
    if (window.confirm('Delete this student? This removes all their past records forever.')) {
      await deleteStudent(id);
      loadData();
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    await addStudent(newStudentName.trim());
    setNewStudentName('');
    loadData();
  };

  // ─── Settings ───────────────────────────────────────────────
  const handleUpdateStudentPassword = async (e) => {
    e.preventDefault();
    if (!newStudentPassword.trim()) {
      setSettingsMsg('Student password cannot be empty.');
      return;
    }
    await updateStudentPassword(newStudentPassword);
    setNewStudentPassword('');
    setSettingsMsg('✅ Student password updated successfully.');
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
          { key: TABS.QUESTIONS, label: 'Tests & Questions', icon: '📝', count: selectedTest ? questions.length : tests.length },
          { key: TABS.RECORDS, label: 'Test Records', icon: '📊', count: sessions.length },
          { key: TABS.SETTINGS, label: 'Settings', icon: '⚙️' },
        ].map((t) => (
          <button
            key={t.key}
            className={`admin__tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => {
              setTab(t.key);
              if (t.key !== TABS.QUESTIONS) setSelectedTest(null);
            }}
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
            {!selectedTest ? (
              <>
                <div className="admin__section-header">
                  <div className="admin__section-title-group">
                    <h2>Manage Tests</h2>
                    {selectedTestIds.length > 0 && (
                      <button className="btn btn--small btn--status-error" onClick={handleDeleteTests}>
                        🗑️ Delete {selectedTestIds.length} Selected
                      </button>
                    )}
                  </div>
                  <button className="btn btn--primary" onClick={() => { resetTestForm(); setShowTestModal(true); }}>
                    + Create New Test
                  </button>
                </div>

                <div className="admin__list">
                  {tests.length === 0 ? (
                    <div className="admin__empty">
                      <span className="admin__empty-icon">📝</span>
                      <p>No tests yet. Create your first test!</p>
                    </div>
                  ) : (
                    tests.map((t) => (
                      <div key={t.id} className="admin__question-row admin__test-row" onClick={() => handleSelectTest(t)}>
                        <div className="admin__row-selection" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTestIds.includes(t.id)}
                            onChange={() => toggleTestSelection(t.id)}
                          />
                        </div>
                        <div className="admin__question-info">
                          <h3 className="admin__test-title">{t.title}</h3>
                          <p className="admin__test-desc">{t.description || 'No description'}</p>
                          <div className="admin__question-meta">
                            <span>📅 Created: {formatDate(t.created_at)}</span>
                            <span>📋 {t.q_count || 0} Questions</span>
                          </div>
                        </div>
                        <div className="admin__question-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn btn--small btn--outline" onClick={() => handleEditTest(t)}>✏️ Edit</button>
                          <button className="btn btn--small admin__btn-delete" onClick={() => handleDeleteTest(t.id)}>🗑️</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="admin__section-header">
                  <div className="admin__breadcrumb">
                    <button className="admin__breadcrumb-back" onClick={() => setSelectedTest(null)}>Tests</button>
                    <span className="admin__breadcrumb-sep">/</span>
                    <span className="admin__breadcrumb-current">{selectedTest.title}</span>
                    {selectedQuestionIds.length > 0 && (
                      <button
                        className="btn btn--small btn--status-error"
                        style={{ marginLeft: '12px' }}
                        onClick={handleDeleteQuestions}
                      >
                        🗑️ Delete {selectedQuestionIds.length}
                      </button>
                    )}
                  </div>
                  <button className="btn btn--primary" onClick={() => { resetQuestionForm(); setShowQuestionModal(true); }}>
                    + Add Question
                  </button>
                </div>

                <div className="admin__table-wrapper">
                  {questions.length === 0 ? (
                    <div className="admin__empty">
                      <span className="admin__empty-icon">📝</span>
                      <p>No questions in this test. Add your first question!</p>
                    </div>
                  ) : (
                    <table className="admin__table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}></th>
                          <th style={{ width: 40 }}>#</th>
                          <th style={{ width: 100 }}>Part</th>
                          <th>Question Text</th>
                          <th style={{ width: 80 }}>Prep</th>
                          <th style={{ width: 80 }}>Speak</th>
                          <th style={{ width: 60 }}>Img</th>
                          <th style={{ width: 120 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, i) => (
                          <tr key={q.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedQuestionIds.includes(q.id)}
                                onChange={() => toggleQuestionSelection(q.id)}
                              />
                            </td>
                            <td>{i + 1}</td>
                            <td>
                              <span className="admin__question-badge" style={{ background: PART_COLORS[q.part], fontSize: '0.7rem' }}>
                                {PART_LABELS[q.part]}
                              </span>
                            </td>
                            <td className="admin__table-question-text">{q.q_text}</td>
                            <td>{q.prep_timer}s</td>
                            <td>{q.speaking_timer}s</td>
                            <td>{q.image ? '🖼️' : '—'}</td>
                            <td>
                              <div className="admin__table-actions">
                                <button className="btn btn--small btn--outline" onClick={() => handleEditQuestion(q)}>✏️</button>
                                <button className="btn btn--small admin__btn-delete" onClick={() => handleDeleteQuestion(q.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        ) : tab === TABS.RECORDS ? (
          <div className="admin__section">
            <h2>Student Test Records</h2>
            {selectedSession ? (
              <div className="admin__detail-view">
                <button className="btn btn--ghost" onClick={() => setSelectedSession(null)}>← Back to all records</button>
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
                  {sessionDetails.map((a, i) => (
                    <div key={a.id} className="admin__answer-row">
                      <span className="admin__answer-num">{i + 1}</span>
                      <span className="admin__question-badge" style={{ background: PART_COLORS[a.part], fontSize: '0.65rem' }}>
                        {PART_LABELS[a.part]}
                      </span>
                      <span className="admin__answer-text">{a.q_text}</span>
                      <span className={`admin__answer-status ${a.has_recording ? 'recorded' : 'skipped'}`}>
                        {a.has_recording ? '🎤 Recorded' : '⏭️ Skipped'}
                      </span>
                    </div>
                  ))}
                </div>
                <button className="btn btn--small admin__btn-delete" onClick={() => handleDeleteSession(selectedSession.id)} style={{ marginTop: 16 }}>
                  🗑️ Delete this record
                </button>
              </div>
            ) : (
              <>
                <div className="admin__students-summary">
                  <div className="admin__section-title-group" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 className="admin__students-title">Students ({students.length})</h3>
                    <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="New student name" 
                        value={newStudentName} 
                        onChange={(e) => setNewStudentName(e.target.value)} 
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <button type="submit" className="btn btn--primary btn--small" disabled={!newStudentName.trim()}>
                        + Add Student
                      </button>
                    </form>
                  </div>
                  {students.length > 0 && (
                    <div className="admin__students-list">
                      {students.map((s) => (
                        <div key={s.id} className="admin__student-chip">
                          <span>{s.full_name}</span>
                          <button className="admin__student-remove" onClick={() => handleDeleteStudent(s.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {sessions.length === 0 ? (
                  <div className="admin__empty"><span className="admin__empty-icon">📊</span><p>No records yet.</p></div>
                ) : (
                  <div className="admin__table-wrapper">
                    <table className="admin__table">
                      <thead>
                        <tr><th>#</th><th>Student</th><th>Date</th><th>Score</th><th>Status</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {sessions.map((s, i) => (
                          <tr key={s.id}>
                            <td>{i + 1}</td>
                            <td className="admin__table-name">{s.student_name}</td>
                            <td>{formatDate(s.started_at)}</td>
                            <td>{s.answered_questions}/{s.total_questions}</td>
                            <td><span className={`admin__status ${s.completed_at ? 'completed' : 'incomplete'}`}>{s.completed_at ? 'Completed' : 'Incomplete'}</span></td>
                            <td>
                              <div className="admin__table-actions">
                                <button className="btn btn--small btn--outline" onClick={() => handleViewSession(s)}>View</button>
                                <button className="btn btn--small admin__btn-delete" onClick={() => handleDeleteSession(s.id)}>🗑️</button>
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
          <div className="admin__section">
            <h2>Settings</h2>
            {settingsMsg && <div className="admin__settings-msg">{settingsMsg}</div>}
            <div className="admin__settings-grid">
              <div className="admin__settings-card">
                <h3>🔢 Student Password</h3>
                <form onSubmit={handleUpdateStudentPassword} className="admin__settings-form">
                  <input type="password" className="admin__settings-input" placeholder="New student password" value={newStudentPassword} onChange={(e) => setNewStudentPassword(e.target.value)} />
                  <button type="submit" className="btn btn--primary btn--small" disabled={newStudentPassword.length < 3}>Update Password</button>
                </form>
              </div>
              <div className="admin__settings-card">
                <h3>🔑 Admin Password</h3>
                <form onSubmit={handleUpdatePassword} className="admin__settings-form">
                  <input type="password" className="admin__settings-input" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <button type="submit" className="btn btn--primary btn--small" disabled={newPassword.length < 3}>Update Password</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTestModal && (
        <div className="admin__modal-overlay" onClick={resetTestForm}>
          <div className="admin__modal" onClick={e => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h2>{editingTestId ? '✏️ Edit Test' : '➕ Create New Test'}</h2>
              <button className="admin__modal-close" onClick={resetTestForm}>✕</button>
            </div>
            <form className="admin__form" onSubmit={handleSaveTest}>
              <div className="admin__form-grid">
                <div className="admin__field admin__field--full">
                  <label>Test Title</label>
                  <input type="text" value={testForm.title} onChange={(e) => setTestForm({ ...testForm, title: e.target.value })} placeholder="e.g. Mock Multilevel Test #1" required autoFocus />
                </div>
                <div className="admin__field admin__field--full">
                  <label>Description</label>
                  <textarea value={testForm.description} onChange={(e) => setTestForm({ ...testForm, description: e.target.value })} placeholder="Test details..." rows={2} />
                </div>
              </div>
              <div className="admin__form-actions">
                <button type="submit" className="btn btn--primary">{editingTestId ? '💾 Update Test' : '➕ Create Test'}</button>
                <button type="button" className="btn btn--ghost" onClick={resetTestForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuestionModal && (
        <div className="admin__modal-overlay" onClick={resetQuestionForm}>
          <div className="admin__modal admin__modal--large" onClick={e => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h2>{editingQuestionId ? '✏️ Edit Question' : '➕ Add Question'}</h2>
              <button className="admin__modal-close" onClick={resetQuestionForm}>✕</button>
            </div>
            <form className="admin__form" onSubmit={handleSaveQuestion}>
              <div className="admin__form-grid">
                <div className="admin__field admin__field--full">
                  <label>Question Text</label>
                  <textarea value={questionForm.q_text} onChange={(e) => setQuestionForm({ ...questionForm, q_text: e.target.value })} placeholder="Enter question..." rows={4} required autoFocus />
                </div>
                <div className="admin__field">
                  <label>Part</label>
                  <select value={questionForm.part} onChange={(e) => setQuestionForm({ ...questionForm, part: e.target.value })}>
                    {PART_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="admin__field">
                  <label>Image (optional)</label>
                  <div className="admin__image-picker">
                    {questionForm.image ? (
                      <div className="admin__image-preview" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        {previewImg && (
                          <img src={previewImg} alt="Preview" style={{ maxHeight: 100, borderRadius: 4, marginBottom: 8 }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="admin__image-path">{questionForm.image.split('/').pop()}</span>
                          <button type="button" className="admin__image-clear" onClick={() => setQuestionForm({ ...questionForm, image: '' })}>×</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn--small btn--outline" onClick={handlePickImage}>📁 Upload Image</button>
                    )}
                  </div>
                </div>
                <div className="admin__field">
                  <label>Prep Timer (sec)</label>
                  <input type="number" min="0" value={questionForm.prep_timer} onChange={(e) => setQuestionForm({ ...questionForm, prep_timer: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="admin__field">
                  <label>Speaking Timer (sec)</label>
                  <input type="number" min="5" value={questionForm.speaking_timer} onChange={(e) => setQuestionForm({ ...questionForm, speaking_timer: parseInt(e.target.value) || 30 })} />
                </div>
              </div>
              <div className="admin__form-actions">
                <button type="submit" className="btn btn--primary">{editingQuestionId ? '💾 Update Question' : '➕ Add Question'}</button>
                <button type="button" className="btn btn--ghost" onClick={resetQuestionForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
