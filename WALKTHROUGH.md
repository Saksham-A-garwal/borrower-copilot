# Five-minute walkthrough

## What it does (60 seconds)

Open the app, pick "Try Ravi." In one screen: a routing note explaining he's
about to ask for the wrong product (unsecured business loan) when his
unencumbered shop qualifies him for a loan against property at roughly half
the rate and several times the amount; a verdict (`BORROW_LESS`, ₹14L not
₹15L, with the arithmetic shown); two separated amounts (lender ₹24.5L vs.
safe ₹14L); a fair rate band with the true all-in APR after fees; an EMI
ceiling with a tenure trade-off table and three stress tests; and a
Negotiation Card he could screenshot and hand to a loan officer. Same engine,
run "Try Anita" — she gets a hard `DONT_BORROW` (zero surplus, a bounce last
month) but also a concrete, time-boxed path back to yes, because a rejection
with no next step is not useful to someone who needs money.

## How it's built (60 seconds)

The whole decision layer (`src/rules/`) is dependency-free TypeScript with
zero React in it — one function, `assess(answers) -> Assessment`, consumed by
three different things: the UI, a 23-test Vitest suite, and two scripts that
render `RULES.md` and `RUNTHROUGHS.md` directly from the live constants, so
those documents cannot drift from what the code actually does. Every tunable
number — FOIR slabs, safe-EMI factors, rate scorecard adjustments, product
bands — lives in one file, `constants.ts`. Changing "FOIR from 55% to 45%" is
a one-line edit there; nothing in a component needs to change.

## What I'd build next, in order

1. **Real-time collateral valuation sanity check.** Right now Ravi's ₹45L shop
   valuation is trusted at face value. A cheap add would be a rough
   locality-based price-per-sqft sanity band (even a static lookup table by
   city tier) to flag a valuation that looks self-serving, and widen
   confidence when it does.
2. **A second self-employed income path: GST returns.** The banking-surrogate
   method is one legitimate underwriting path; GST turnover is another, and
   for a GST-registered borrower like Ravi it's usually a *better* one than
   raw bank credits, because it's third-party verified. I stubbed
   `gstRegistered` as a boolean; the natural next step is to actually let it
   raise the lender-income credit instead of just appearing on the negotiation
   card as a talking point.
3. **Multi-lender awareness.** Today the app prices "the market" as one band
   per product. The realistic next step is letting the borrower log two or
   three actual quotes they've collected (the `offerRatePct` field already
   exists for one) and showing them side by side against the fair band, so the
   Negotiation Card becomes "lender A is 40bp better than lender B, and both
   are inside fair" rather than a single comparison.
4. **Persisted, shareable results — without breaking "nothing stored."** A
   borrower who does this at home wants to bring the Negotiation Card to a
   branch on their phone. Right now that means keeping the tab open. A
   URL-encoded state (no backend, no bureau pull, still nothing stored on a
   server) would let them regenerate the exact same card from a link or QR
   code.
5. **A written glossary screen for FOIR, LTV, APR.** The app currently
   explains these terms inline once; a borrower coming in cold would benefit
   from a persistent one-tap glossary, especially since the target user is
   explicitly someone who has never negotiated a loan rate before.

## What I'd cut if the timebox were tighter

- **The full six-product catalogue.** Home loans and car loans are fully
  priced and tested but never actually exercised by any of the three brief
  personas. If I were optimizing purely for the four-day box, I would have
  shipped personal loan, LAP, gold loan and two-wheeler only (the four the
  personas actually need) and added the rest later — the brief explicitly
  says breadth of products isn't scored.
- **The tenure-options table beyond three rows.** Showing every tenure from
  12 to 240 months is more precision than a borrower negotiating a single
  number needs; three or four representative points would communicate the
  trade-off just as well with less to parse in a stressful branch-counter
  moment.
- **Client-side-only APR bisection precision.** 200 iterations of bisection
  per rate call is comfortably fast in a browser but is more precision than
  the confidence band it feeds ever uses (bands are quoted to 0.01%,
  bisection converges to far more decimal places than that). I'd drop it to
  ~40 iterations, which is plenty and marginally faster on a low-end phone.

## The one thing I'd defend hardest in the follow-up

The decision to run **product routing before income/affordability**, not
after. It's the reason Ravi doesn't get quietly underserved by a product he
guessed at, and it's the single most "aha" moment the app produces. It also
means every downstream number (FOIR relief, co-applicant credit, fee schedule)
has to be computed per-candidate-product before the ranking happens, which is
the main source of complexity in `products.ts`. I think that trade is
obviously correct given what the brief is testing for, but it's also the
piece I'd want someone to poke hardest at changing live.
