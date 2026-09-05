import { useState } from 'react';
import type { Answers } from '../rules/types';
import type { Question } from '../rules/questions';

/**
 * Renders one question and reports the answer up. Nothing here knows about the
 * rules engine -- it only knows how to collect a typed value for one key.
 */
export function QuestionCard({
  question,
  value,
  onAnswer,
  onSkip,
}: {
  question: Question;
  value: unknown;
  onAnswer: (key: keyof Answers, value: unknown) => void;
  onSkip: () => void;
}) {
  const [draft, setDraft] = useState<string>(value !== undefined ? String(value) : '');
  const [error, setError] = useState<string | null>(null);

  const submitNumber = () => {
    const n = Number(draft.replace(/,/g, ''));
    if (Number.isNaN(n) || draft === '') {
      setError('Enter a number.');
      return;
    }
    const min = question.min ?? 0; // every number/money field in this app is a non-negative real-world quantity
    if (n < min) {
      setError(`This can't be below ${min.toLocaleString('en-IN')}.`);
      return;
    }
    if (question.max !== undefined && n > question.max) {
      setError(`This can't be above ${question.max.toLocaleString('en-IN')}.`);
      return;
    }
    setError(null);
    onAnswer(question.key, n);
  };

  return (
    <div>
      <span className={`tier-tag ${question.tier}`}>
        {question.tier === 'must' ? 'Required' : 'Optional · narrows your range'}
      </span>
      <div className="q-label">{question.label}</div>
      {question.help && <div className="q-help">{question.help}</div>}
      {question.payoff && <div className="q-payoff">💡 {question.payoff}</div>}

      {(question.kind === 'number' || question.kind === 'money') && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            {question.kind === 'money' && (
              <span
                style={{
                  position: 'absolute',
                  left: '0.9rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-2)',
                }}
              >
                ₹
              </span>
            )}
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              placeholder={question.placeholder}
              style={question.kind === 'money' ? { paddingLeft: '1.7rem' } : undefined}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNumber();
              }}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={submitNumber} disabled={draft === ''}>
            Next
          </button>
        </div>
      )}
      {error && <div className="q-error">{error}</div>}

      {question.kind === 'choice' && (
        <div className="choice-grid">
          {question.choices?.map((c) => (
            <button
              key={c.value}
              className={`choice-btn ${value === c.value ? 'selected' : ''}`}
              onClick={() => onAnswer(question.key, c.value)}
            >
              {c.label}
              {c.hint && <span className="hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      )}

      {question.kind === 'boolean' && (
        <div className="bool-row">
          <button
            className={`bool-btn ${value === true ? 'selected' : ''}`}
            onClick={() => onAnswer(question.key, true)}
          >
            Yes
          </button>
          <button
            className={`bool-btn ${value === false ? 'selected' : ''}`}
            onClick={() => onAnswer(question.key, false)}
          >
            No
          </button>
        </div>
      )}

      {question.tier === 'additional' && (
        <div style={{ marginTop: '0.9rem' }}>
          <button className="btn btn-skip" onClick={onSkip}>
            Skip — I don't know / prefer not to say
          </button>
        </div>
      )}
    </div>
  );
}
