import Database from '@tauri-apps/plugin-sql';

let db = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:speaking_app.db');
  }
  return db;
}

// ─── Helpers ───────────────────────────────────────────────
function mapQuestion(q) {
  if (!q) return q;
  let sampleAnswers = [];
  try {
    sampleAnswers = q.sample_answers ? JSON.parse(q.sample_answers) : [];
  } catch (e) {
    console.error('Failed to parse sample_answers:', e);
  }
  
  return {
    ...q,
    qText: q.q_text,
    speakingTimer: q.speaking_timer,
    prepTimer: q.prep_timer,
    testId: q.test_id,
    audioUrl: q.audio_url,
    sampleAnswers: sampleAnswers
  };
}

function mapTest(t, questions = []) {
  if (!t) return t;
  return {
    ...t,
    testType: t.test_type,
    isPublished: t.is_published === 1 || t.is_published === true,
    questions: questions
  };
}

// ─── App Settings ───────────────────────────────────────────
export async function getSetting(key, defaultValue = null) {
  const d = await getDb();
  const rows = await d.select('SELECT value FROM app_settings WHERE key = $1', [key]);
  if (rows.length > 0) return rows[0].value;
  
  if (defaultValue !== null) {
    await setSetting(key, defaultValue);
    return defaultValue;
  }
  return null;
}

export async function setSetting(key, value) {
  const d = await getDb();
  await d.execute(
    'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value]
  );
}

// ─── Passwords ──────────────────────────────────────────────
export async function verifyStudentPassword(password) {
  const storedPassword = await getSetting('student_password', 'student1122');
  return storedPassword === password;
}

export async function verifyAdminPassword(password) {
  const storedPassword = await getSetting('admin_password', 'demo_edumo');
  return storedPassword === password;
}

export async function updateStudentPassword(newPassword) {
  await setSetting('student_password', newPassword);
}

export async function updateAdminPassword(newPassword) {
  await setSetting('admin_password', newPassword);
}

// ─── Tests ──────────────────────────────────────────────────
export async function getAllTests() {
  const d = await getDb();
  const tests = await d.select('SELECT * FROM tests ORDER BY created_at DESC');
  const results = [];
  for (const test of tests) {
    const questions = await getQuestionsByTestId(test.id);
    results.push(mapTest(test, questions));
  }
  return results;
}

export async function getTestsPaginated(page = 1, limit = 10, search = '') {
  const d = await getDb();
  const offset = (page - 1) * limit;
  
  let rows;
  let total;

  if (search.trim()) {
    const searchLike = `%${search.trim()}%`;
    rows = await d.select(
      `SELECT * FROM tests WHERE title LIKE $1 OR description LIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [searchLike, limit, offset]
    );
    const countResult = await d.select(
      `SELECT COUNT(*) as total FROM tests WHERE title LIKE $1 OR description LIKE $1`,
      [searchLike]
    );
    total = countResult[0].total;
  } else {
    rows = await d.select(
      `SELECT * FROM tests ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await d.select(`SELECT COUNT(*) as total FROM tests`);
    total = countResult[0].total;
  }

  const results = [];
  for (const row of rows) {
    const questions = await getQuestionsByTestId(row.id);
    results.push(mapTest(row, questions));
  }

  return { rows: results, total };
}

export async function addTest(title, description, testType = 'cefr', isPublished = true) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO tests (title, description, test_type, is_published) VALUES ($1, $2, $3, $4)',
    [title, description, testType, isPublished ? 1 : 0]
  );
  return result.lastInsertId;
}

export async function updateTest(id, title, description, testType = 'cefr', isPublished = true) {
  const d = await getDb();
  await d.execute(
    'UPDATE tests SET title = $1, description = $2, test_type = $3, is_published = $4 WHERE id = $5',
    [title, description, testType, isPublished ? 1 : 0, id]
  );
}

export async function deleteTest(id) {
  const d = await getDb();
  // We rely on ON DELETE CASCADE in the DB, but just in case:
  await d.execute('DELETE FROM questions WHERE test_id = $1', [id]);
  await d.execute('DELETE FROM tests WHERE id = $1', [id]);
}

export async function deleteTests(ids) {
  if (!ids?.length) return;
  const d = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await d.execute(`DELETE FROM questions WHERE test_id IN (${placeholders})`, ids);
  await d.execute(`DELETE FROM tests WHERE id IN (${placeholders})`, ids);
}

// ─── Questions ──────────────────────────────────────────────
export async function getAllQuestions() {
  const d = await getDb();
  const rows = await d.select('SELECT * FROM questions ORDER BY part, id');
  return rows.map(mapQuestion);
}

export async function getQuestionsByTestId(testId) {
  const d = await getDb();
  const rows = await d.select('SELECT * FROM questions WHERE test_id = $1 ORDER BY part, id', [testId]);
  return rows.map(mapQuestion);
}

export async function addQuestion(testId, question) {
  const d = await getDb();
  const qText = question.qText || question.q_text;
  const speakingTimer = question.speakingTimer || question.speaking_timer;
  const prepTimer = question.prepTimer || question.prep_timer;
  const audioUrl = question.audioUrl || question.audio_url;
  const sampleAnswers = question.sampleAnswers || question.sample_answers;

  const result = await d.execute(
    'INSERT INTO questions (test_id, q_text, part, image, speaking_timer, prep_timer, audio_url, sample_answers) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      testId, 
      qText, 
      question.part, 
      question.image || null, 
      speakingTimer, 
      prepTimer, 
      audioUrl || null, 
      sampleAnswers ? JSON.stringify(sampleAnswers) : '[]'
    ]
  );
  return result.lastInsertId;
}

export async function updateQuestion(id, question) {
  const d = await getDb();
  const qText = question.qText || question.q_text;
  const speakingTimer = question.speakingTimer || question.speaking_timer;
  const prepTimer = question.prepTimer || question.prep_timer;
  const audioUrl = question.audioUrl || question.audio_url;
  const sampleAnswers = question.sampleAnswers || question.sample_answers;

  await d.execute(
    'UPDATE questions SET q_text = $1, part = $2, image = $3, speaking_timer = $4, prep_timer = $5, audio_url = $6, sample_answers = $7 WHERE id = $8',
    [
      qText, 
      question.part, 
      question.image || null, 
      speakingTimer, 
      prepTimer, 
      audioUrl || null, 
      sampleAnswers ? JSON.stringify(sampleAnswers) : '[]', 
      id
    ]
  );
}

export async function deleteQuestion(id) {
  const d = await getDb();
  await d.execute('DELETE FROM questions WHERE id = $1', [id]);
}

export async function deleteQuestions(ids) {
  if (!ids?.length) return;
  const d = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await d.execute(`DELETE FROM questions WHERE id IN (${placeholders})`, ids);
}

export async function seedTestsFromJson(tests) {
  const d = await getDb();
  const existingTests = await d.select('SELECT COUNT(*) as count FROM tests');
  if (existingTests[0].count > 0) return; // Already seeded

  for (const test of tests) {
    const testId = await addTest(
      test.title, 
      test.description, 
      test.testType || 'cefr', 
      test.isPublished !== undefined ? test.isPublished : true
    );
    
    if (test.questions && Array.isArray(test.questions)) {
      for (const q of test.questions) {
        await addQuestion(testId, q);
      }
    }
  }
}

// Deprecated, use seedTestsFromJson
export async function seedQuestionsFromJson(questions) {
  const d = await getDb();
  const existingQuestions = await d.select('SELECT COUNT(*) as count FROM questions');
  if (existingQuestions[0].count > 0) return;

  const testId = await addTest('Multilevel Mock Test', 'Seed data');
  for (const q of questions) {
    await addQuestion(testId, q);
  }
}

// ─── Students ───────────────────────────────────────────────
export async function getAllStudents() {
  const d = await getDb();
  return await d.select('SELECT * FROM students ORDER BY created_at DESC');
}

export async function getStudentsPaginated(page = 1, limit = 10, search = '') {
  const d = await getDb();
  const offset = (page - 1) * limit;
  
  if (search.trim()) {
    const searchLike = `%${search.trim()}%`;
    const rows = await d.select(
      `SELECT * FROM students WHERE full_name LIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [searchLike, limit, offset]
    );
    const countResult = await d.select(
      `SELECT COUNT(*) as total FROM students WHERE full_name LIKE $1`,
      [searchLike]
    );
    return { rows, total: countResult[0].total };
  }
  
  const rows = await d.select(
    `SELECT * FROM students ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const countResult = await d.select(`SELECT COUNT(*) as total FROM students`);
  return { rows, total: countResult[0].total };
}

export async function addStudent(fullName) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO students (full_name) VALUES ($1)',
    [fullName]
  );
  return result.lastInsertId;
}

export async function deleteStudent(id) {
  const d = await getDb();
  await d.execute('DELETE FROM students WHERE id = $1', [id]);
}

// ─── Test Sessions ──────────────────────────────────────────
export async function createTestSession(studentId, testId, totalQuestions) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO test_sessions (student_id, test_id, total_questions) VALUES ($1, $2, $3)',
    [studentId, testId, totalQuestions]
  );
  return result.lastInsertId;
}

export async function completeTestSession(sessionId, answeredCount) {
  const d = await getDb();
  await d.execute(
    'UPDATE test_sessions SET completed_at = CURRENT_TIMESTAMP, answered_questions = $1 WHERE id = $2',
    [answeredCount, sessionId]
  );
}

export async function saveTestAnswer(sessionId, questionId, hasRecording = false, recordingPath = null) {
  const d = await getDb();
  await d.execute(
    'INSERT INTO test_answers (session_id, question_id, has_recording, recording_path) VALUES ($1, $2, $3, $4)',
    [sessionId, questionId, hasRecording ? 1 : 0, recordingPath]
  );
}

export async function getAllTestSessions() {
  const d = await getDb();
  return await d.select(`
    SELECT 
      ts.id,
      ts.test_id,
      ts.started_at,
      ts.completed_at,
      ts.total_questions,
      ts.answered_questions,
      s.full_name as student_name,
      t.title as test_title
    FROM test_sessions ts
    JOIN students s ON ts.student_id = s.id
    LEFT JOIN tests t ON ts.test_id = t.id
    ORDER BY ts.started_at DESC
  `);
}

export async function getTestSessionsFiltered(testId = null, search = '', page = 1, limit = 10) {
  const d = await getDb();
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params = [];
  let paramIdx = 1;
  
  if (testId) {
    whereClause += ` AND ts.test_id = $${paramIdx}`;
    params.push(testId);
    paramIdx++;
  }
  
  if (search.trim()) {
    whereClause += ` AND s.full_name LIKE $${paramIdx}`;
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }
  
  const rows = await d.select(`
    SELECT 
      ts.id,
      ts.test_id,
      ts.started_at,
      ts.completed_at,
      ts.total_questions,
      ts.answered_questions,
      s.full_name as student_name,
      t.title as test_title
    FROM test_sessions ts
    JOIN students s ON ts.student_id = s.id
    LEFT JOIN tests t ON ts.test_id = t.id
    WHERE 1=1 ${whereClause}
    ORDER BY ts.started_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `, [...params, limit, offset]);
  
  const countResult = await d.select(`
    SELECT COUNT(*) as total
    FROM test_sessions ts
    JOIN students s ON ts.student_id = s.id
    LEFT JOIN tests t ON ts.test_id = t.id
    WHERE 1=1 ${whereClause}
  `, params);
  
  return { rows, total: countResult[0].total };
}

export async function getTestSessionDetails(sessionId) {
  const d = await getDb();
  const answers = await d.select(`
    SELECT 
      ta.id,
      ta.has_recording,
      ta.recording_path,
      ta.answered_at,
      q.q_text,
      q.part
    FROM test_answers ta
    JOIN questions q ON ta.question_id = q.id
    WHERE ta.session_id = $1
    ORDER BY ta.answered_at
  `, [sessionId]);
  return answers;
}

export async function deleteTestSession(sessionId) {
  const d = await getDb();
  await d.execute('DELETE FROM test_answers WHERE session_id = $1', [sessionId]);
  await d.execute('DELETE FROM test_sessions WHERE id = $1', [sessionId]);
}
