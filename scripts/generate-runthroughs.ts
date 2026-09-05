/**
 * Generates RUNTHROUGHS.md: for each of the three brief personas, the
 * questions actually asked (adaptive path), the four outputs, and the
 * Negotiation Card. Run `npm run docs` to regenerate after any rule change.
 */
import { writeFileSync } from 'node:fs';
import { assess } from '../src/rules/engine';
import { relevantQuestions, isAnswered, MUST_QUESTIONS } from '../src/rules/questions';
import { PERSONAS, type Persona } from '../src/personas';
import { formatINR, formatINRShort, formatPct } from '../src/rules/finance';
import type { Assessment } from '../src/rules/types';

function renderQuestionsAsked(p: Persona): string {
  const qs = relevantQuestions(p.answers);
  const asked = qs.filter((q) => isAnswered(p.answers, q.key));
  const skipped = qs.filter((q) => !isAnswered(p.answers, q.key));
  const musts = asked.filter((q) => q.tier === 'must').length;
  const additional = asked.filter((q) => q.tier === 'additional').length;

  const lines = asked
    .map((q) => {
      const v = p.answers[q.key];
      const display = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
      return `| ${q.tier === 'must' ? '**Must**' : 'Additional'} | ${q.label} | ${display} |`;
    })
    .join('\n');

  return `${musts} of ${MUST_QUESTIONS.length} must-questions answered, plus ${additional} additional question${
    additional === 1 ? '' : 's'
  } relevant to this profile (${qs.length - MUST_QUESTIONS.length} applied in total, ${
    skipped.length
  } left unanswered).

| Tier | Question | Answer |
|---|---|---|
${lines}

${
  skipped.length > 0
    ? `*Skipped, and therefore widening the bands below:* ${skipped.map((q) => q.label).join('; ')}.`
    : '*Every relevant question was answered for this borrower.*'
}

${p.notAskedNote}`;
}

function renderOutputs(r: Assessment): string {
  return `#### O1 — ${r.o1.verdict.replace('_', ' ')}

**${r.o1.headline}**

${r.o1.hardStops.map((h) => `> 🛑 ${h.text}`).join('\n\n')}
${r.o1.reasons.map((h) => `> ${h.text}`).join('\n\n')}

${
  r.pathToYes
    ? `**Path to yes** (~${r.pathToYes.timelineMonths} months, unlocks ~${formatINRShort(
        r.pathToYes.unlocksAmount,
      )}):\n\n${r.pathToYes.steps.map((s, i) => `${i + 1}. **${s.action}** — ${s.effect}`).join('\n')}\n`
    : ''
}

#### O2 — How much

| | Amount |
|---|---|
| A lender will likely sanction | ${formatINRShort(r.o2.lenderWillLikelySanction)} |
| Borrower can safely carry (**use this**) | ${formatINRShort(r.o2.borrowerCanSafelyCarry)} |

> ${r.o2.reasons[r.o2.reasons.length - 1]?.text}

#### O3 — Fair rate

Fair band: **${formatPct(r.o3.fairBand.low, 2)} – ${formatPct(r.o3.fairBand.high, 2)}**
All-in APR (with fees): **${formatPct(r.o3.allInAprBand.low, 2)} – ${formatPct(r.o3.allInAprBand.high, 2)}**

Fee breakdown on the recommended amount:
${r.o3.feeBreakdown.map((f) => `- ${f.label}: ${formatINR(f.amount)}`).join('\n')}

${
  r.o3.quoteComparison
    ? `> ${r.o3.reasons.find((x) => x.ruleId === 'O3.quote')?.text}`
    : '*No prior lender quote was given for this run-through.*'
}

#### O4 — EMI ceiling

Ceiling: **${formatINR(r.o4.ceilingEmi)}/month**. Recommended EMI at the amount above: **${formatINR(
    r.o4.recommendedEmi,
  )}/month** over ${r.product.tenureMonths} months.

Stress cases:
${r.o4.stressCases.map((s) => `- ${s.survives ? '✅' : '⚠️'} **${s.label}** — ${s.detail}`).join('\n')}
`;
}

function renderCard(r: Assessment): string {
  if (!r.card.readyToNegotiate) {
    return `\`\`\`
${r.card.productName.toUpperCase()} — ${r.card.borrowerLabel}
------------------------------------------------------------
NOT READY TO NEGOTIATE YET

${r.card.notReadyReason}
\`\`\``;
  }

  return `\`\`\`
${r.card.productName.toUpperCase()} — ${r.card.borrowerLabel}
------------------------------------------------------------
Ask:              ${formatINRShort(r.card.askAmount)}  ·  ${r.card.tenureMonths} months
Recommended:      ${formatINRShort(r.card.recommendedAmount)}
Fair rate:        ${formatPct(r.card.fairRateBand.low, 1)} – ${formatPct(r.card.fairRateBand.high, 1)}
Max all-in APR:   ${formatPct(r.card.maxAprAccepted, 2)}
Max EMI:          ${formatINR(r.card.maxEmi)}
Max processing fee: ${formatINR(r.card.maxProcessingFee)} + GST

WHY
${r.card.becauseLines.map((l) => `  - ${l}`).join('\n')}

WALK AWAY IF
${r.card.walkAwayIf.map((l) => `  - ${l}`).join('\n')}
\`\`\``;
}

const sections = PERSONAS.map((p) => {
  const r = assess(p.answers);
  return `## ${p.name} — ${p.headline}

**As given in the brief:** ${p.storyFromBrief}

### Questions the adaptive interview actually asked

${renderQuestionsAsked(p)}

### Routing

Routed to: **${r.product.name}** ${r.product.secured ? '(secured)' : '(unsecured)'}.
${r.routingNote ? `\n> ${r.routingNote}\n` : ''}
Confidence: **${r.confidence}** (${r.answeredCount}/${r.relevantCount} relevant questions answered).

### The four outputs

${renderOutputs(r)}

### Negotiation Card

${renderCard(r)}

---
`;
}).join('\n');

const doc = `# RUNTHROUGHS.md — Priya, Ravi, Anita

Generated from the live engine by \`npm run docs\`. These are not hand-typed
numbers: they are the actual output of \`assess()\` given each persona's
answers exactly as recorded in [\`src/personas/index.ts\`](src/personas/index.ts).

${sections}
## What these three runs are meant to demonstrate

- **Priya** is the easy case. The differentiator is not the verdict — it's
  showing the lender-vs-safe amount gap, an honest all-in APR against a lender
  quote she already has, and the tenure trade-off.
- **Ravi** is the product-routing test. He asked for an unsecured business
  loan; the engine notices the unencumbered shop and routes him to a loan
  against property instead, at a materially lower rate and higher amount.
- **Anita** is the "don't borrow" test, with nuance. A fresh bounce and zero
  surplus produce hard stops — but the engine still finds that her purpose is
  productive (a delivery e-scooter), routes what capacity does exist toward a
  secured two-wheeler loan rather than an unsecured one, and gives her a
  concrete, time-boxed path back to yes rather than a flat refusal.
`;

writeFileSync(new URL('../RUNTHROUGHS.md', import.meta.url), doc, 'utf-8');
console.log(`RUNTHROUGHS.md written for ${PERSONAS.length} personas.`);
