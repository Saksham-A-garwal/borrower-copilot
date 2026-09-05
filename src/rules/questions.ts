/**
 * The question bank.
 *
 * Two tiers, exactly as the brief demands:
 *
 *   MUST       - 10 questions. Answer only these and the app still produces all
 *                four outputs, with wide bands and low stated confidence.
 *   ADDITIONAL - shown only when relevant, and every one of them declares in
 *                `moves` which output it changes. A question that cannot name
 *                an output it moves does not belong in this file.
 *
 * `shouldAsk` is what makes the interview adaptive: a salaried engineer is
 * never asked what their ITR shows, and a kirana owner is never asked which
 * company employs them.
 */

import { PRODUCTIVE_PURPOSES } from './constants';
import type { Answers, AnswerKey } from './types';

export type QuestionKind = 'number' | 'money' | 'choice' | 'boolean';

export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  key: AnswerKey;
  tier: 'must' | 'additional';
  label: string;
  help?: string;
  kind: QuestionKind;
  choices?: Choice[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Which outputs this question moves. Required for every additional question. */
  moves: ('O1' | 'O2' | 'O3' | 'O4')[];
  /** One sentence for the UI: what answering this actually buys the borrower. */
  payoff?: string;
  /** Adaptive gate. Absent means always ask. */
  shouldAsk?: (a: Answers) => boolean;
  /**
   * Additional questions are skippable by default. A few are not: once the
   * borrower has opened a subject, the follow-up is decision-critical and
   * skipping it would let silence buy a better answer than any honest reply.
   */
  requiredOnceAsked?: boolean;
  /** Allow "I don't know" -- which is never treated as zero. */
  allowUnknown?: boolean;
}

const isProductive = (a: Answers) => (a.purpose ? PRODUCTIVE_PURPOSES.includes(a.purpose) : false);
const hasCollateral = (a: Answers) =>
  a.collateralType !== undefined && a.collateralType !== 'none';

export const QUESTIONS: Question[] = [
  // =========================================================================
  // MUST -- the minimum to produce all four outputs
  // =========================================================================
  {
    key: 'purpose',
    tier: 'must',
    label: 'What is the loan for?',
    help: 'This decides which products you should even be looking at.',
    kind: 'choice',
    moves: ['O1', 'O2', 'O3', 'O4'],
    choices: [
      { value: 'wedding', label: 'Wedding' },
      { value: 'medical', label: 'Medical treatment' },
      { value: 'education', label: 'Education' },
      { value: 'home_purchase', label: 'Buying a home' },
      { value: 'home_renovation', label: 'Home renovation' },
      { value: 'business_expansion', label: 'Growing my business' },
      { value: 'working_capital', label: 'Business working capital' },
      { value: 'vehicle_productive', label: 'A vehicle I will earn with' },
      { value: 'vehicle_personal', label: 'A vehicle for personal use' },
      { value: 'debt_consolidation', label: 'Paying off costlier loans' },
      { value: 'other_consumption', label: 'Something else' },
    ],
  },
  {
    key: 'amountWanted',
    tier: 'must',
    label: 'How much do you want to borrow?',
    kind: 'money',
    moves: ['O1', 'O2', 'O3', 'O4'],
    min: 10_000,
    max: 50_000_000,
    placeholder: '8,00,000',
  },
  {
    key: 'netMonthlyIncome',
    tier: 'must',
    label: 'What do you take home in a typical month?',
    help: 'After tax and deductions. If it varies, give a typical month; we ask about bad months later.',
    kind: 'money',
    moves: ['O1', 'O2', 'O3', 'O4'],
    min: 0,
    placeholder: '1,10,000',
  },
  {
    key: 'incomeType',
    tier: 'must',
    label: 'How do you earn it?',
    help: 'This changes how a lender verifies your income, which changes everything downstream.',
    kind: 'choice',
    moves: ['O1', 'O2', 'O3', 'O4'],
    choices: [
      { value: 'salaried', label: 'Salaried', hint: 'Payslips, salary credited to a bank' },
      { value: 'self_employed', label: 'Self-employed / business', hint: 'I file an ITR' },
      { value: 'informal', label: 'Informal / gig / daily', hint: 'Mostly cash, no fixed payslip' },
    ],
  },
  {
    key: 'existingEmiTotal',
    tier: 'must',
    label: 'What do you already pay in EMIs each month?',
    help: 'Every loan added together. Enter 0 if none.',
    kind: 'money',
    moves: ['O1', 'O2', 'O4'],
    min: 0,
    placeholder: '14,000',
  },
  {
    key: 'householdMonthlyExpenses',
    tier: 'must',
    label: 'What does your household spend each month?',
    help: 'Rent, food, school fees, fuel, bills. Do not include EMIs.',
    kind: 'money',
    moves: ['O1', 'O2', 'O4'],
    min: 0,
    placeholder: '45,000',
  },
  {
    key: 'age',
    tier: 'must',
    label: 'How old are you?',
    help: 'Tenure cannot run past your working life, and tenure decides the EMI.',
    kind: 'number',
    moves: ['O2', 'O4'],
    min: 18,
    max: 75,
  },
  {
    key: 'creditScoreBand',
    tier: 'must',
    label: 'Do you know your credit score?',
    help: 'It is fine not to know. We will not pretend it is zero.',
    kind: 'choice',
    moves: ['O2', 'O3'],
    choices: [
      { value: '800_plus', label: '800 or above' },
      { value: '750_799', label: '750 to 799' },
      { value: '700_749', label: '700 to 749' },
      { value: '650_699', label: '650 to 699' },
      { value: 'below_650', label: 'Below 650' },
      { value: 'unknown', label: 'I have loans but do not know my score' },
      { value: 'no_history', label: 'I have never taken a formal loan' },
    ],
  },
  {
    key: 'cityTier',
    tier: 'must',
    label: 'Where do you live?',
    help: 'Cost of living differs enough to change what is left over each month.',
    kind: 'choice',
    moves: ['O1', 'O2'],
    choices: [
      { value: 'metro', label: 'A metro', hint: 'Mumbai, Delhi NCR, Bengaluru, Chennai, Hyderabad, Kolkata, Pune' },
      { value: 'tier2', label: 'A smaller city', hint: 'Mysuru, Hubballi, Indore, Kochi' },
      { value: 'tier3_rural', label: 'A town or village' },
    ],
  },
  {
    key: 'collateralType',
    tier: 'must',
    label: 'Do you own property or gold you could pledge?',
    help: 'This is often the single biggest lever on your rate. Owning it does not mean you must pledge it.',
    kind: 'choice',
    moves: ['O1', 'O2', 'O3'],
    choices: [
      { value: 'none', label: 'No, nothing to pledge' },
      { value: 'residential_property', label: 'A house or flat' },
      { value: 'commercial_property', label: 'A shop or commercial premises' },
      { value: 'gold', label: 'Gold' },
    ],
  },

  // =========================================================================
  // ADDITIONAL -- collateral detail
  // =========================================================================
  {
    key: 'collateralValue',
    tier: 'additional',
    label: 'Roughly what is it worth today?',
    kind: 'money',
    moves: ['O2', 'O3'],
    payoff: 'Sets how much a secured lender can advance, which is usually far more than an unsecured one.',
    shouldAsk: hasCollateral,
    placeholder: '45,00,000',
  },
  {
    key: 'collateralExistingLoan',
    tier: 'additional',
    label: 'Is there already a loan against it?',
    help: 'Enter 0 if it is fully yours.',
    kind: 'money',
    moves: ['O2'],
    payoff: 'Only the unencumbered part of the asset can support a new loan.',
    shouldAsk: hasCollateral,
  },

  // =========================================================================
  // ADDITIONAL -- salaried path
  // =========================================================================
  {
    key: 'employerCategory',
    tier: 'additional',
    label: 'What kind of employer?',
    kind: 'choice',
    moves: ['O3'],
    payoff: 'Moves your rate by up to 1.5 percentage points. Lenders price a PSU differently from a small firm.',
    shouldAsk: (a) => a.incomeType === 'salaried',
    choices: [
      { value: 'govt_psu', label: 'Government or PSU' },
      { value: 'large_listed_mnc', label: 'Large listed company or MNC' },
      { value: 'mid_size', label: 'Mid-sized company' },
      { value: 'small_unlisted', label: 'Small or unlisted firm' },
      { value: 'startup', label: 'Startup' },
    ],
  },
  {
    key: 'yearsAtCurrentEmployer',
    tier: 'additional',
    label: 'How long have you been with this employer?',
    kind: 'number',
    moves: ['O2', 'O3'],
    payoff: 'Under a year cuts both your rate tier and your safe amount; five years improves both.',
    shouldAsk: (a) => a.incomeType === 'salaried',
    min: 0,
    max: 50,
  },
  {
    key: 'variableIncomeSharePct',
    tier: 'additional',
    label: 'How much of your pay is bonus or incentive?',
    help: 'As a percentage of take-home. Enter 0 if it is all fixed.',
    kind: 'number',
    moves: ['O2', 'O4'],
    payoff: 'Variable pay is counted at half by a lender and a quarter by us, so this directly moves both amounts.',
    shouldAsk: (a) => a.incomeType === 'salaried',
    min: 0,
    max: 100,
  },
  {
    key: 'salaryAccountWithLender',
    tier: 'additional',
    label: 'Is your salary credited to the bank you will approach?',
    kind: 'boolean',
    moves: ['O3'],
    payoff: 'An existing salary relationship is worth roughly a quarter point off the rate.',
    shouldAsk: (a) => a.incomeType === 'salaried',
  },

  // =========================================================================
  // ADDITIONAL -- self-employed path
  // =========================================================================
  {
    key: 'yearsInBusiness',
    tier: 'additional',
    label: 'How long have you run this business?',
    kind: 'number',
    moves: ['O2', 'O3'],
    payoff: 'Business vintage is what substitutes for a payslip. Five years or more improves your rate.',
    shouldAsk: (a) => a.incomeType === 'self_employed',
    min: 0,
    max: 60,
  },
  {
    key: 'itrAnnualIncome',
    tier: 'additional',
    label: 'What annual income does your ITR show?',
    help: 'The figure you declare to tax, which is often lower than what you actually earn.',
    kind: 'money',
    moves: ['O1', 'O2'],
    payoff: 'This is the only income an unsecured lender can see. It usually explains why the unsecured offer looks small.',
    shouldAsk: (a) => a.incomeType === 'self_employed',
    placeholder: '4,20,000',
  },
  {
    key: 'avgMonthlyBankCredits',
    tier: 'additional',
    label: 'Average money coming into your business account each month?',
    help: 'Total credits, not profit. Include UPI.',
    kind: 'money',
    moves: ['O2', 'O3'],
    payoff: 'Secured lenders can size your income from turnover instead of your ITR, which usually raises the amount substantially.',
    shouldAsk: (a) => a.incomeType === 'self_employed',
  },
  {
    key: 'gstRegistered',
    tier: 'additional',
    label: 'Are you GST registered?',
    kind: 'boolean',
    moves: ['O2', 'O3'],
    payoff: 'GST filings are verifiable turnover, which widens the set of lenders willing to look at you.',
    shouldAsk: (a) => a.incomeType === 'self_employed',
  },

  // =========================================================================
  // ADDITIONAL -- variable and informal income
  // =========================================================================
  {
    key: 'worstMonthIncome',
    tier: 'additional',
    label: 'What did you earn in your worst month last year?',
    help: 'Not the average. The month that hurt.',
    kind: 'money',
    moves: ['O1', 'O2', 'O4'],
    payoff: 'The bad month is what decides whether an EMI is actually payable, so this sets your safe amount directly.',
    shouldAsk: (a) => a.incomeType === 'self_employed' || a.incomeType === 'informal',
  },
  {
    key: 'bankedIncomeSharePct',
    tier: 'additional',
    label: 'What share of your income reaches a bank account?',
    help: 'As a percentage. UPI into your account counts.',
    kind: 'number',
    moves: ['O2', 'O3'],
    payoff: 'Banked income is verifiable income. Raising this share is the fastest way to raise what a lender will offer you.',
    shouldAsk: (a) => a.incomeType === 'informal',
    min: 0,
    max: 100,
  },
  {
    key: 'earningMembersInHousehold',
    tier: 'additional',
    label: 'How many people in your household earn?',
    kind: 'number',
    moves: ['O1', 'O2'],
    payoff: 'A single-earner household absorbs a shock far worse, so we cut the safe amount for it.',
    shouldAsk: (a) => a.incomeType === 'informal' || a.incomeType === 'self_employed',
    min: 0,
    max: 10,
  },

  // =========================================================================
  // ADDITIONAL -- universal risk and cushion
  // =========================================================================
  {
    key: 'emergencySavingsMonths',
    tier: 'additional',
    label: 'How many months could you cover with your savings if income stopped?',
    kind: 'number',
    moves: ['O1', 'O2', 'O4'],
    payoff: 'Savings are what turn a missed paycheque into an inconvenience. This can move your safe amount by 40% either way.',
    min: 0,
    max: 60,
  },
  {
    key: 'missedPaymentsLast12m',
    tier: 'additional',
    label: 'Have you missed or bounced any EMI in the last 12 months?',
    help: 'How many. Enter 0 if none.',
    kind: 'number',
    moves: ['O1', 'O2', 'O3'],
    payoff: 'The single strongest thing a lender reacts to. It moves your rate, your eligibility, and possibly the verdict.',
    min: 0,
    max: 24,
  },
  {
    key: 'monthsSinceLastMiss',
    tier: 'additional',
    label: 'How long ago was the most recent one?',
    help: 'In months.',
    kind: 'number',
    moves: ['O1'],
    payoff: 'A bounce last month and a bounce ten months ago are completely different applications.',
    shouldAsk: (a) => (a.missedPaymentsLast12m ?? 0) > 0,
    requiredOnceAsked: true,
    min: 0,
    max: 24,
  },
  {
    key: 'highestExistingApr',
    tier: 'additional',
    label: 'What is the highest interest rate you currently pay?',
    help: 'On any existing loan, as a percentage per year. App loans are often above 30%.',
    kind: 'number',
    moves: ['O1', 'O3'],
    payoff: 'If you already carry very costly debt, clearing it usually beats taking a new loan.',
    shouldAsk: (a) => (a.existingEmiTotal ?? 0) > 0,
    min: 0,
    max: 100,
  },
  {
    key: 'existingLoanCount',
    tier: 'additional',
    label: 'How many loans do you currently have?',
    kind: 'number',
    moves: ['O1', 'O3'],
    payoff: 'Many small live loans reads as stress to a lender, whatever the amounts are.',
    shouldAsk: (a) => (a.existingEmiTotal ?? 0) > 0,
    min: 0,
    max: 20,
  },
  {
    key: 'creditCardUtilisationPct',
    tier: 'additional',
    label: 'How much of your credit card limit are you using?',
    help: 'As a percentage. Skip if you have no card.',
    kind: 'number',
    moves: ['O3'],
    payoff: 'Above 50% utilisation lenders price you higher even when your score is good.',
    shouldAsk: (a) => a.creditScoreBand !== 'no_history',
    min: 0,
    max: 100,
  },
  {
    key: 'coApplicantIncome',
    tier: 'additional',
    label: 'Does anyone else in your household earn?',
    help: 'Their monthly income. Enter 0 if not.',
    kind: 'money',
    moves: ['O1', 'O2'],
    payoff: 'On a secured loan a co-applicant counts fully towards eligibility; on an unsecured one it still raises what your household can carry.',
  },
  {
    key: 'dependents',
    tier: 'additional',
    label: 'How many people depend on your income?',
    kind: 'number',
    moves: ['O1', 'O2'],
    payoff: 'Sets the floor we use for household expenses, which protects your safe number from being overstated.',
    min: 0,
    max: 15,
  },
  {
    key: 'largeExpenseNext12m',
    tier: 'additional',
    label: 'Any large expense coming in the next year?',
    help: 'School admission, a wedding, a medical procedure. Enter 0 if none.',
    kind: 'money',
    moves: ['O1', 'O2', 'O4'],
    payoff: 'A known lump sum ahead reduces how much monthly commitment you should take on now.',
  },
  {
    key: 'preferredTenureMonths',
    tier: 'additional',
    label: 'Over how many months would you like to repay?',
    help: 'Longer means a smaller EMI but more total interest. We will show you both.',
    kind: 'number',
    moves: ['O4'],
    payoff: 'Lets us centre the EMI ceiling on the tenure you actually want.',
    min: 6,
    max: 360,
  },

  // =========================================================================
  // ADDITIONAL -- productive loans
  // =========================================================================
  {
    key: 'expectedAdditionalMonthlyIncome',
    tier: 'additional',
    label: 'How much extra will you earn each month because of this?',
    help: 'Your honest estimate of additional revenue.',
    kind: 'money',
    moves: ['O1', 'O2'],
    payoff: 'A loan that earns is genuinely different from one that spends. We count half of the net gain towards what you can carry.',
    shouldAsk: isProductive,
  },
  {
    key: 'expectedAdditionalMonthlyCost',
    tier: 'additional',
    label: 'And how much extra will it cost you to run each month?',
    help: 'Fuel or charging, maintenance, extra stock, wages.',
    kind: 'money',
    moves: ['O1', 'O2'],
    payoff: 'Only the net gain counts. Gross revenue with the costs left out is how people talk themselves into bad loans.',
    shouldAsk: isProductive,
  },

  // =========================================================================
  // ADDITIONAL -- an offer already in hand
  // =========================================================================
  {
    key: 'offerRatePct',
    tier: 'additional',
    label: 'Has a lender already quoted you a rate?',
    help: 'Percentage per year. Skip if not.',
    kind: 'number',
    moves: ['O3'],
    payoff: 'We will convert their quote into a true all-in cost and tell you what it is worth over the full tenure.',
    min: 0,
    max: 60,
  },
  {
    key: 'offerProcessingFeePct',
    tier: 'additional',
    label: 'And what processing fee did they quote?',
    help: 'As a percentage of the loan.',
    kind: 'number',
    moves: ['O3'],
    payoff: 'The fee is where a "low rate" quietly becomes an expensive loan.',
    shouldAsk: (a) => (a.offerRatePct ?? 0) > 0,
    min: 0,
    max: 10,
  },
];

export const MUST_QUESTIONS = QUESTIONS.filter((q) => q.tier === 'must');

/** The additional questions that apply to this particular borrower. */
export function relevantAdditional(a: Answers): Question[] {
  return QUESTIONS.filter((q) => q.tier === 'additional' && (!q.shouldAsk || q.shouldAsk(a)));
}

/** Every question this borrower should see, in order. */
export function relevantQuestions(a: Answers): Question[] {
  return [...MUST_QUESTIONS, ...relevantAdditional(a)];
}

export function isAnswered(a: Answers, key: AnswerKey): boolean {
  const v = a[key];
  return v !== undefined && v !== null && v !== ('' as unknown);
}

/** How complete this interview is, used to widen or narrow every band. */
export function answeredStats(a: Answers): {
  answered: number;
  relevant: number;
  share: number;
} {
  const qs = relevantQuestions(a);
  const answered = qs.filter((q) => isAnswered(a, q.key)).length;
  return {
    answered,
    relevant: qs.length,
    share: qs.length === 0 ? 0 : answered / qs.length,
  };
}
