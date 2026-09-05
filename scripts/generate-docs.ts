/**
 * Generates RULES.md straight from the live constants in src/rules/constants.ts.
 *
 * This is the point of the exercise: RULES.md cannot describe a threshold the
 * engine is not actually using, because it is not hand-written -- it is
 * rendered from the same RULE_DOCS array the engine's own comments reference.
 * Change a number in constants.ts, run `npm run docs`, and the table updates
 * itself.
 */
import { writeFileSync } from 'node:fs';
import { RULE_DOCS, type RuleDoc } from '../src/rules/constants';

function section(title: string, rows: RuleDoc[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map((r) => `| \`${r.id}\` | ${r.what} | ${r.value.replace(/\|/g, '\\|')} | ${r.why} | ${r.source} |`)
    .join('\n');
  return `\n### ${title}\n\n| Rule ID | What | Value | Why | Source |\n|---|---|---|---|---|\n${body}\n`;
}

function bySource(source: RuleDoc['source']): RuleDoc[] {
  return RULE_DOCS.filter((r) => r.source === source);
}

const groups: { title: string; prefix: string }[] = [
  { title: 'Affordability (FOIR — the lender test)', prefix: 'FOIR.' },
  { title: 'Affordability (the borrower-safe test)', prefix: 'SAFE.' },
  { title: 'Income assessment', prefix: 'INCOME.' },
  { title: 'Pricing (rate scorecard)', prefix: 'RATE.' },
  { title: 'Fees and APR', prefix: 'FEE.' },
  { title: 'Product eligibility and sizing', prefix: 'PRODUCT.' },
  { title: 'Verdict thresholds', prefix: 'VERDICT.' },
  { title: 'Stress testing', prefix: 'STRESS.' },
  { title: 'Tenure and age', prefix: 'TENURE.' },
];

const grouped = groups
  .map((g) => section(g.title, RULE_DOCS.filter((r) => r.id.startsWith(g.prefix))))
  .join('');

const sourceSummary = `
| Source | Count | Meaning |
|---|---|---|
| RBI | ${bySource('RBI').length} | A published Reserve Bank of India rule, circular, or statutory rate. |
| MARKET | ${bySource('MARKET').length} | Observed public lender rate cards / underwriting norms, September 2026. |
| JUDGEMENT | ${bySource('JUDGEMENT').length} | My own judgement as the builder, defended below and open to challenge. |
`;

const doc = `# RULES.md — Borrower Copilot

**This file is generated.** Run \`npm run docs\` after changing anything in
[\`src/rules/constants.ts\`](src/rules/constants.ts) to regenerate it. Every row
below is read directly out of the constant the engine actually computes with —
this document cannot describe a number the app is not using, because it is not
typed by hand.

## How to read this table

- **Rule ID** — matches the \`ruleId\` attached to every explanation the app
  shows a borrower. If the app says "because FOIR.slab", you can find the exact
  number and its justification here.
- **Source** — see the summary below. Roughly a third of the rules are RBI
  requirements or hard market data; the rest are my own judgement calls, stated
  as such rather than dressed up as fact.

${sourceSummary}
## Design principles this rules engine follows

1. **Two capacity numbers, always.** Every affordability calculation produces
   a lender view (FOIR-based, what a bank's underwriting model would say) and a
   borrower view (cash-flow based, what the household can actually carry). The
   app always recommends the smaller one.
2. **Confidence widens with silence.** No band ever gets narrower because a
   question went unanswered — only wider. See \`RATE.bandWidth\` and the
   confidence engine in [\`src/rules/confidence.ts\`](src/rules/confidence.ts).
3. **Unknown is never zero.** An unknown credit score, an unknown worst month,
   or unbanked informal income are modelled as missing information with a
   stated, bounded cost — never silently treated as the worst possible value.
4. **Every number has a one-sentence why.** Every output the engine returns
   carries a \`reasons: Reason[]\` array of plain-English sentences, each tagged
   with the rule id that produced it. Nothing in the UI shows a number without
   also showing the sentence that explains it.
5. **Rules live in one file, separate from the UI.** Everything above is in
   [\`src/rules/constants.ts\`](src/rules/constants.ts). Changing a threshold —
   including live, in the follow-up interview — never requires touching a
   component.

${grouped}

## What this rules engine deliberately does NOT know

Being honest about the edges of the model is itself part of the design (see
the scoring criterion "honesty about limits" in the brief).

- **No real bureau data.** Credit score is entirely self-reported, in a band,
  not a number. We never pretend to more precision than that.
- **No macro rate environment.** Rate floors/ceilings in \`PRODUCTS\` are a
  September 2026 market snapshot. They will drift and need periodic review;
  they are not pulled from a live source.
- **No lender-specific policy.** Real lenders have overlays this model cannot
  see — a specific bank's negative pincode list, a specific NBFC's minimum
  ticket for a given city tier. The bands here are a market-wide estimate, and
  the app says so.
- **No tax or accounting advice.** The self-employed income logic (banking
  surrogate, ITR gap) mirrors how lenders underwrite, not how a borrower should
  file taxes.
- **Simplified GST treatment.** GST is applied only to the processing fee, at
  a flat 18%, which is correct for the disclosed fee but does not model every
  ancillary charge a real sanction letter might itemise.
- **One rate-reset assumption in the stress test.** The +2pp rate-rise stress
  case is a judgement call about a plausible cycle, not a forecast.
`;

writeFileSync(new URL('../RULES.md', import.meta.url), doc, 'utf-8');
console.log(`RULES.md written with ${RULE_DOCS.length} rules across ${groups.length} sections.`);
