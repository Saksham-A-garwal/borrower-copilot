import { useMemo, useState } from 'react';
import { QuestionCard } from './ui/QuestionCard';
import { ResultsView } from './ui/ResultsView';
import { assess } from './rules/engine';
import { relevantQuestions, isAnswered, answeredStats } from './rules/questions';
import { PERSONAS } from './personas';
import type { Answers, AnswerKey } from './rules/types';

type Stage = 'interview' | 'results';

/**
 * The interview is a live loop, not a fixed wizard: `relevantQuestions` is
 * recomputed on every answer, so a borrower who says "self-employed" starts
 * seeing self-employed questions immediately, and one who says "informal"
 * never sees an employer question at all. This is what Rule 1 (adaptive)
 * means in code, not just in the question bank.
 */
export default function App() {
  const [answers, setAnswers] = useState<Answers>({});
  const [stage, setStage] = useState<Stage>('interview');
  const [cursor, setCursor] = useState(0);

  const questions = useMemo(() => relevantQuestions(answers), [answers]);
  const currentQuestion = questions[Math.min(cursor, questions.length - 1)];
  const stats = answeredStats(answers);

  const mustDone = questions
    .filter((q) => q.tier === 'must')
    .every((q) => isAnswered(answers, q.key));

  const assessment = useMemo(() => (stage === 'results' ? assess(answers) : null), [stage, answers]);

  const advance = (updated: Answers) => {
    setAnswers(updated);
    const nextQuestions = relevantQuestions(updated);
    let next = cursor + 1;
    while (next < nextQuestions.length && isAnswered(updated, nextQuestions[next].key)) {
      next += 1;
    }
    if (next >= nextQuestions.length) {
      setStage('results');
    } else {
      setCursor(next);
    }
  };

  const onAnswer = (key: AnswerKey, value: unknown) => {
    advance({ ...answers, [key]: value } as Answers);
  };

  const onSkip = () => {
    advance({ ...answers });
    setCursor((c) => c + 1);
  };

  const goToResultsNow = () => {
    if (mustDone) setStage('results');
  };

  const loadPersona = (id: string) => {
    const p = PERSONAS.find((x) => x.id === id);
    if (!p) return;
    setAnswers(p.answers);
    setStage('results');
    setCursor(0);
  };

  const reset = () => {
    setAnswers({});
    setStage('interview');
    setCursor(0);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">Borrower Copilot</span>
          <span className="tag">know your number before you walk in</span>
        </div>
        {stage === 'interview' && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (stats.answered / Math.max(stats.relevant, 1)) * 100)}%` }}
              />
            </div>
            <div className="progress-label">
              {stats.answered}/{stats.relevant} answered
            </div>
          </div>
        )}
      </div>

      <div className="persona-strip">
        {PERSONAS.map((p) => (
          <button key={p.id} className="persona-chip" onClick={() => loadPersona(p.id)}>
            Try {p.name.split(',')[0]}
          </button>
        ))}
        <button className="persona-chip reset" onClick={reset}>
          ↺ Start over
        </button>
      </div>

      {stage === 'interview' && currentQuestion && (
        <div className="card">
          <QuestionCard
            key={currentQuestion.key}
            question={currentQuestion}
            value={answers[currentQuestion.key]}
            onAnswer={onAnswer}
            onSkip={onSkip}
          />
          {mustDone && (
            <div className="nav-row">
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-2)' }}>
                You've answered enough for a result already.
              </span>
              <button className="btn btn-primary btn-small" onClick={goToResultsNow}>
                See my numbers now →
              </button>
            </div>
          )}
        </div>
      )}

      {stage === 'results' && assessment && (
        <ResultsView
          assessment={assessment}
          answeredCount={stats.answered}
          relevantCount={stats.relevant}
          onEditAnswers={() => {
            setStage('interview');
            const qs = relevantQuestions(answers);
            const firstUnanswered = qs.findIndex((q) => !isAnswered(answers, q.key));
            setCursor(firstUnanswered === -1 ? qs.length : firstUnanswered);
          }}
        />
      )}

      <div className="footer-note">
        No login. No bureau pull. Nothing is stored or sent anywhere — everything runs in this browser tab.
      </div>
    </div>
  );
}
