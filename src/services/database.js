import Database from '@tauri-apps/plugin-sql';

let db = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:speaking_app.db');
  }
  return db;
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
  return await d.select('SELECT * FROM tests ORDER BY created_at DESC');
}

export async function addTest(title, description) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO tests (title, description) VALUES ($1, $2)',
    [title, description]
  );
  return result.lastInsertId;
}

export async function updateTest(id, title, description) {
  const d = await getDb();
  await d.execute(
    'UPDATE tests SET title = $1, description = $2 WHERE id = $3',
    [title, description, id]
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
  return await d.select('SELECT * FROM questions ORDER BY part, id');
}

export async function getQuestionsByTestId(testId) {
  const d = await getDb();
  return await d.select('SELECT * FROM questions WHERE test_id = $1 ORDER BY part, id', [testId]);
}

export async function addQuestion(testId, question) {
  const d = await getDb();
  const result = await d.execute(
    'INSERT INTO questions (test_id, q_text, part, image, speaking_timer, prep_timer) VALUES ($1, $2, $3, $4, $5, $6)',
    [testId, question.q_text, question.part, question.image || null, question.speaking_timer, question.prep_timer]
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

export async function deleteQuestions(ids) {
  if (!ids?.length) return;
  const d = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await d.execute(`DELETE FROM questions WHERE id IN (${placeholders})`, ids);
}

export async function seedQuestionsFromJson(questions) {
  const d = await getDb();
  const existingQuestions = await d.select('SELECT COUNT(*) as count FROM questions');
  if (existingQuestions[0].count > 0) return; // Already seeded

  // Create a default test if none exists
  let testId;
  const existingTests = await d.select('SELECT id FROM tests LIMIT 1');
  if (existingTests.length === 0) {
    const result = await d.execute('INSERT INTO tests (title, description) VALUES ($1, $2)', ['Multilevel Mock Test', 'Seed data']);
    testId = result.lastInsertId;
  } else {
    testId = existingTests[0].id;
  }

  for (const q of questions) {
    await d.execute(
      'INSERT INTO questions (test_id, q_text, part, image, speaking_timer, prep_timer) VALUES ($1, $2, $3, $4, $5, $6)',
      [testId, q.q_text, q.part, q.image || null, q.speaking_timer, q.prep_timer]
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
