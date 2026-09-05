/**
 * The three borrowers from the brief, encoded exactly as the app would have
 * collected them through the interview.
 *
 * `answeredKeys` records what the borrower actually told us, so the run-through
 * document can show which questions were asked and which were skipped. Nothing
 * here is hand-tuned to produce a flattering result.
 */

import type { Answers } from '../rules/types';

export interface Persona {
  id: string;
  name: string;
  headline: string;
  storyFromBrief: string;
  /**
   * Where the brief left a number out and I had to supply one. These drive the
   * results materially, so they are stated in RUNTHROUGHS.md rather than
   * buried here -- if Lokta's own expected range differs, this is where the
   * difference will come from, and it should be arguable rather than hidden.
   */
  encodingAssumptions?: string[];
  answers: Answers;
  /** Questions the adaptive flow would not have shown this borrower. */
  notAskedNote: string;
}

export const PRIYA: Persona = {
  id: 'priya',
  name: 'Priya, 29',
  headline: 'Bengaluru · salaried',
  storyFromBrief:
    'Software engineer at a large MNC for 5 years. Net ₹1,10,000/month. One car loan, EMI ₹14,000, 2 years left. Credit score 780. Rents at ₹28,000. Wants ₹8,00,000 personal loan for a wedding.',
  answers: {
    // MUST
    purpose: 'wedding',
    amountWanted: 800_000,
    netMonthlyIncome: 110_000,
    incomeType: 'salaried',
    existingEmiTotal: 14_000,
    // Rent 28,000 plus ordinary living costs for a metro professional.
    householdMonthlyExpenses: 52_000,
    age: 29,
    creditScoreBand: '750_799',
    cityTier: 'metro',
    collateralType: 'none',
    // ADDITIONAL
    employerCategory: 'large_listed_mnc',
    yearsAtCurrentEmployer: 5,
    variableIncomeSharePct: 15,
    salaryAccountWithLender: true,
    emergencySavingsMonths: 4,
    missedPaymentsLast12m: 0,
    creditCardUtilisationPct: 20,
    coApplicantIncome: 0,
    dependents: 0,
    largeExpenseNext12m: 0,
    highestExistingApr: 9.5,
    existingLoanCount: 1,
    preferredTenureMonths: 60,
    offerRatePct: 14.0,
    offerProcessingFeePct: 2.0,
  },
  encodingAssumptions: [
    'The brief gives Priya ₹28,000 of rent but no other living costs. I encoded total household expenses as ₹52,000, i.e. rent plus ₹24,000 for a single professional in Bengaluru. This is the single biggest driver of her result: at ₹35,000 total she clears her full ₹8,00,000 ask, and at ₹52,000 she does not.',
    'Her ₹1,10,000 is treated as 15% variable pay, which a lender counts at half and this app counts at a quarter. The brief does not say her pay is variable; this is a conservative reading of an MNC engineering salary.',
  ],
  notAskedNote:
    'Never asked about ITR, bank credits, GST, worst month, or banked income share: none of those apply to a salaried borrower.',
};

export const RAVI: Persona = {
  id: 'ravi',
  name: 'Ravi, 42',
  headline: 'Mysuru · self-employed',
  storyFromBrief:
    'Kirana store for 14 years. Cash income ₹40,000–80,000/month; ITR shows ₹4,20,000/year. Owns the shop premises, about ₹45,00,000, unencumbered. Never taken a formal loan; no credit score. Wife earns ₹18,000 teaching. Wants ₹15,00,000 for a second stock line and a delivery vehicle.',
  answers: {
    // MUST
    purpose: 'business_expansion',
    amountWanted: 1_500_000,
    // Midpoint of the 40k-80k range he would give as "a typical month".
    netMonthlyIncome: 60_000,
    incomeType: 'self_employed',
    existingEmiTotal: 0,
    householdMonthlyExpenses: 30_000,
    age: 42,
    creditScoreBand: 'no_history',
    cityTier: 'tier2',
    collateralType: 'commercial_property',
    // ADDITIONAL
    collateralValue: 4_500_000,
    collateralExistingLoan: 0,
    yearsInBusiness: 14,
    itrAnnualIncome: 420_000,
    // Kirana turnover consistent with the stated cash income.
    avgMonthlyBankCredits: 260_000,
    gstRegistered: true,
    worstMonthIncome: 40_000,
    earningMembersInHousehold: 2,
    emergencySavingsMonths: 5,
    missedPaymentsLast12m: 0,
    coApplicantIncome: 18_000,
    dependents: 3,
    largeExpenseNext12m: 0,
    preferredTenureMonths: 120,
    expectedAdditionalMonthlyIncome: 35_000,
    expectedAdditionalMonthlyCost: 14_000,
  },
  encodingAssumptions: [
    'The brief gives a ₹40,000–80,000 cash range. I encoded ₹60,000 as his "typical month" and ₹40,000 as his worst month — the worst month is what drives the safe number, so the bottom of his own stated range is used, not the midpoint.',
    'Monthly bank credits of ₹2,60,000 are my estimate of kirana turnover consistent with that cash income. The brief does not state turnover, and this figure is what lets a secured lender size him off banking surrogate rather than his ₹4,20,000 ITR.',
    'Household expenses of ₹30,000 and the ₹35,000/₹14,000 productive income and cost estimates for the second stock line are mine; the brief gives none of them.',
  ],
  notAskedNote:
    'Never asked about employer category, years at employer, or variable pay share: none of those apply to a business owner. Credit-card utilisation was skipped because he has no credit history.',
};

export const ANITA: Persona = {
  id: 'anita',
  name: 'Anita, 35',
  headline: 'Hubballi · informal',
  storyFromBrief:
    'Delivery-platform rider plus home tailoring. ₹26,000–30,000/month, two children, husband unemployed 8 months. Three app loans, ₹35,000 outstanding at 30%+, one EMI bounced last month. Wants ₹1,50,000 for an electric scooter to double delivery runs.',
  answers: {
    // MUST
    purpose: 'vehicle_productive',
    amountWanted: 150_000,
    netMonthlyIncome: 28_000,
    incomeType: 'informal',
    // Three app loans of ~35,000 outstanding amortising fast at 30%+.
    existingEmiTotal: 4_500,
    householdMonthlyExpenses: 18_000,
    age: 35,
    creditScoreBand: 'below_650',
    cityTier: 'tier2',
    collateralType: 'none',
    // ADDITIONAL
    worstMonthIncome: 22_000,
    bankedIncomeSharePct: 60,
    earningMembersInHousehold: 1,
    emergencySavingsMonths: 0,
    missedPaymentsLast12m: 1,
    monthsSinceLastMiss: 1,
    highestExistingApr: 32,
    existingLoanCount: 3,
    coApplicantIncome: 0,
    dependents: 3,
    soleEarner: true,
    largeExpenseNext12m: 0,
    expectedAdditionalMonthlyIncome: 9_000,
    expectedAdditionalMonthlyCost: 2_000,
    preferredTenureMonths: 36,
  },
  encodingAssumptions: [
    'The brief gives ₹35,000 outstanding across three app loans at 30%+ but no EMI figure. I encoded ₹4,500/month, consistent with short-tenure app loans amortising fast at that rate.',
    'Household expenses of ₹18,000 are mine; the brief gives none. Note the engine then overrides this upward to its ₹20,000 plausibility floor for a tier-2 household with three dependants, which is what tips her surplus negative.',
    'The ₹9,000 extra income and ₹2,000 extra running cost from the e-scooter are my estimates of doubled delivery runs, not figures from the brief.',
  ],
  notAskedNote:
    'Never asked about ITR, GST or employer: neither applies to platform and piece-rate work. Credit-card utilisation was skipped because she has no card.',
};

export const PERSONAS: Persona[] = [PRIYA, RAVI, ANITA];

/** A borrower who answered only the MUST block, to demonstrate widened bands. */
export const PRIYA_MUSTS_ONLY: Persona = {
  ...PRIYA,
  id: 'priya-musts-only',
  name: 'Priya, answering only the must-questions',
  storyFromBrief: 'The same borrower, but she stopped after the 10 required questions.',
  answers: {
    purpose: PRIYA.answers.purpose,
    amountWanted: PRIYA.answers.amountWanted,
    netMonthlyIncome: PRIYA.answers.netMonthlyIncome,
    incomeType: PRIYA.answers.incomeType,
    existingEmiTotal: PRIYA.answers.existingEmiTotal,
    householdMonthlyExpenses: PRIYA.answers.householdMonthlyExpenses,
    age: PRIYA.answers.age,
    creditScoreBand: PRIYA.answers.creditScoreBand,
    cityTier: PRIYA.answers.cityTier,
    collateralType: PRIYA.answers.collateralType,
  },
  notAskedNote: 'Answered the must-block only.',
};
