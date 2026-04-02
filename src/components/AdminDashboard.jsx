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
import * as XLSX from 'xlsx';
import { save, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const TABS = { QUESTIONS: 'questions', RECORDS: 'records', SETTINGS: 'settings' };

const PART_OPTIONS = [
  { value: '1.1', label: 'Part 1.1 – Introduction', color: '#6c63ff' },
  { value: '1.2', label: 'Part 1.2 – Visual', color: '#00c9a7' },
  { value: '2', label: 'Part 2 – Long Turn', color: '#f7971e' },
  { value: '3', label: 'Part 3 – Discussion', color: '#fc5c7d' },
];

const PART_COLORS = { '1.1': '#6c63ff', '1.2': '#00c9a7', '2': '#f7971e', '3': '#fc5c7d' };
const PART_LABELS = { '1.1': 'Part 1.1', '1.2': 'Part 1.2', '2': 'Part 2', '3': 'Part 3' };

const StudentAddForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(''); } }} style={{ display: 'flex', gap: '8px' }}>
      <input 
        type="text" 
        placeholder="New student name" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      />
      <button type="submit" className="btn btn--primary btn--small" disabled={!name.trim()}>
        + Add Student
      </button>
    </form>
  );
};

const UpdateStudentPasswordForm = ({ onUpdate }) => {
  const [val, setVal] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onUpdate(val); setVal(''); }} className="admin__settings-form">
      <input type="password" className="admin__settings-input" placeholder="New student password" value={val} onChange={(e) => setVal(e.target.value)} />
      <button type="submit" className="btn btn--primary btn--small" disabled={val.length < 3}>Update Password</button>
    </form>
  );
};

const UpdateAdminPasswordForm = ({ onUpdate }) => {
  const [val, setVal] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onUpdate(val); setVal(''); }} className="admin__settings-form">
      <input type="password" className="admin__settings-input" placeholder="New admin password" value={val} onChange={(e) => setVal(e.target.value)} />
      <button type="submit" className="btn btn--primary btn--small" disabled={val.length < 3}>Update Password</button>
    </form>
  );
};

const TestModal = ({ initialData, isEditing, onSave, onClose }) => {
  const [form, setForm] = useState(initialData || { title: '', description: '' });
  return (
    <div className="admin__modal-overlay" onClick={onClose}>
      <div className="admin__modal" onClick={e => e.stopPropagation()}>
        <div className="admin__modal-header">
          <h2>{isEditing ? '✏️ Edit Test' : '➕ Create New Test'}</h2>
          <button className="admin__modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="admin__form" onSubmit={e => { e.preventDefault(); onSave(form); }}>
          <div className="admin__form-grid">
            <div className="admin__field admin__field--full">
              <label>Test Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mock Multilevel Test #1" required autoFocus />
            </div>
            <div className="admin__field admin__field--full">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Test details..." rows={2} />
            </div>
          </div>
          <div className="admin__form-actions">
            <button type="submit" className="btn btn--primary">{isEditing ? '💾 Update Test' : '➕ Create Test'}</button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const QuestionModal = ({ initialData, isEditing, onSave, onClose, onPickImage }) => {
  const [form, setForm] = useState(initialData || { q_text: '', part: '1.1', image: '', speaking_timer: 30, prep_timer: 5 });
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    let active = true;
    if (form.image) {
      resolveImagePath(form.image).then(url => {
        if (active) setPreviewImg(url);
      });
    } else {
      setPreviewImg(null);
    }
    return () => { active = false; };
  }, [form.image]);

  const handlePickLocalImage = async () => {
    const savedPath = await onPickImage();
    if (savedPath) {
      setForm({ ...form, image: savedPath });
    }
  };

  return (
    <div className="admin__modal-overlay" onClick={onClose}>
      <div className="admin__modal admin__modal--large" onClick={e => e.stopPropagation()}>
        <div className="admin__modal-header">
          <h2>{isEditing ? '✏️ Edit Question' : '➕ Add Question'}</h2>
          <button className="admin__modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="admin__form" onSubmit={e => { e.preventDefault(); onSave(form); }}>
          <div className="admin__form-grid">
            <div className="admin__field admin__field--full">
              <label>Question Text</label>
              <textarea value={form.q_text} onChange={(e) => setForm({ ...form, q_text: e.target.value })} placeholder="Enter question..." rows={4} required autoFocus />
            </div>
            <div className="admin__field">
              <label>Part</label>
              <select value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })}>
                {PART_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="admin__field">
              <label>Image (optional)</label>
              <div className="admin__image-picker">
                {form.image ? (
                  <div className="admin__image-preview" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    {previewImg && (
                      <img src={previewImg} alt="Preview" style={{ maxHeight: 100, borderRadius: 4, marginBottom: 8 }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="admin__image-path">{form.image.split('/').pop()}</span>
                      <button type="button" className="admin__image-clear" onClick={() => setForm({ ...form, image: '' })}>×</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn--small btn--outline" onClick={handlePickLocalImage}>📁 Upload Image</button>
                )}
              </div>
            </div>
            <div className="admin__field">
              <label>Preparation Time (seconds)</label>
              <input type="number" min="0" max="300" value={form.prep_timer} onChange={(e) => setForm({ ...form, prep_timer: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="admin__field">
              <label>Speaking Time (seconds)</label>
              <input type="number" min="0" max="300" value={form.speaking_timer} onChange={(e) => setForm({ ...form, speaking_timer: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="admin__form-actions">
            <button type="submit" className="btn btn--primary">{isEditing ? '💾 Update Question' : '➕ Save Question'}</button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState(TABS.QUESTIONS);
  const [tests, setTests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Modals editing references
  const [editingTestId, setEditingTestId] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingTestInitialData, setEditingTestInitialData] = useState(null);

  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionInitialData, setEditingQuestionInitialData] = useState(null);

  // Session detail modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState([]);

  // Settings
  const [settingsMsg, setSettingsMsg] = useState('');

  // Bulk Upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

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
    setEditingTestId(null);
    setEditingTestInitialData(null);
    setShowTestModal(false);
  };

  const handleEditTest = (t) => {
    setEditingTestInitialData({ title: t.title, description: t.description || '' });
    setEditingTestId(t.id);
    setShowTestModal(true);
  };

  const handleSaveTest = async (formData) => {
    try {
      if (editingTestId) {
        await updateTest(editingTestId, formData.title, formData.description);
      } else {
        await addTest(formData.title, formData.description);
      }
      await loadData();
      resetTestForm();
    } catch (err) {
      console.error('Failed to save test:', err);
    }
  };

  const handleDeleteTest = async (id) => {
    const yes = await tauriConfirm('Delete this test and all its questions?', { title: 'Delete Test', kind: 'warning' });
    if (!yes) return;
    await deleteTest(id);
    if (selectedTest?.id === id) setSelectedTest(null);
    await loadData();
  };

  const handleDeleteTests = async () => {
    const yes = await tauriConfirm(`Delete ${selectedTestIds.length} selected tests and all their questions?`, { title: 'Delete Tests', kind: 'warning' });
    if (!yes) return;
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
    setEditingQuestionInitialData(null);
    setEditingQuestionId(null);
    setShowQuestionModal(false);
  };

  const handleEditQuestion = (q) => {
    setEditingQuestionInitialData({
      q_text: q.q_text,
      part: q.part,
      image: q.image || '',
      speaking_timer: q.speaking_timer,
      prep_timer: q.prep_timer,
    });
    setEditingQuestionId(q.id);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (formData) => {
    if (!selectedTest) return;
    try {
      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, formData);
      } else {
        await addQuestion(selectedTest.id, formData);
      }
      await loadData();
      resetQuestionForm();
    } catch (err) {
      console.error('Failed to save question:', err);
    }
  };

  const handleDeleteQuestion = async (id) => {
    const yes = await tauriConfirm('Delete this question?', { title: 'Delete Question', kind: 'warning' });
    if (!yes) return;
    await deleteQuestion(id);
    await loadData();
  };

  const handleDeleteQuestions = async () => {
    const yes = await tauriConfirm(`Delete ${selectedQuestionIds.length} selected questions?`, { title: 'Delete Questions', kind: 'warning' });
    if (!yes) return;
    await deleteQuestions(selectedQuestionIds);
    await loadData();
  };

  const toggleQuestionSelection = (id) => {
    setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ─── Session Details ────────────────────────────────────────
  const handleViewSession = async (session) => {
    setSelectedSession(session);
    const details = await getTestSessionDetails(session.id);
    setSessionDetails(details);
  };

  const handleDeleteSession = async (id) => {
    const yes = await tauriConfirm('Delete this test record?', { title: 'Delete Record', kind: 'warning' });
    if (!yes) return;
    await deleteTestSession(id);
    setSelectedSession(null);
    await loadData();
  };

  const handleDeleteStudent = async (id) => {
    const yes = await tauriConfirm('Delete this student? This removes all their past records forever.', { title: 'Delete Student', kind: 'warning' });
    if (yes) {
      await deleteStudent(id);
      loadData();
    }
  };

  const handleAddStudent = async (name) => {
    if (!name.trim()) return;
    await addStudent(name.trim());
    loadData();
  };

  // ─── Settings ───────────────────────────────────────────────
  const handleUpdateStudentPassword = async (pwd) => {
    if (!pwd.trim()) {
      setSettingsMsg('Student password cannot be empty.');
      return;
    }
    await updateStudentPassword(pwd);
    setSettingsMsg('✅ Student password updated successfully.');
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  const handleUpdateAdminPassword = async (pwd) => {
    if (pwd.length < 3) {
      setSettingsMsg('Password must be at least 3 characters');
      return;
    }
    await updateAdminPassword(pwd);
    setSettingsMsg('✅ Admin password updated successfully');
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  // ─── Bulk Upload ───────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTest) return;

    setIsUploading(true);
    try {
      const isJson = file.name.endsWith('.json');
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      let parsedQuestions = [];

      if (isJson) {
        const text = await file.text();
        parsedQuestions = JSON.parse(text);
      } else if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        parsedQuestions = XLSX.utils.sheet_to_json(sheet);
      }

      if (!Array.isArray(parsedQuestions)) {
        if (parsedQuestions.questions && Array.isArray(parsedQuestions.questions)) {
          parsedQuestions = parsedQuestions.questions;
        } else {
          throw new Error('Data is not an array');
        }
      }

      let addedCount = 0;
      for (const row of parsedQuestions) {
        const qText = row.q_text || row.question || row.text || row.Question || row.Text || row['Question Text'];
        if (!qText) continue;

        let part = String(row.part || row.Part || '1.1');
        if (part === '1' || part === '1.0') part = '1.1';
        
        const prep = parseInt(row.prep_timer || row.prep || row.Prep || row['Prep Timer']) || 5;
        const speak = parseInt(row.speaking_timer || row.speak || row.Speak || row['Speaking Timer']) || 30;

        await addQuestion(selectedTest.id, {
          q_text: String(qText).trim(),
          part: part,
          image: null,
          prep_timer: prep,
          speaking_timer: speak
        });
        addedCount++;
      }

      alert(`✅ Successfully Bulk Uploaded ${addedCount} questions!`);
      const updatedQs = await getQuestionsByTestId(selectedTest.id);
      setQuestions(updatedQs);

    } catch (err) {
      console.error('Upload Error:', err);
      alert('❌ Failed to parse file. Make sure it is a valid JSON or Excel file layout.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const data = [
        { q_text: 'Describe a memorable journey you have made.', part: '2', prep_timer: 60, speaking_timer: 120 },
        { q_text: 'What are the most popular modes of transport in your country?', part: '3', prep_timer: 0, speaking_timer: 30 },
        { q_text: 'What is your full name?', part: '1.1', prep_timer: 5, speaking_timer: 20 }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      const filePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: 'Questions_Template.xlsx'
      });

      if (filePath) {
        await writeFile(filePath, new Uint8Array(excelBuffer));
        alert('✅ Template saved successfully!');
      }
    } catch (err) {
      console.error('Save template error:', err);
      alert('❌ Failed to save template. Please try again.');
    }
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
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn--outline" onClick={handleDownloadTemplate}>
                      ⬇️ Template
                    </button>
                    <input 
                      type="file" 
                      accept=".json, .xlsx, .xls" 
                      style={{ display: 'none' }} 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                    />
                    <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? '⏳ Uploading...' : '📁 Bulk Upload'}
                    </button>
                    <button className="btn btn--primary" onClick={() => { resetQuestionForm(); setShowQuestionModal(true); }}>
                      + Add Question
                    </button>
                  </div>
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
                    <StudentAddForm onAdd={handleAddStudent} />
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
                <UpdateStudentPasswordForm onUpdate={handleUpdateStudentPassword} />
              </div>
              <div className="admin__settings-card">
                <h3>🛡️ Admin Password</h3>
                <UpdateAdminPasswordForm onUpdate={handleUpdateAdminPassword} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTestModal && (
        <TestModal 
          initialData={editingTestInitialData} 
          isEditing={!!editingTestId} 
          onSave={handleSaveTest} 
          onClose={resetTestForm} 
        />
      )}

      {showQuestionModal && (
        <QuestionModal 
          initialData={editingQuestionInitialData}
          isEditing={!!editingQuestionId}
          onSave={handleSaveQuestion}
          onClose={resetQuestionForm}
          onPickImage={async () => {
            try {
              const savedPath = await pickAndSaveImage();
              return savedPath;
            } catch (err) {
              alert('Failed to pick and save image: ' + err.message);
              return null;
            }
          }}
        />
      )}
    </div>
  );
}
