import React from 'react';

export default function ResultsScreen({ questions, recordings, onRestart, downloadRecording, downloadAll }) {
  const getRecording = (questionId) => recordings.find((r) => r.questionId === questionId);

  const PART_LABELS = {
    '1.1': 'Part 1.1',
    '1.2': 'Part 1.2',
    '2': 'Part 2',
    '3': 'Part 3',
  };

  const PART_COLORS = {
    '1.1': '#6c63ff',
    '1.2': '#00c9a7',
    '2': '#f7971e',
    '3': '#fc5c7d',
  };

  const totalQuestions = questions.length;
  const recordedCount = recordings.length;

  return (
    <div className="results-screen">
      <div className="results-screen__header">
        <h1 className="results-screen__title">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Test Complete!
        </h1>
        <p className="results-screen__subtitle">
          You answered {recordedCount} of {totalQuestions} questions
        </p>
      </div>

      <div className="results-screen__actions-top">
        <button className="btn btn--primary" onClick={downloadAll} disabled={recordings.length === 0}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download All Recordings
        </button>
        <button className="btn btn--outline" onClick={onRestart}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Restart Test
        </button>
      </div>

      <div className="results-screen__grid">
        {questions.map((q) => {
          const recording = getRecording(q.id);
          return (
            <div key={q.id} className="result-card">
              <div className="result-card__header">
                <span
                  className="result-card__badge"
                  style={{ background: PART_COLORS[q.part] }}
                >
                  {PART_LABELS[q.part]}
                </span>
                <span className="result-card__number">Q{q.id}</span>
              </div>
              <p className="result-card__text">{q.q_text}</p>
              {recording ? (
                <div className="result-card__audio-section">
                  <audio controls src={recording.url} className="result-card__audio" />
                  <button
                    className="btn btn--small btn--download"
                    onClick={() => downloadRecording(recording, `question-${q.id}.webm`)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>
              ) : (
                <div className="result-card__no-recording">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  <span>No recording</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
