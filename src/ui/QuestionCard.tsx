import { useId, useState } from 'react';
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

  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const groupLabelId = `${inputId}-group`;

  const submitNumber = () => {
    const n = Number(draft.replace(/,/g, ''));
    if (Number.isNaN(n) || draft === '') {
      setError('Enter a number.');
      return;
    }
    const min = question.min ?? 0; // every number/money field here is a non-negative real-world quantity
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

  const isNumeric = question.kind === 'number' || question.kind === 'money';
  const describedBy = [question.help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <span className={`tier-tag ${question.tier}`}>
        {question.tier === 'must' ? 'Required' : 'Optional · narrows your range'}
      </span>

      {/* A real <label> for the single-input case; a group label otherwise. */}
      {isNumeric ? (
        <label className="q-label" htmlFor={inputId}>
          {question.label}
        </label>
      ) : (
        <div className="q-label" id={groupLabelId}>
          {question.label}
        </div>
      )}

      {question.help && (
        <div className="q-help" id={helpId}>
          {question.help}
        </div>
      )}
      {question.payoff && <div className="q-payoff">💡 {question.payoff}</div>}

      {isNumeric && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            {question.kind === 'money' && (
              <span
                aria-hidden="true"
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
              id={inputId}
              type="text"
              inputMode="decimal"
              value={draft}
              placeholder={question.placeholder}
              aria-describedby={describedBy || undefined}
              aria-invalid={error ? true : undefined}
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

      {error && (
        <div className="q-error" id={errorId} role="alert">
          {error}
        </div>
      )}

      {question.kind === 'choice' && (
        <div className="choice-grid" role="group" aria-labelledby={groupLabelId}>
          {question.choices?.map((c) => (
            <button
              key={c.value}
              className={`choice-btn ${value === c.value ? 'selected' : ''}`}
              aria-pressed={value === c.value}
              onClick={() => onAnswer(question.key, c.value)}
            >
              {c.label}
              {c.hint && <span className="hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      )}

      {question.kind === 'boolean' && (
        <div className="bool-row" role="group" aria-labelledby={groupLabelId}>
          <button
            className={`bool-btn ${value === true ? 'selected' : ''}`}
            aria-pressed={value === true}
            onClick={() => onAnswer(question.key, true)}
          >
            Yes
          </button>
          <button
            className={`bool-btn ${value === false ? 'selected' : ''}`}
            aria-pressed={value === false}
            onClick={() => onAnswer(question.key, false)}
          >
            No
          </button>
        </div>
      )}

      {question.tier === 'additional' && !question.requiredOnceAsked && (
        <div style={{ marginTop: '0.9rem' }}>
          <button className="btn btn-skip" onClick={onSkip}>
            Skip — I don't know / prefer not to say
          </button>
        </div>
      )}
    </div>
  );
}
