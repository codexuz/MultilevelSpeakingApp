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
  getTestsPaginated,
  getStudentsPaginated,
  getTestSessionsFiltered,
} from '../services/database';
import { pickAndSaveImage, resolveImagePath, resolveAudioPath } from '../services/storage';
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

const PAGE_SIZE = 10;

// ─── Custom hook for debounced values ────────────────────────
function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}


// ─── Reusable Pagination Component ─────────────────────────
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination">
      <button
        className="pagination__btn"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ‹ Prev
      </button>
      <div className="pagination__pages">
        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="pagination__dots">…</span>
          ) : (
            <button
              key={p}
              className={`pagination__page ${currentPage === p ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        className="pagination__btn"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next ›
      </button>
    </div>
  );
};

// ─── Search Input Component ─────────────────────────────────
const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="search-input">
    <svg className="search-input__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      className="search-input__field"
      placeholder={placeholder || 'Search...'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button className="search-input__clear" onClick={() => onChange('')}>✕</button>
    )}
  </div>
);

// ─── Student Add Form ───────────────────────────────────────
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

// ─── Session Results Detail View (with audio playback) ──────
const SessionResultsView = ({ session, onBack }) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioUrls, setAudioUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const d = await getTestSessionDetails(session.id);
      if (!cancelled) {
        setDetails(d);
        setLoading(false);

        // Resolve audio paths
        const urls = {};
        for (const answer of d) {
          if (answer.recording_path) {
            try {
              const url = await resolveAudioPath(answer.recording_path);
              if (url && !cancelled) {
                urls[answer.id] = url;
                setAudioUrls(prev => ({ ...prev, [answer.id]: url }));
              }
            } catch (err) {
              console.error('Failed to resolve audio:', err);
            }
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  const handleDeleteSession = async () => {
    const yes = await tauriConfirm('Delete this test record and all its audio recordings?', { title: 'Delete Record', kind: 'warning' });
    if (!yes) return;
    await deleteTestSession(session.id);
    onBack(true); // true = refresh needed
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr + 'Z').toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="admin__loading">
        <div className="admin__spinner" />
        <span>Loading results...</span>
      </div>
    );
  }

  return (
    <div className="session-results">
      <button className="btn btn--ghost session-results__back" onClick={() => onBack(false)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Records
      </button>

      {/* Session Header Card */}
      <div className="session-results__header-card">
        <div className="session-results__student-info">
          <div className="session-results__avatar">
            {session.student_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="session-results__name">{session.student_name}</h2>
            <p className="session-results__test-name">
              {session.test_title || 'Test'}
            </p>
          </div>
        </div>
        <div className="session-results__meta-row">
          <div className="session-results__meta-item">
            <span className="session-results__meta-label">Date</span>
            <span className="session-results__meta-value">{formatDate(session.started_at)}</span>
          </div>
          <div className="session-results__meta-item">
            <span className="session-results__meta-label">Score</span>
            <span className="session-results__meta-value session-results__meta-value--accent">
              {session.answered_questions} / {session.total_questions}
            </span>
          </div>
          <div className="session-results__meta-item">
            <span className="session-results__meta-label">Status</span>
            <span className={`admin__stat-badge ${session.completed_at ? 'completed' : 'incomplete'}`}>
              {session.completed_at ? '✅ Completed' : '⏳ Incomplete'}
            </span>
          </div>
        </div>
      </div>

      {/* Questions & Answers */}
      <div className="session-results__questions">
        <h3 className="session-results__section-title">
          Questions & Responses ({details.length})
        </h3>
        {details.length === 0 ? (
          <div className="admin__empty">
            <span className="admin__empty-icon">📭</span>
            <p>No answers recorded for this session.</p>
          </div>
        ) : (
          details.map((answer, i) => (
            <div key={answer.id} className="session-results__answer-card">
              <div className="session-results__answer-header">
                <div className="session-results__answer-left">
                  <span className="session-results__answer-num">{i + 1}</span>
                  <span
                    className="admin__question-badge"
                    style={{ background: PART_COLORS[answer.part], fontSize: '0.65rem' }}
                  >
                    {PART_LABELS[answer.part]}
                  </span>
                </div>
                <span className={`admin__answer-status ${answer.has_recording ? 'recorded' : 'skipped'}`}>
                  {answer.has_recording ? '🎤 Recorded' : '⏭️ Skipped'}
                </span>
              </div>
              <p className="session-results__question-text">{answer.q_text}</p>
              {answer.has_recording && audioUrls[answer.id] ? (
                <div className="session-results__audio-player">
                  <audio controls src={audioUrls[answer.id]} className="session-results__audio" />
                </div>
              ) : answer.has_recording && answer.recording_path ? (
                <div className="session-results__audio-loading">
                  <div className="admin__spinner" style={{ width: 16, height: 16 }} />
                  <span>Loading audio...</span>
                </div>
              ) : answer.has_recording ? (
                <div className="session-results__no-file">
                  <span>🎤 Audio was recorded but file is not available</span>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <button className="btn btn--small admin__btn-delete" onClick={handleDeleteSession} style={{ marginTop: 16 }}>
        🗑️ Delete this record
      </button>
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

  // Session detail view
  const [selectedSession, setSelectedSession] = useState(null);

  // Settings
  const [settingsMsg, setSettingsMsg] = useState('');

  // Bulk Upload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  // ─── Pagination & Search State ──────────────────────────────
  // Tests
  const [testSearch, setTestSearch] = useState('');
  const [testPage, setTestPage] = useState(1);
  const [testTotal, setTestTotal] = useState(0);

  // Students
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);

  // Sessions / Records
  const [recordSearch, setRecordSearch] = useState('');
  const [recordTestFilter, setRecordTestFilter] = useState('');
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [allTests, setAllTests] = useState([]); // for filter dropdown

  // ─── Debounced search ──────────────────────────────────────

  const debouncedTestSearch = useDebounce(testSearch);
  const debouncedStudentSearch = useDebounce(studentSearch);
  const debouncedRecordSearch = useDebounce(recordSearch);

  // ─── Data Loaders ──────────────────────────────────────────
  const loadTests = useCallback(async () => {
    try {
      const result = await getTestsPaginated(testPage, PAGE_SIZE, debouncedTestSearch);
      setTests(result.rows);
      setTestTotal(result.total);
    } catch (err) {
      console.error('Failed to load tests:', err);
    }
  }, [testPage, debouncedTestSearch]);

  const loadStudents = useCallback(async () => {
    try {
      const result = await getStudentsPaginated(studentPage, PAGE_SIZE, debouncedStudentSearch);
      setStudents(result.rows);
      setStudentTotal(result.total);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }, [studentPage, debouncedStudentSearch]);

  const loadSessions = useCallback(async () => {
    try {
      const result = await getTestSessionsFiltered(
        recordTestFilter || null,
        debouncedRecordSearch,
        recordPage,
        PAGE_SIZE
      );
      setSessions(result.rows);
      setRecordTotal(result.total);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, [recordPage, debouncedRecordSearch, recordTestFilter]);

  const loadAllTests = useCallback(async () => {
    try {
      const t = await getAllTests();
      setAllTests(t);
    } catch (err) {
      console.error('Failed to load all tests for filter:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadTests(), loadStudents(), loadSessions(), loadAllTests()]);

    if (selectedTest) {
      try {
        const q = await getQuestionsByTestId(selectedTest.id);
        setQuestions(q);
      } catch (err) {
        console.error('Failed to load questions:', err);
      }
    }
    setLoading(false);
    setSelectedTestIds([]);
    setSelectedQuestionIds([]);
  }, [selectedTest, loadTests, loadStudents, loadSessions, loadAllTests]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset page when search changes
  useEffect(() => { setTestPage(1); }, [debouncedTestSearch]);
  useEffect(() => { setStudentPage(1); }, [debouncedStudentSearch]);
  useEffect(() => { setRecordPage(1); }, [debouncedRecordSearch, recordTestFilter]);

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

  // ─── Students ──────────────────────────────────────────────
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

  const testTotalPages = Math.ceil(testTotal / PAGE_SIZE);
  const studentTotalPages = Math.ceil(studentTotal / PAGE_SIZE);
  const recordTotalPages = Math.ceil(recordTotal / PAGE_SIZE);

  // ─── Render: Session Results Detail Page ────────────────────
  if (selectedSession) {
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
            <h1 className="admin__title">Student Results</h1>
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
        <div className="admin__content">
          <SessionResultsView
            session={selectedSession}
            onBack={(needsRefresh) => {
              setSelectedSession(null);
              if (needsRefresh) loadData();
            }}
          />
        </div>
      </div>
    );
  }

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
          { key: TABS.QUESTIONS, label: 'Tests & Questions', icon: '📝', count: selectedTest ? questions.length : testTotal },
          { key: TABS.RECORDS, label: 'Test Records', icon: '📊', count: recordTotal },
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
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <SearchInput
                      value={testSearch}
                      onChange={(val) => setTestSearch(val)}
                      placeholder="Search tests..."
                    />
                    <button className="btn btn--primary" onClick={() => { resetTestForm(); setShowTestModal(true); }}>
                      + Create New Test
                    </button>
                  </div>
                </div>

                <div className="admin__list">
                  {tests.length === 0 ? (
                    <div className="admin__empty">
                      <span className="admin__empty-icon">📝</span>
                      <p>{debouncedTestSearch ? 'No tests match your search.' : 'No tests yet. Create your first test!'}</p>
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

                <Pagination
                  currentPage={testPage}
                  totalPages={testTotalPages}
                  onPageChange={setTestPage}
                />
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
            
            {/* Students Section with Search & Pagination */}
            <div className="admin__students-summary">
              <div className="admin__section-title-group" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 className="admin__students-title">Students ({studentTotal})</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <SearchInput
                    value={studentSearch}
                    onChange={setStudentSearch}
                    placeholder="Search students..."
                  />
                  <StudentAddForm onAdd={handleAddStudent} />
                </div>
              </div>
              {students.length > 0 && (
                <>
                  <div className="admin__students-list">
                    {students.map((s) => (
                      <div key={s.id} className="admin__student-chip">
                        <span>{s.full_name}</span>
                        <button className="admin__student-remove" onClick={() => handleDeleteStudent(s.id)}>×</button>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    currentPage={studentPage}
                    totalPages={studentTotalPages}
                    onPageChange={setStudentPage}
                  />
                </>
              )}
            </div>

            {/* Records Filter Bar */}
            <div className="records-filter-bar">
              <SearchInput
                value={recordSearch}
                onChange={setRecordSearch}
                placeholder="Search by student name..."
              />
              <select
                className="records-filter-bar__select"
                value={recordTestFilter}
                onChange={(e) => setRecordTestFilter(e.target.value)}
              >
                <option value="">All Tests</option>
                {allTests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            
            {sessions.length === 0 ? (
              <div className="admin__empty">
                <span className="admin__empty-icon">📊</span>
                <p>{(debouncedRecordSearch || recordTestFilter) ? 'No records match your filters.' : 'No records yet.'}</p>
              </div>
            ) : (
              <>
                <div className="admin__table-wrapper">
                  <table className="admin__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>Test</th>
                        <th>Date</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, i) => (
                        <tr key={s.id}>
                          <td>{(recordPage - 1) * PAGE_SIZE + i + 1}</td>
                          <td className="admin__table-name">{s.student_name}</td>
                          <td>
                            <span className="records__test-tag">{s.test_title || '—'}</span>
                          </td>
                          <td>{formatDate(s.started_at)}</td>
                          <td>{s.answered_questions}/{s.total_questions}</td>
                          <td><span className={`admin__status ${s.completed_at ? 'completed' : 'incomplete'}`}>{s.completed_at ? 'Completed' : 'Incomplete'}</span></td>
                          <td>
                            <div className="admin__table-actions">
                              <button className="btn btn--small btn--outline" onClick={() => setSelectedSession(s)}>
                                👁️ View
                              </button>
                              <button className="btn btn--small admin__btn-delete" onClick={async () => {
                                const yes = await tauriConfirm('Delete this test record?', { title: 'Delete Record', kind: 'warning' });
                                if (!yes) return;
                                await deleteTestSession(s.id);
                                loadData();
                              }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={recordPage}
                  totalPages={recordTotalPages}
                  onPageChange={setRecordPage}
                />
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
