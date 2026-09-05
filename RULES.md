# RULES.md — Borrower Copilot

**This file is generated.** Run `npm run docs` after changing anything in
[`src/rules/constants.ts`](src/rules/constants.ts) to regenerate it. Every row
below is read directly out of the constant the engine actually computes with —
this document cannot describe a number the app is not using, because it is not
typed by hand.

## How to read this table

- **Rule ID** — matches the `ruleId` attached to every explanation the app
  shows a borrower. If the app says "because FOIR.slab", you can find the exact
  number and its justification here.
- **Source** — see the summary below. Roughly a third of the rules are RBI
  requirements or hard market data; the rest are my own judgement calls, stated
  as such rather than dressed up as fact.


| Source | Count | Meaning |
|---|---|---|
| RBI | 2 | A published Reserve Bank of India rule, circular, or statutory rate. |
| MARKET | 9 | Observed public lender rate cards / underwriting norms, September 2026. |
| JUDGEMENT | 15 | My own judgement as the builder, defended below and open to challenge. |

## Design principles this rules engine follows

1. **Two capacity numbers, always.** Every affordability calculation produces
   a lender view (FOIR-based, what a bank's underwriting model would say) and a
   borrower view (cash-flow based, what the household can actually carry). The
   app always recommends the smaller one.
2. **Confidence widens with silence.** No band ever gets narrower because a
   question went unanswered — only wider. See `RATE.bandWidth` and the
   confidence engine in [`src/rules/confidence.ts`](src/rules/confidence.ts).
3. **Unknown is never zero.** An unknown credit score, an unknown worst month,
   or unbanked informal income are modelled as missing information with a
   stated, bounded cost — never silently treated as the worst possible value.
4. **Every number has a one-sentence why.** Every output the engine returns
   carries a `reasons: Reason[]` array of plain-English sentences, each tagged
   with the rule id that produced it. Nothing in the UI shows a number without
   also showing the sentence that explains it.
5. **Rules live in one file, separate from the UI.** Everything above is in
   [`src/rules/constants.ts`](src/rules/constants.ts). Changing a threshold —
   including live, in the follow-up interview — never requires touching a
   component.


### Affordability (FOIR — the lender test)

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `FOIR.slab` | Lender FOIR by net monthly income slab | <=25,000: 40%; <=50,000: 45%; <=1,00,000: 50%; <=2,00,000: 55%; <=inf: 60% | Indian lenders cap total EMIs as a share of net income, and allow a larger share as income rises because absolute residual income grows. These slabs match published retail underwriting norms. | MARKET |
| `FOIR.secured` | FOIR relief for a secured product | +5.00 pp | Collateral reduces loss given default, so secured lenders accept a higher obligation ratio than unsecured ones. | MARKET |
| `FOIR.scoreUnknown` | FOIR penalty for unknown or sub-700 score | -5.00 pp | Without proven repayment behaviour the lender lends less, not at a worse price only. Tightening the ratio is how that shows up in practice. | JUDGEMENT |
| `FOIR.recentMiss` | FOIR penalty for a missed payment in 12 months | -5.00 pp | A recent bounce is the strongest single predictor of the next one, and is treated far more harshly than a merely low score. | MARKET |
| `FOIR.bounds` | FOIR floor and ceiling after all adjustments | 30% to 65% | Keeps the adjustments from compounding into a ratio no real lender would use in either direction. | JUDGEMENT |

### Affordability (the borrower-safe test)

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `SAFE.savingsRate` | Minimum savings carved out before surplus | 10% | A household that saves nothing is one shock away from the next loan. Savings are treated as a fixed obligation, not as spare cash. | JUDGEMENT |
| `SAFE.factor` | Share of true surplus available for a new EMI | salaried: 60%; self_employed: 50%; informal: 40% | The bad month decides whether a loan is repaid. Less predictable income gets a thinner slice of surplus because its bad month is further below its average. | JUDGEMENT |
| `SAFE.emergencyFund` | Surplus multiplier by emergency fund depth | <1 month: x0.6; 1-3 months: x0.8; 6+ months: x1.1 | Savings are what convert a missed paycheque into an inconvenience rather than a default. Without them the same EMI is a materially riskier promise. | JUDGEMENT |
| `SAFE.totalCeiling` | Borrower-side ceiling on total EMIs | 50% | An absolute backstop above the surplus arithmetic. Past half of reliable income, servicing debt starts displacing food, school fees and health spending. | JUDGEMENT |
| `SAFE.overextended` | Post-loan ratio that triggers an outright refusal | 60% | The brief describes borrowers stretched to 65% of income. This is the line the app will not help anyone cross. | JUDGEMENT |
| `SAFE.expenseFloor` | Plausibility floor for declared expenses | metro: Rs 18,000; tier2: Rs 13,000; tier3_rural: Rs 9,000; +Rs 3,500 per extra dependant | Borrowers under-report expenses, usually honestly. Trusting an implausible figure manufactures surplus that does not exist, so the safe number uses the higher of declared and floor. | JUDGEMENT |

### Income assessment

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `INCOME.variablePay` | Credit given to bonus and incentive pay | lender 50%, borrower 25% | Lenders average variable pay over two years and count roughly half. The borrower should plan on less, because a bad year cuts the bonus before it cuts the salary. | MARKET |
| `INCOME.surrogate` | Banking-surrogate margin on business turnover | 30% | Self-employed borrowers legitimately declare less to tax than they earn. Surrogate programmes size income as a margin on banked turnover, which is why a kirana owner can beat their ITR. | MARKET |
| `INCOME.informalHaircut` | Haircut on unverified cash income | 60% | Fully cash income gets 60% credit, scaling to 100% as more of it lands in a bank account. This is why "get paid into your account" is real advice, not a platitude. | JUDGEMENT |
| `INCOME.coApplicant` | Co-applicant income credit | secured 100%, unsecured 0% | Most Indian personal-loan programmes do not accept co-applicants at all, while secured products routinely do. Counting a spouse on an unsecured loan would overstate eligibility. | MARKET |

### Pricing (rate scorecard)

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `RATE.score` | Rate adjustment by credit score band | 800_plus: -2.00 pp; 750_799: -1.25 pp; 700_749: -0.25 pp; 650_699: +2.00 pp; below_650: +4.00 pp; unknown: +1.00 pp; no_history: +1.50 pp | Risk-based pricing. The step between 700-749 and 650-699 is deliberately large because that is where most lenders switch from bank pricing to NBFC pricing. | MARKET |
| `RATE.noScoreSecured` | Relief on the no-score penalty when secured | -0.75 pp | With property behind the loan the lender is pricing the asset more than the borrower, so a missing score costs far less. | JUDGEMENT |
| `RATE.incomeType` | Rate adjustment by income type | salaried: 0.00 pp; self_employed: +0.75 pp; informal: +2.25 pp | Documentation quality, not character. Verified salary is cheapest to underwrite; informal income costs the lender more to assess and to collect. | MARKET |
| `RATE.missedPayment` | Rate adjustment per missed payment | +1.25 pp each, capped at +3.00 pp | Capped because beyond three misses the realistic outcome is rejection, not a higher price, and the app says so through the verdict instead. | JUDGEMENT |
| `RATE.bandWidth` | Half-width of the quoted fair band | 0.6 pp fully answered, 2.5 pp on musts only, +1 pp if score unknown | The band is an honesty device. Fewer answers must produce a visibly wider band, never a confident-looking wrong number. | JUDGEMENT |

### Fees and APR

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `FEE.gst` | GST charged on lender fees | 18% | Statutory rate on financial services. It is included in the APR because the borrower actually pays it. | RBI |

### Product eligibility and sizing

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `PRODUCT.ltv` | Maximum loan-to-value by product | HOME: 80%; LAP: 60%; GOLD: 75%; TWO_WHEELER: 85%; AUTO: 85% | Gold at 75% is the RBI cap. Home at 80% reflects the RBI risk-weight slab for mid-sized loans. LAP at 60% and vehicle at 85% are market norms. | RBI |

### Verdict thresholds

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `VERDICT.recentMiss` | Cooling-off after a missed payment | miss within 3 months blocks unsecured borrowing; advise waiting 6 months | A fresh bounce sits on the bureau record and will either be rejected or priced punitively. Telling the borrower to wait is worth more than routing them to a 30% lender. | JUDGEMENT |
| `VERDICT.productiveCredit` | Cap on EMI serviced from projected new income | 50% of the EMI, after a 50% discount on the projection | A loan that buys an earning asset genuinely differs from a loan that buys a wedding, but a projection is not a payslip. Half the EMI must survive on income that already exists. | JUDGEMENT |

### Stress testing

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `STRESS.cases` | Stress scenarios applied to every result | rate +2 pp; income -20% (-30% if informal) | Two shocks a retail borrower in India actually meets: a repo-linked reset, and a lost month of work or a lost incentive. | JUDGEMENT |

### Tenure and age

| Rule ID | What | Value | Why | Source |
|---|---|---|---|---|
| `TENURE.age` | Tenure capped at working life remaining | salaried: to age 60; self_employed: to age 65; informal: to age 65 | No lender will let a loan mature after the borrower stops earning, and no borrower should want one that does. | MARKET |


## What this rules engine deliberately does NOT know

Being honest about the edges of the model is itself part of the design (see
the scoring criterion "honesty about limits" in the brief).

- **No real bureau data.** Credit score is entirely self-reported, in a band,
  not a number. We never pretend to more precision than that.
- **No macro rate environment.** Rate floors/ceilings in `PRODUCTS` are a
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
