# Borrower Copilot

A borrower-side loan self-assessment tool for the Indian retail credit market.

Lenders have underwriting models. Borrowers have nothing — they walk in blind,
accept the first sanction letter, and discover years later that they paid four
points over fair and stretched to 65% of income. This tool closes that gap: a
borrower answers a short adaptive interview and walks out knowing what to ask
for, what it should cost, and what to refuse.

No login, no credit-bureau pull, no backend, no persistence. Every calculation
runs client-side from what the borrower types.

---

## Contents

- [Quick start](#quick-start)
- [What it produces](#what-it-produces)
- [The core idea](#the-core-idea)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Design rules and how they are enforced](#design-rules-and-how-they-are-enforced)
- [Testing](#testing)
- [Generated documentation](#generated-documentation)
- [Known limitations](#known-limitations)

---

## Quick start

**Requirements:** Node `^18.0.0 || ^20.0.0 || >=22.0.0` (Vite 6 constraint).

```bash
npm install
npm run dev
```

Open the printed local URL. Use the **Try Priya / Ravi / Anita** buttons to load
a worked example instantly, or complete the interview yourself.

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run test` | Run the rules-engine test suite (28 tests) |
| `npm run docs` | Regenerate `RULES.md` and `RUNTHROUGHS.md` from the live engine |

---

## What it produces

For any borrower, the engine returns four outputs plus a negotiation aid. Every
figure carries a one-sentence, plain-English justification traced to a named
rule.

| Output | Description |
| :--- | :--- |
| **O1 — Verdict** | `BORROW`, `BORROW_LESS`, or `DONT_BORROW`. Refusals are reachable and are paired with a dated *path to yes* rather than a dead end. |
| **O2 — Amount** | Two separately computed figures: what a lender will likely sanction, and what the household can actually carry. The smaller is always recommended. |
| **O3 — Rate** | A fair rate *band* (never a point estimate) alongside the true all-in APR with fees and GST folded in. |
| **O4 — EMI ceiling** | A monthly figure not to cross, the tenure/interest trade-off, and stress cases for a rate rise, an income drop, and a month with no income. |
| **Negotiation Card** | A single screenshot-able card: amount to ask for, fair rate, maximum APR, maximum EMI, maximum fee, the reasons behind each, and explicit walk-away triggers. |

---

## The core idea

A lender's affordability test asks *"can this person plausibly repay?"* and
answers with a FOIR ratio against income. That is a **lender-safety** test, not
a **borrower-safety** test, and the two diverge sharply. A well-paid borrower
with high rent can be offered two to three times what their real cash flow
supports.

This engine computes both, side by side, and always recommends the smaller:

```
Lender view                          Borrower view
─────────────                        ─────────────
Income × FOIR                        Income
  − existing EMIs                      − living costs (plausibility-floored)
                                       − existing EMIs
                                       − mandatory savings
                                     = surplus × stability factor
```

It also prices **every product** that could serve the stated purpose rather
than only the one the borrower assumed. For a borrower with an unencumbered
asset, "you are asking for the wrong product" is frequently the single most
valuable output — worth several percentage points and several lakhs.

---

## Architecture

The decision layer is a dependency-free TypeScript library with no React
imports and no side effects. It has three independent consumers: the UI, the
test suite, and the documentation generators.

```
                    constants.ts
         (every tunable threshold, and only here)
                          │
     ┌───────────┬────────┼────────┬────────────┐
     ▼           ▼        ▼        ▼            ▼
  income   affordability pricing products    verdict
     └───────────┴────────┼────────┴────────────┘
                          ▼
              engine.ts — assess(Answers) → Assessment
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
     React UI        test suite      docs generators
```

`assess()` runs a fixed pipeline: confidence → product routing → income →
affordability → O1–O4 → negotiation card. Routing deliberately precedes income
assessment, because secured versus unsecured changes the FOIR relief, the
co-applicant treatment, the fee schedule, and how a missing credit score is
priced.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full rationale.

---

## Project structure

```
src/
├── rules/                  Decision engine — zero dependencies, zero React
│   ├── constants.ts        Every threshold, band and assumption
│   ├── types.ts            Domain types
│   ├── finance.ts          EMI, principal, and IRR-solved APR
│   ├── income.ts           Lender-assessed vs borrower-reliable income
│   ├── affordability.ts    FOIR capacity vs cash-flow capacity
│   ├── pricing.ts          Rate scorecard and all-in APR
│   ├── products.ts         Eligibility, LTV sizing, product routing
│   ├── verdict.ts          O1 decision tree and path-to-yes
│   ├── stress.ts           Stress scenarios
│   ├── confidence.ts       Answer coverage → band widths
│   ├── questions.ts        Adaptive question bank
│   └── engine.ts           Orchestrator
├── personas/               Priya, Ravi and Anita, with stated assumptions
├── ui/                     Presentational components
├── App.tsx                 Interview flow and stage management
└── styles.css

scripts/                    Documentation generators
tests/                      Engine test suite
```

---

## Design rules and how they are enforced

The brief specifies five rules. Each is enforced structurally rather than by
convention:

**1. Adaptive questioning.** Each additional question carries a `shouldAsk`
predicate evaluated against current answers. There is no separate "salaried
flow" and "self-employed flow" to keep synchronised — a business owner simply
never satisfies the employer-category predicate. Relevance is recomputed on
every answer.

**2. Confidence widens with silence.** Band width is a function of answered
coverage, plus targeted penalties for an unknown credit score and an unknown
worst month. No band narrows because a question went unanswered — only because
one was answered.

**3. Unknown is never zero.** A missing credit score widens the band rather
than pricing to the worst tier. Critically, silence can never produce a better
outcome than disclosure: a borrower who declares a missed payment but withholds
its date is capped below `BORROW`, while an honestly disclosed eleven-month-old
miss still clears. Pinned by four regression tests.

**4. Every number has a why.** Every output carries `Reason[]` — plain-English
sentences tagged with the rule ID that produced them. Nothing surfaces a figure
without the sentence explaining it.

**5. India, in rupees.** FOIR-based affordability, RBI-style all-in APR
disclosure, and seven real product families (home, LAP, personal, unsecured
business, gold, two-wheeler/EV, auto) with market-observed rate bands.

---

## Testing

```bash
npm run test
```

28 tests covering domain behaviour rather than implementation detail:

- `DONT_BORROW` is genuinely reachable, not merely representable
- The lender figure and the safe figure are computed independently and ordered correctly
- APR always meets or exceeds the nominal rate whenever fees are positive, and equals it when they are not
- Fewer answers never yield a narrower band
- An unknown score prices better than a known-bad one
- Withholding a missed-payment date never beats disclosing it, in both directions
- Product routing selects secured lending for a borrower with unencumbered collateral
- Every reason attached to every output carries non-empty text and a rule ID

`assess()` is total: empty, zero-income, and zero-amount inputs return coherent
results rather than throwing.

---

## Generated documentation

[`RULES.md`](RULES.md) and [`RUNTHROUGHS.md`](RUNTHROUGHS.md) are **generated,
not hand-written**. `npm run docs` renders them from the same constants and the
same `assess()` call the application uses, so documented thresholds cannot drift
from computed ones.

| Document | Contents |
| :--- | :--- |
| [RULES.md](RULES.md) | Every threshold: value, justification, and source (RBI / market / judgement) |
| [RUNTHROUGHS.md](RUNTHROUGHS.md) | Full worked runs for all three personas, including questions asked, questions skipped, and assumptions made where the brief gave no figure |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Module boundaries and the reasoning behind them |
| [WALKTHROUGH.md](WALKTHROUGH.md) | What would be built next, and what would be cut |

---

## Known limitations

Stated deliberately; see the closing section of [RULES.md](RULES.md) for the
full list.

- **No bureau integration.** Credit score is self-reported as a band, and the
  engine never claims more precision than that.
- **Rate bands are a September 2026 market snapshot,** not a live feed. They
  will drift and need periodic review.
- **No lender-specific policy overlays.** Real lenders apply pincode rules,
  minimum tickets and industry exclusions this model cannot see. Bands here are
  market-wide estimates.
- **Simplified fee treatment.** GST is applied to the processing fee at a flat
  18%, which is correct for the disclosed fee but does not model every
  ancillary charge on a real sanction letter.
- **Persona assumptions are the builder's,** not the brief's. Where the brief
  omitted a figure — Priya's non-rent living costs, Ravi's turnover, Anita's
  app-loan EMI — the assumption is stated inline in `RUNTHROUGHS.md`, because
  those figures materially move the results.
