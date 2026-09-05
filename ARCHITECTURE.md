# Architecture

## The one design decision everything else follows from

**Rules are separate from UI, and rules are pure functions with no dependencies.**

The brief scores "rules separated from UI" directly, and says the follow-up
interview will ask you to change a rule live. If a threshold is buried inside
a component's JSX, that moment fails. So `src/rules/` never imports React, never
touches the DOM, and never has a side effect. It is a library that happens to
be consumed by a UI, tested by Vitest, and rendered into documentation by two
scripts — three consumers of one source of truth.

```
                       ┌─────────────────────────┐
                       │   constants.ts           │   every tunable number
                       │   (FOIR slabs, rate      │   lives here, nowhere
                       │   scorecards, product     │   else
                       │   bands, thresholds)      │
                       └────────────┬──────────────┘
                                    │ imported by
        ┌───────────────┬──────────┼──────────┬───────────────┐
        ▼               ▼          ▼          ▼               ▼
   income.ts     affordability.ts pricing.ts products.ts  verdict.ts
   (lender vs    (FOIR capacity   (rate       (routing:    (O1: borrow /
   borrower      vs safe cash-    scorecard,  which        borrow less /
   income)       flow capacity)   honest APR) product?)    don't, + path
        │               │          │          │           to yes)
        └───────┬───────┴──────────┴──────────┴───────────────┘
                ▼
          engine.ts  ── assess(Answers) -> Assessment
                │
   ┌────────────┼─────────────────┬──────────────────┐
   ▼            ▼                 ▼                   ▼
 App.tsx    tests/engine        scripts/           scripts/
 (React UI)  .test.ts           generate-docs.ts   generate-runthroughs.ts
                                 -> RULES.md         -> RUNTHROUGHS.md
```

Nothing above the `engine.ts` line knows the app is a web page. That is
deliberate: it is what lets `RULES.md` be generated instead of hand-written,
what lets the test suite assert on domain behaviour without mounting a
component, and what makes "change FOIR from 55% to 45%" a one-line edit in
`constants.ts` rather than a hunt through the tree.

## Data flow through `assess()`

`engine.ts` runs a fixed pipeline for every request. Order matters — each
stage consumes the previous stage's output, never re-derives it:

1. **`assessConfidence(answers)`** — before anything else, decide how much the
   engine is allowed to claim to know. Counts answered vs. relevant questions
   (relevance itself is adaptive — see below), and turns that into a rate-band
   half-width and an amount-band width used by every later stage.

2. **`routeProduct(answers, confidence)`** — figures out which loan product the
   borrower should actually be discussing. This runs *before* income and
   affordability because the product decides which rules apply: secured vs.
   unsecured changes the FOIR relief, the co-applicant credit, and whether
   collateral capacity caps the amount. It prices every candidate product for
   the stated purpose at a common comparison amount (so a $2,000 fixed fee on
   a small ticket doesn't make an unrelated product look artificially cheap),
   then ranks by coverage-of-need first, true all-in cost second.

3. **`assessIncome(answers, secured)`** — produces two numbers:
   `lenderMonthly` (what a document-driven underwriter would credit) and
   `borrowerMonthly` (what the household can rely on in a bad month). For a
   salaried borrower these nearly coincide; for self-employed and informal
   borrowers they can differ by 2x in either direction.

4. **`assessAffordability(answers, income, secured)`** — turns those two
   incomes into two EMI capacities: `lenderMaxEmi` (FOIR arithmetic) and
   `safeMaxEmi` (surplus arithmetic: income minus a plausibility-floored
   expense figure minus existing EMIs minus a mandatory savings carve-out,
   times a stability factor that depends on income type and emergency-fund
   depth).

5. **O1–O4** are each a thin transformation of the above, plus their own
   narrow judgement calls:
   - **O1** (`verdict.ts`) evaluates hard stops first (no surplus, a fresh
     bounce, over-extension past 60%, no lender would take this on) — if any
     fire, the verdict is `DONT_BORROW` regardless of how favourable anything
     else looks. Only after clearing every hard stop does it compare the safe
     amount to the ask and decide `BORROW` vs `BORROW_LESS`.
   - **O2** just packages the two amounts from stage 4 with a plain-English
     sentence about the gap between them.
   - **O3** (`pricing.ts`) runs a signed-adjustment scorecard from a product's
     market mid-rate, bounds it into a band using the confidence half-width,
     then feeds principal + band + real fees into a bisection-solved IRR to
     get an honest APR — the number that actually matters to the borrower.
   - **O4** (`stress.ts` + `engine.ts`) turns the safe EMI into a ceiling,
     tabulates the tenure/EMI/interest trade-off, and runs two to three stress
     scenarios (rate +2pp, income -20/-30%, a month with no income at all).

6. **The Negotiation Card** is assembled last, purely by reading fields off
   the finished `Assessment` — it adds no new judgement of its own, which is
   what keeps it trustworthy: everything on the card was already derived and
   explained upstream.

## The adaptive interview

`questions.ts` holds one flat array of `Question` objects, each tagged
`tier: 'must' | 'additional'` and (for additional questions) a `shouldAsk`
predicate over the answers so far, plus a `moves` array declaring which
outputs it can change. `relevantQuestions(answers)` filters that array live,
on every keystroke — there is no separate "salaried flow" and "self-employed
flow" to keep in sync; a self-employed borrower simply never satisfies the
`shouldAsk` predicate on employer-category questions, and does satisfy it on
ITR and banking-surrogate ones.

`App.tsx` re-derives `relevantQuestions` after every answer and walks the
resulting list, which is what makes the interview genuinely reactive: change
an early answer (say, purpose, from "wedding" to "growing my business") and
the *remaining* question set changes on the next render, without a page
reload or a manual branch in the component.

`answeredStats()` — answered count over relevant count — feeds directly into
`assessConfidence`, which is the mechanism behind "confidence widens with
silence": the width of every returned band is a function of that single ratio,
plus two targeted penalties (unknown credit score, unknown worst-month income
on variable earners) that widen further regardless of the overall ratio.

## Why routing runs before pricing, not after

An earlier version priced only the product the borrower named. That is wrong
for exactly the borrower the brief is testing for: Ravi asks for a business
loan, but the right answer is a loan against his unencumbered shop, at roughly
half the rate and several times the amount. Routing has to run first because
secured vs. unsecured changes almost everything downstream — the FOIR relief,
whether a co-applicant's income counts, how a missing credit score is priced,
even which fee schedule applies. Pricing every eligible candidate at a common
amount and ranking by coverage-then-cost is what lets the engine *notice* that
a better product exists and say so explicitly (`routingNote`), rather than
silently underserving the borrower.

## Testing strategy

`tests/engine.test.ts` asserts on domain behaviour, not implementation
details: that `DONT_BORROW` is actually reachable (not just theoretically
possible), that the lender number is always ≥ the safe number's ordering, that
APR is never below the nominal rate when fees are positive, that answering
fewer questions never narrows a band, that an unknown score prices better than
a known-bad one, and that every reason attached to every output carries real
text. These are exactly the properties the scoring rubric names, encoded as
tests rather than left as something to eyeball in a demo.

## What is explicitly out of scope

No backend, no persistence, no bureau integration, no ML model — all by the
brief's own "not scored" list. The engine is deterministic and explainable by
design, which is also why it can be defended live without an AI tool in the
follow-up interview: every number traces back through a `Reason[]` chain to a
named constant in one file.
