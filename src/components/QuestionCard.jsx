import React from 'react';

const PART_LABELS = {
  '1.1': 'Part 1 — Introduction',
  '1.2': 'Part 1 — Visual',
  '2': 'Part 2 — Long Turn',
  '3': 'Part 3 — Discussion',
};

const PART_COLORS = {
  '1.1': '#6c63ff',
  '1.2': '#00c9a7',
  '2': '#f7971e',
  '3': '#fc5c7d',
};

export default function QuestionCard({ question, isActive }) {
  if (!question) return null;

  return (
    <div className={`question-card ${isActive ? 'active' : ''}`}>
      <div className="question-card__header">
        <span
          className="question-card__badge"
          style={{ background: PART_COLORS[question.part] }}
        >
          {PART_LABELS[question.part]}
        </span>
        <span className="question-card__number">Q{question.id}</span>
      </div>

      {question.image && (
        <div className="question-card__image-wrapper">
          <img
            src={question.image}
            alt="Visual prompt"
            className="question-card__image"
            loading="eager"
          />
        </div>
      )}

      <p className="question-card__text">{question.q_text}</p>

      <div className="question-card__meta">
        <div className="question-card__meta-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Prep: {question.prep_timer}s</span>
        </div>
        <div className="question-card__meta-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span>Speak: {question.speaking_timer}s</span>
        </div>
      </div>
    </div>
  );
}
