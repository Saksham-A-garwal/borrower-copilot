# Borrower Copilot

A self-assessment tool that helps an Indian borrower answer four questions
*before* they walk into a lender:

1. Should I borrow at all?
2. How much am I really eligible for?
3. What is a fair rate for me?
4. What EMI should I agree to?

...and then hands them a one-page **Negotiation Card** to hold up at the
branch counter. No login, no bureau pull, no backend, nothing stored —
everything runs from what the borrower types into this browser tab.

Built for the Lokta Borrower Copilot build challenge.

## Run it (under 5 minutes)

Requires Node 18+.

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). Click **"Try
Priya / Ravi / Anita"** at the top to instantly load one of the three brief
personas and jump straight to their results, or answer the interview
yourself starting from "What is the loan for?".

```bash
npm run test    # 28 unit tests over the rules engine
npm run build   # production build (tsc + vite)
npm run docs    # regenerates RULES.md and RUNTHROUGHS.md from the live engine
```

## What's in this repo

| Path | What it is |
|---|---|
| [`src/rules/`](src/rules) | The entire decision engine. Pure TypeScript, zero dependencies, zero React. This is the code you're really being evaluated on. |
| [`src/rules/constants.ts`](src/rules/constants.ts) | **Every tunable number lives here**, and only here. FOIR slabs, safe-EMI factors, rate scorecards, product bands, stress assumptions. |
| [`src/rules/engine.ts`](src/rules/engine.ts) | The orchestrator: `assess(answers) -> Assessment`, producing O1–O4 and the Negotiation Card. |
| [`src/rules/questions.ts`](src/rules/questions.ts) | The adaptive question bank — 10 must-questions, ~25 additional ones, each declaring which output it moves. |
| [`src/personas/`](src/personas) | Priya, Ravi and Anita, encoded exactly as given in the brief. |
| [`src/App.tsx`](src/App.tsx), [`src/ui/`](src/ui) | The interview flow and results dashboard. |
| [`tests/engine.test.ts`](tests/engine.test.ts) | 28 tests: reachability of "don't borrow", lender-vs-safe separation, APR-with-fees correctness, confidence widening with silence, unknown-is-not-zero, product routing, and that silence never buys a better answer than disclosure. |
| [`RULES.md`](RULES.md) | **Generated.** Every threshold, its value, its justification, its source. Read as carefully as the code. |
| [`RUNTHROUGHS.md`](RUNTHROUGHS.md) | **Generated.** The three required run-throughs: questions asked, four outputs, Negotiation Card, for Priya, Ravi and Anita. |
| [`WALKTHROUGH.md`](WALKTHROUGH.md) | The five-minute walkthrough: what I'd build next, what I'd cut. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the pieces fit together and why the boundaries are where they are. |

`RULES.md` and `RUNTHROUGHS.md` are **generated, not hand-written** — run
`npm run docs` after any change to `constants.ts` or `src/personas/index.ts`
and they regenerate from the exact numbers the app computes with. They cannot
drift from the code, because they are the code, rendered as prose.

## The core idea, in one paragraph

A lender's underwriting model asks "can this person plausibly repay?" and
answers with a FOIR ratio against income. That is a *lender-safety* test, not
a *borrower-safety* test, and the two numbers are often very different — a
well-paid but heavily-rented borrower can be offered 2-3x what their real cash
flow can carry. This app runs both calculations side by side, always
recommends the smaller one, and shows the one-sentence reason for every number
it produces. It also prices every product that could plausibly serve the
borrower's stated purpose — not just the one they assumed — because the
single highest-value thing it can tell a borrower with an unencumbered asset
is "you're asking for the wrong product."

## Testing the three required rules directly

- **Adaptive** — `src/rules/questions.ts`'s `shouldAsk` gates. Try Ravi: you
  will never be asked about an employer. Try Priya: you will never be asked
  for an ITR figure.
- **Confidence widens with silence** — click "Try Priya", then compare her
  rate band against `PRIYA_MUSTS_ONLY` in `src/personas/index.ts` (exercised
  directly in `tests/engine.test.ts`). Fewer answers never produce a tighter
  band.
- **Unknown is never zero** — set Priya's credit score to "I have loans but
  do not know my score" in the interview and watch the band widen rather than
  the rate spike to the worst-case tier.
