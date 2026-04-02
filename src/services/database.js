import Database from '@tauri-apps/plugin-sql';

let db = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:speaking_app.db');
  }
  return db;
}

// ─── App Settings ───────────────────────────────────────────
export async function getSetting(key) {
  const d = await getDb();
  const rows = await d.select('SELECT value FROM app_settings WHERE key = $1', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key, value) {
  const d = await getDb();
  await d.execute(
    'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value]
  );
}

// ─── PIN & Admin Password ───────────────────────────────────
export async function verifyPin(pin) {
  const storedPin = await getSetting('student_pin');
  if (!storedPin) {
    // First time — no PIN set yet, set it
    await setSetting('student_pin', pin);
    return true;
  }
  return storedPin === pin;
}

export async function verifyAdminPassword(password) {
  const storedPassword = await getSetting('admin_password');
  if (!storedPassword) {
    await setSetting('admin_password', password);
    return true;
  }
  return storedPassword === password;
}

export async function isPinSet() {
  const pin = await getSetting('student_pin');
  return !!pin;
}

export async function isAdminPasswordSet() {
  const pw = await getSetting('admin_password');
  return !!pw;
}

export async function updatePin(newPin) {
  await setSetting('student_pin', newPin);
}

export async function updateAdminPassword(newPassword) {
  await setSetting('admin_password', newPassword);
}

// ─── Questions ──────────────────────────────────────────────
export async function getAllQuestions() {
  const d = await getDb();
  return await d.select('SELECT * FROM questions ORDER BY part, id');
}

export async function addQuestion(question) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO questions (q_text, part, image, speaking_timer, prep_timer) VALUES ($1, $2, $3, $4, $5)',
    [question.q_text, question.part, question.image || null, question.speaking_timer, question.prep_timer]
  );
  return result.lastInsertId;
}

export async function updateQuestion(id, question) {
  const d = await getDb();
  await d.execute(
    'UPDATE questions SET q_text = $1, part = $2, image = $3, speaking_timer = $4, prep_timer = $5 WHERE id = $6',
    [question.q_text, question.part, question.image || null, question.speaking_timer, question.prep_timer, id]
  );
}

export async function deleteQuestion(id) {
  const d = await getDb();
  await d.execute('DELETE FROM questions WHERE id = $1', [id]);
}

export async function seedQuestionsFromJson(questions) {
  const d = await getDb();
  const existing = await d.select('SELECT COUNT(*) as count FROM questions');
  if (existing[0].count > 0) return; // Already seeded

  for (const q of questions) {
    await d.execute(
      'INSERT INTO questions (q_text, part, image, speaking_timer, prep_timer) VALUES ($1, $2, $3, $4, $5)',
      [q.q_text, q.part, q.image || null, q.speaking_timer, q.prep_timer]
    );
  }
}

// ─── Students ───────────────────────────────────────────────
export async function getAllStudents() {
  const d = await getDb();
  return await d.select('SELECT * FROM students ORDER BY created_at DESC');
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
export async function createTestSession(studentId, totalQuestions) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO test_sessions (student_id, total_questions) VALUES ($1, $2)',
    [studentId, totalQuestions]
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

export async function saveTestAnswer(sessionId, questionId, hasRecording = false) {
  const d = await getDb();
  await d.execute(
    'INSERT INTO test_answers (session_id, question_id, has_recording) VALUES ($1, $2, $3)',
    [sessionId, questionId, hasRecording ? 1 : 0]
  );
}

export async function getAllTestSessions() {
  const d = await getDb();
  return await d.select(`
    SELECT 
      ts.id,
      ts.started_at,
      ts.completed_at,
      ts.total_questions,
      ts.answered_questions,
      s.full_name as student_name
    FROM test_sessions ts
    JOIN students s ON ts.student_id = s.id
    ORDER BY ts.started_at DESC
  `);
}

export async function getTestSessionDetails(sessionId) {
  const d = await getDb();
  const answers = await d.select(`
    SELECT 
      ta.id,
      ta.has_recording,
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
