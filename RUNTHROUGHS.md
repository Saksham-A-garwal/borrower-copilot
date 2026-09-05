# RUNTHROUGHS.md — Priya, Ravi, Anita

Generated from the live engine by `npm run docs`. These are not hand-typed
numbers: they are the actual output of `assess()` given each persona's
answers exactly as recorded in [`src/personas/index.ts`](src/personas/index.ts).

## Priya, 29 — Bengaluru · salaried

**As given in the brief:** Software engineer at a large MNC for 5 years. Net ₹1,10,000/month. One car loan, EMI ₹14,000, 2 years left. Credit score 780. Rents at ₹28,000. Wants ₹8,00,000 personal loan for a wedding.

**Where I had to fill in a number the brief did not give.** These drive the
result materially, so if your expected range differs from mine, this is almost
certainly where the difference comes from:

- The brief gives Priya ₹28,000 of rent but no other living costs. I encoded total household expenses as ₹52,000, i.e. rent plus ₹24,000 for a single professional in Bengaluru. This is the single biggest driver of her result: at ₹35,000 total she clears her full ₹8,00,000 ask, and at ₹52,000 she does not.
- Her ₹1,10,000 is treated as 15% variable pay, which a lender counts at half and this app counts at a quarter. The brief does not say her pay is variable; this is a conservative reading of an MNC engineering salary.


### Questions the adaptive interview actually asked

10 of 10 must-questions answered, plus 15 additional questions relevant to this profile (15 applied in total, 0 left unanswered).

| Tier | Question | Answer |
|---|---|---|
| **Must** | What is the loan for? | wedding |
| **Must** | How much do you want to borrow? | 800000 |
| **Must** | What do you take home in a typical month? | 110000 |
| **Must** | How do you earn it? | salaried |
| **Must** | What do you already pay in EMIs each month? | 14000 |
| **Must** | What does your household spend each month? | 52000 |
| **Must** | How old are you? | 29 |
| **Must** | Do you know your credit score? | 750_799 |
| **Must** | Where do you live? | metro |
| **Must** | Do you own property or gold you could pledge? | none |
| Additional | What kind of employer? | large_listed_mnc |
| Additional | How long have you been with this employer? | 5 |
| Additional | How much of your pay is bonus or incentive? | 15 |
| Additional | Is your salary credited to the bank you will approach? | Yes |
| Additional | How many months could you cover with your savings if income stopped? | 4 |
| Additional | Have you missed or bounced any EMI in the last 12 months? | 0 |
| Additional | What is the highest interest rate you currently pay? | 9.5 |
| Additional | How many loans do you currently have? | 1 |
| Additional | How much of your credit card limit are you using? | 20 |
| Additional | Does anyone else in your household earn? | 0 |
| Additional | How many people depend on your income? | 0 |
| Additional | Any large expense coming in the next year? | 0 |
| Additional | Over how many months would you like to repay? | 60 |
| Additional | Has a lender already quoted you a rate? | 14 |
| Additional | And what processing fee did they quote? | 2 |

*Every relevant question was answered for this borrower.*

Never asked about ITR, bank credits, GST, worst month, or banked income share: none of those apply to a salaried borrower.

### Routing

Routed to: **Personal loan** (unsecured).

Confidence: **high** (25/25 relevant questions answered).

### The four outputs

#### O1 — BORROW LESS

**Borrow ₹5.80 L, not ₹8 L.**


> You asked for ₹8 L. On your own cash flow, ₹5.80 L is what you can carry without the loan running your household. The gap is closeable: a longer tenure or a smaller ask gets you there.



#### O2 — How much

| | Amount |
|---|---|
| A lender will likely sanction | ₹19 L |
| Borrower can safely carry (**use this**) | ₹5.80 L |

> A lender will likely sanction up to ₹19 L because its test only looks at income against EMIs. Your own cash flow supports ₹5.80 L. The gap of ₹13.20 L is not free money: it is the amount the lender is willing to let you struggle with. Use the smaller number.

#### O3 — Fair rate

Fair band: **11.00% – 12.20%**
All-in APR (with fees): **12.12% – 13.34%**

Fee breakdown on the recommended amount:
- Processing fee (2%): ₹11,600
- GST on the fee (18%): ₹2,088
- Documentation, stamping and valuation: ₹1,000

> You were quoted 14%, which is above the 12.20% top of your fair band. Its true all-in cost is 15.16%, and over the full tenure you would pay about ₹32,107 more than a fair offer. That is far enough above fair that you should walk and try two more lenders.

#### O4 — EMI ceiling

Ceiling: **₹13,000/month**. Recommended EMI at the amount above: **₹12,785/month** over 60 months.

Stress cases:
- ✅ **If your rate rises by 2 points** — At 13.60% your EMI becomes ₹13,376, up ₹591 a month. Your surplus still covers it with ₹8,487 to spare.
- ✅ **If your income drops 20%** — Income of ₹78,100 against ₹26,785 of total EMIs is 34% of what you earn. Tight, but still inside the half-of-income line.
- ✅ **If income stops for a month** — You would need ₹78,785 to cover that month. Your savings of about ₹2,08,000 cover it.


### Negotiation Card

```
PERSONAL LOAN — 29, salaried, metro
------------------------------------------------------------
Ask:              ₹8 L  ·  60 months
Recommended:      ₹5.80 L
Fair rate:        11.0% – 12.2%
Max all-in APR:   13.84%
Max EMI:          ₹13,000
Max processing fee: ₹11,600 + GST

WHY
  - Credit score in the 750-799 band.
  - 5 years with the same employer on ₹1,10,000 a month.
  - After this loan my total EMIs are 27% of my income.

WALK AWAY IF
  - All-in APR above 13.84%.
  - A monthly EMI above ₹13,000.
  - A processing fee above ₹11,600 plus GST.
  - Any prepayment or foreclosure penalty on a floating-rate loan.
  - Insurance or a membership bundled into the loan that I did not ask for.
```

---

## Ravi, 42 — Mysuru · self-employed

**As given in the brief:** Kirana store for 14 years. Cash income ₹40,000–80,000/month; ITR shows ₹4,20,000/year. Owns the shop premises, about ₹45,00,000, unencumbered. Never taken a formal loan; no credit score. Wife earns ₹18,000 teaching. Wants ₹15,00,000 for a second stock line and a delivery vehicle.

**Where I had to fill in a number the brief did not give.** These drive the
result materially, so if your expected range differs from mine, this is almost
certainly where the difference comes from:

- The brief gives a ₹40,000–80,000 cash range. I encoded ₹60,000 as his "typical month" and ₹40,000 as his worst month — the worst month is what drives the safe number, so the bottom of his own stated range is used, not the midpoint.
- Monthly bank credits of ₹2,60,000 are my estimate of kirana turnover consistent with that cash income. The brief does not state turnover, and this figure is what lets a secured lender size him off banking surrogate rather than his ₹4,20,000 ITR.
- Household expenses of ₹30,000 and the ₹35,000/₹14,000 productive income and cost estimates for the second stock line are mine; the brief gives none of them.


### Questions the adaptive interview actually asked

10 of 10 must-questions answered, plus 16 additional questions relevant to this profile (17 applied in total, 1 left unanswered).

| Tier | Question | Answer |
|---|---|---|
| **Must** | What is the loan for? | business_expansion |
| **Must** | How much do you want to borrow? | 1500000 |
| **Must** | What do you take home in a typical month? | 60000 |
| **Must** | How do you earn it? | self_employed |
| **Must** | What do you already pay in EMIs each month? | 0 |
| **Must** | What does your household spend each month? | 30000 |
| **Must** | How old are you? | 42 |
| **Must** | Do you know your credit score? | no_history |
| **Must** | Where do you live? | tier2 |
| **Must** | Do you own property or gold you could pledge? | commercial_property |
| Additional | Roughly what is it worth today? | 4500000 |
| Additional | Is there already a loan against it? | 0 |
| Additional | How long have you run this business? | 14 |
| Additional | What annual income does your ITR show? | 420000 |
| Additional | Average money coming into your business account each month? | 260000 |
| Additional | Are you GST registered? | Yes |
| Additional | What did you earn in your worst month last year? | 40000 |
| Additional | How many people in your household earn? | 2 |
| Additional | How many months could you cover with your savings if income stopped? | 5 |
| Additional | Have you missed or bounced any EMI in the last 12 months? | 0 |
| Additional | Does anyone else in your household earn? | 18000 |
| Additional | How many people depend on your income? | 3 |
| Additional | Any large expense coming in the next year? | 0 |
| Additional | Over how many months would you like to repay? | 120 |
| Additional | How much extra will you earn each month because of this? | 35000 |
| Additional | And how much extra will it cost you to run each month? | 14000 |

*Skipped, and therefore widening the bands below:* Has a lender already quoted you a rate?.

Never asked about employer category, years at employer, or variable pay share: none of those apply to a business owner. Credit-card utilisation was skipped because he has no credit history.

### Routing

Routed to: **Loan against property** (secured).

> You probably came in expecting an unsecured business loan. That would get you about ₹5,30,000 at roughly 19.9%. Because you own an asset you can pledge, a loan against property gets you about ₹14,00,000 at roughly 11.6%, which is 8.3 points cheaper. This is the single most valuable thing this app can tell you.

Confidence: **medium** (26/27 relevant questions answered).

### The four outputs

#### O1 — BORROW LESS

**Borrow ₹14 L, not ₹15 L.**


> You asked for ₹15 L. On your own cash flow, ₹14 L is what you can carry without the loan running your household. The gap is closeable: a longer tenure or a smaller ask gets you there.

> Because this loan is meant to earn, a smaller first loan repaid cleanly is usually the fastest route to a bigger second one at a better rate.

**Path to yes** (~1 months, unlocks ~₹15.30 L):

1. **Check your credit score free on the CIBIL, Experian or CRIF site.** — Costs nothing and takes ten minutes. Right now every number in this app is wider than it needs to be purely because we do not know it.


#### O2 — How much

| | Amount |
|---|---|
| A lender will likely sanction | ₹24.50 L |
| Borrower can safely carry (**use this**) | ₹14 L |

> A lender will likely sanction up to ₹24.50 L because its test only looks at income against EMIs. Your own cash flow supports ₹14 L. The gap of ₹10.50 L is not free money: it is the amount the lender is willing to let you struggle with. Use the smaller number.

#### O3 — Fair rate

Fair band: **9.93% – 13.27%**
All-in APR (with fees): **10.42% – 13.80%**

Fee breakdown on the recommended amount:
- Processing fee (1%): ₹14,000
- GST on the fee (18%): ₹2,520
- Documentation, stamping and valuation: ₹12,000

*No prior lender quote was given for this run-through.*

#### O4 — EMI ceiling

Ceiling: **₹21,500/month**. Recommended EMI at the amount above: **₹19,764/month** over 120 months.

Stress cases:
- ✅ **If your rate rises by 2 points** — At 13.60% your EMI becomes ₹21,402, up ₹1,638 a month. Your surplus still covers it with ₹798 to spare.
- ✅ **If your income drops 30%** — Income of ₹40,600 against ₹19,764 of total EMIs is 49% of what you earn. Tight, but still inside the half-of-income line.
- ✅ **If income stops for a month** — You would need ₹49,764 to cover that month. Your savings of about ₹1,50,000 cover it.


### Negotiation Card

```
LOAN AGAINST PROPERTY — 42, self-employed, tier-2 city
------------------------------------------------------------
Ask:              ₹15 L  ·  120 months
Recommended:      ₹14 L
Fair rate:        9.9% – 13.3%
Max all-in APR:   14.30%
Max EMI:          ₹21,500
Max processing fee: ₹14,000 + GST

WHY
  - No credit score on file, which is why this band is wide rather than high.
  - 14 years running the same business.
  - Secured against an asset worth ₹45 L, so the loan-to-value is only 31%.
  - After this loan my total EMIs are 34% of my income.

WALK AWAY IF
  - All-in APR above 14.30%.
  - A monthly EMI above ₹21,500.
  - A processing fee above ₹14,000 plus GST.
  - Any prepayment or foreclosure penalty on a floating-rate loan.
  - Insurance or a membership bundled into the loan that I did not ask for.
```

---

## Anita, 35 — Hubballi · informal

**As given in the brief:** Delivery-platform rider plus home tailoring. ₹26,000–30,000/month, two children, husband unemployed 8 months. Three app loans, ₹35,000 outstanding at 30%+, one EMI bounced last month. Wants ₹1,50,000 for an electric scooter to double delivery runs.

**Where I had to fill in a number the brief did not give.** These drive the
result materially, so if your expected range differs from mine, this is almost
certainly where the difference comes from:

- The brief gives ₹35,000 outstanding across three app loans at 30%+ but no EMI figure. I encoded ₹4,500/month, consistent with short-tenure app loans amortising fast at that rate.
- Household expenses of ₹18,000 are mine; the brief gives none. Note the engine then overrides this upward to its ₹20,000 plausibility floor for a tier-2 household with three dependants, which is what tips her surplus negative.
- The ₹9,000 extra income and ₹2,000 extra running cost from the e-scooter are my estimates of doubled delivery runs, not figures from the brief.


### Questions the adaptive interview actually asked

10 of 10 must-questions answered, plus 14 additional questions relevant to this profile (16 applied in total, 2 left unanswered).

| Tier | Question | Answer |
|---|---|---|
| **Must** | What is the loan for? | vehicle_productive |
| **Must** | How much do you want to borrow? | 150000 |
| **Must** | What do you take home in a typical month? | 28000 |
| **Must** | How do you earn it? | informal |
| **Must** | What do you already pay in EMIs each month? | 4500 |
| **Must** | What does your household spend each month? | 18000 |
| **Must** | How old are you? | 35 |
| **Must** | Do you know your credit score? | below_650 |
| **Must** | Where do you live? | tier2 |
| **Must** | Do you own property or gold you could pledge? | none |
| Additional | What did you earn in your worst month last year? | 22000 |
| Additional | What share of your income reaches a bank account? | 60 |
| Additional | How many people in your household earn? | 1 |
| Additional | How many months could you cover with your savings if income stopped? | 0 |
| Additional | Have you missed or bounced any EMI in the last 12 months? | 1 |
| Additional | How long ago was the most recent one? | 1 |
| Additional | What is the highest interest rate you currently pay? | 32 |
| Additional | How many loans do you currently have? | 3 |
| Additional | Does anyone else in your household earn? | 0 |
| Additional | How many people depend on your income? | 3 |
| Additional | Any large expense coming in the next year? | 0 |
| Additional | Over how many months would you like to repay? | 36 |
| Additional | How much extra will you earn each month because of this? | 9000 |
| Additional | And how much extra will it cost you to run each month? | 2000 |

*Skipped, and therefore widening the bands below:* How much of your credit card limit are you using?; Has a lender already quoted you a rate?.

Never asked about ITR, GST or employer: neither applies to platform and piece-rate work. Credit-card utilisation was skipped because she has no card.

### Routing

Routed to: **Two-wheeler / EV loan** (secured).

Confidence: **high** (24/26 relevant questions answered).

### The four outputs

#### O1 — DONT BORROW

**Not this loan, and not right now.**

> 🛑 After ₹20,000 of living costs and ₹4,500 of existing EMIs, your household has ₹0 left over. There is no room for another EMI at any size, and a lender who offers you one is not doing you a favour.
> You are already paying 32% on an existing loan. Clearing that debt returns you 32% a year risk-free, which almost certainly beats whatever this new loan buys you. Deal with it first.

**Path to yes** (~6 months, unlocks ~₹1.19 L):

1. **Pay every instalment on time for the next 5 months.** — Moves the bounce far enough back on your record that lenders stop treating you as a current default risk. This alone is worth several percentage points on your rate.
2. **Clear the loan you are paying 32% on, smallest balance first.** — Frees up part of the ₹4,500 you pay every month, and every rupee freed is a rupee of new EMI capacity. It also removes the strongest negative signal a lender sees.
3. **Take as much of your income as you can into your bank account, by UPI or transfer.** — Lenders can only count income they can see. Going from 60% to 70% banked raises the income a lender credits you with by roughly 4%, with no change to what you actually earn.
4. **Build one month of expenses in savings before taking on a new EMI.** — About ₹20,000 set aside. It is what turns a bad month into an inconvenience instead of the reason you take the next loan.


#### O2 — How much

| | Amount |
|---|---|
| A lender will likely sanction | ₹65,000 |
| Borrower can safely carry (**use this**) | ₹0 |

> A lender will likely sanction up to ₹65,000 because its test only looks at income against EMIs. Your own cash flow supports ₹0. The gap of ₹65,000 is not free money: it is the amount the lender is willing to let you struggle with. Use the smaller number.

#### O3 — Fair rate

Fair band: **20.75% – 22.00%**
All-in APR (with fees): **23.28% – 24.54%**

Fee breakdown on the recommended amount:
- Processing fee (2%): ₹3,000
- GST on the fee (18%): ₹540
- Documentation, stamping and valuation: ₹1,500

*No prior lender quote was given for this run-through.*

#### O4 — EMI ceiling

Ceiling: **₹0/month**. Recommended EMI at the amount above: **₹0/month** over 36 months.

Stress cases:
- ⚠️ **The loan you asked for, before any shock** — ₹1,50,000 over 36 months at 21.50% is an EMI of ₹5,690. Your surplus after living costs and existing EMIs is ₹-4,700. That is the gap this loan would have to be paid out of, and it is why the answer above is no.
- ⚠️ **If your rate rises by 2 points** — At 23.50% your EMI becomes ₹5,846, up ₹156 a month. That is ₹10,546 more than your surplus can absorb. Ask for a fixed rate, or borrow less.
- ⚠️ **If your income drops 30%** — Income of ₹15,400 against ₹10,190 of total EMIs is 66% of what you earn. That is past the 50% line where EMIs start displacing essentials.
- ⚠️ **If income stops for a month** — You would need ₹30,190 to cover that month. Your savings of about ₹0 do not cover it, so the EMI would be missed.


### Negotiation Card

```
TWO-WHEELER / EV LOAN — 35, informal, tier-2 city
------------------------------------------------------------
NOT READY TO NEGOTIATE YET

Your safe amount is currently ₹0, so there is nothing to negotiate yet. See "Your path to yes" above for what changes that.
```

---

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
