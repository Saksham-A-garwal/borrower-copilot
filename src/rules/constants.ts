/**
 * EVERY tunable number in the product lives in this one file.
 *
 * This is deliberate. In the follow-up interview someone will say "change FOIR
 * from 55% to 45%" or "personal loan rates have moved". That must be a one-line
 * edit here, with no hunting through components. RULES.md is generated from
 * these live values (see scripts/generate-docs.ts), so the documentation can
 * never drift away from what the app actually computes.
 *
 * Sourcing convention used in the `source` field of RULE_DOCS below:
 *   RBI        - a published Reserve Bank of India rule or circular
 *   MARKET     - observed public rate cards / market practice, Sept 2026
 *   JUDGEMENT  - my own judgement, defended in RULES.md
 */

import type {
  CityTier,
  CreditScoreBand,
  EmployerCategory,
  IncomeType,
  LoanPurpose,
  ProductCode,
} from './types';

// ---------------------------------------------------------------------------
// 1. FOIR -- the lender's affordability test
// ---------------------------------------------------------------------------

/**
 * Fixed Obligation to Income Ratio: the share of net monthly income a lender
 * will let total EMIs occupy. Richer borrowers are allowed a higher ratio
 * because their absolute residual income is larger.
 */
export const FOIR_BY_INCOME_SLAB: { upTo: number; foirPct: number }[] = [
  { upTo: 25_000, foirPct: 40 },
  { upTo: 50_000, foirPct: 45 },
  { upTo: 100_000, foirPct: 50 },
  { upTo: 200_000, foirPct: 55 },
  { upTo: Infinity, foirPct: 60 },
];

export const FOIR_ADJUSTMENTS = {
  /** Secured lending is collateral-backed, so lenders tolerate a higher ratio. */
  securedProduct: +5,
  /** No score means no proven repayment behaviour: lenders tighten. */
  scoreUnknownOrLow: -5,
  /** A bounce in the last 12 months is the single strongest default predictor. */
  recentMissedPayment: -5,
  /** Informal income is unverified, so lenders discount the ratio too. */
  informalIncome: -5,
};

export const FOIR_FLOOR_PCT = 30;
export const FOIR_CEILING_PCT = 65;

// ---------------------------------------------------------------------------
// 2. The borrower-safe test -- deliberately NOT the lender's test
// ---------------------------------------------------------------------------

/** A household must keep saving something, so this is carved out before surplus. */
export const MIN_SAVINGS_RATE = 0.10;

/**
 * Share of true monthly surplus that may go to a new EMI. Less stable income
 * means a thinner slice, because the bad month is the one that matters.
 */
export const SAFE_EMI_FACTOR_BY_STABILITY: Record<IncomeType, number> = {
  salaried: 0.60,
  self_employed: 0.50,
  informal: 0.40,
};

/** Multipliers applied on top of the base factor. */
export const SAFE_EMI_MODIFIERS = {
  noEmergencyFund: 0.60, // under 1 month of expenses saved
  thinEmergencyFund: 0.80, // 1 to 3 months
  strongEmergencyFund: 1.10, // 6 months or more
  soleEarner: 0.90,
  largeExpenseComing: 0.85,
  jobUnderOneYear: 0.85,
};

export const SAFE_EMI_FACTOR_CEILING = 0.65;

/**
 * Hard ceiling on the borrower side: total EMIs must never exceed this share of
 * reliable household income, however good the surplus arithmetic looks.
 */
export const BORROWER_TOTAL_EMI_CEILING_PCT = 50;

/** Above this post-loan ratio the engine refuses outright. */
export const BORROWER_OVEREXTENDED_PCT = 60;

/**
 * Plausibility floor for declared household expenses, per month, before
 * dependants. Borrowers systematically under-report expenses; using an
 * implausible number would manufacture surplus that does not exist.
 */
export const EXPENSE_FLOOR_BY_CITY: Record<CityTier, number> = {
  metro: 18_000,
  tier2: 13_000,
  tier3_rural: 9_000,
};

/** Added to the floor for each dependant beyond the first two people. */
export const EXPENSE_FLOOR_PER_DEPENDENT = 3_500;

// ---------------------------------------------------------------------------
// 3. Income assessment -- lender view versus borrower view
// ---------------------------------------------------------------------------

export const INCOME_RULES = {
  /** Lenders count only part of bonus/incentive pay towards eligibility. */
  variablePayCreditLender: 0.50,
  /** The borrower should plan on even less of it. */
  variablePayCreditBorrower: 0.25,
  /**
   * Banking-surrogate programmes size a self-employed borrower's income as a
   * margin on business turnover rather than on declared profit.
   */
  bankingSurrogateMargin: 0.30,
  /** Unverified cash income is haircut before a lender will count it. */
  informalUnverifiedFloor: 0.60,
  /** Borrower-side haircut when the worst month is unknown. */
  borrowerCashHaircut: 0.85,
  /** Co-applicant income counts fully on secured products, not on unsecured. */
  coApplicantCreditSecured: 1.00,
  coApplicantCreditUnsecured: 0.00,
};

// ---------------------------------------------------------------------------
// 4. Products -- bands, tenures, LTV, fees
// ---------------------------------------------------------------------------

export interface ProductSpec {
  code: ProductCode;
  name: string;
  secured: boolean;
  rateFloor: number;
  rateMid: number;
  rateCeiling: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  defaultTenureMonths: number;
  maxLtvPct?: number;
  minTicket: number;
  maxTicket: number;
  processingFeePct: number;
  processingFeeMin: number;
  processingFeeMax: number;
  /** Extra flat charges: documentation, stamping, valuation. */
  otherChargesFlat: number;
}

/**
 * Rate bands are the market ranges an ordinary retail borrower actually sees in
 * India in September 2026, not the teaser rate on a billboard. They are wide on
 * purpose: the scorecard in pricing.ts moves the borrower inside the band.
 */
export const PRODUCTS: Record<ProductCode, ProductSpec> = {
  HOME: {
    code: 'HOME',
    name: 'Home loan',
    secured: true,
    rateFloor: 8.10,
    rateMid: 8.75,
    rateCeiling: 11.00,
    minTenureMonths: 60,
    maxTenureMonths: 360,
    defaultTenureMonths: 240,
    maxLtvPct: 80,
    minTicket: 300_000,
    maxTicket: 100_000_000,
    processingFeePct: 0.35,
    processingFeeMin: 3_000,
    processingFeeMax: 15_000,
    otherChargesFlat: 6_000,
  },
  LAP: {
    code: 'LAP',
    name: 'Loan against property',
    secured: true,
    rateFloor: 9.25,
    rateMid: 11.00,
    rateCeiling: 15.50,
    minTenureMonths: 60,
    maxTenureMonths: 180,
    defaultTenureMonths: 120,
    maxLtvPct: 60,
    minTicket: 300_000,
    maxTicket: 50_000_000,
    processingFeePct: 1.00,
    processingFeeMin: 5_000,
    processingFeeMax: 200_000,
    otherChargesFlat: 12_000,
  },
  PERSONAL: {
    code: 'PERSONAL',
    name: 'Personal loan',
    secured: false,
    rateFloor: 10.25,
    rateMid: 14.00,
    rateCeiling: 24.00,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    defaultTenureMonths: 60,
    minTicket: 50_000,
    maxTicket: 4_000_000,
    processingFeePct: 2.00,
    processingFeeMin: 1_500,
    processingFeeMax: 60_000,
    otherChargesFlat: 1_000,
  },
  BUSINESS_UNSEC: {
    code: 'BUSINESS_UNSEC',
    name: 'Unsecured business loan',
    secured: false,
    rateFloor: 14.00,
    rateMid: 18.00,
    rateCeiling: 26.00,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    defaultTenureMonths: 48,
    minTicket: 100_000,
    maxTicket: 5_000_000,
    processingFeePct: 2.50,
    processingFeeMin: 2_500,
    processingFeeMax: 100_000,
    otherChargesFlat: 2_000,
  },
  GOLD: {
    code: 'GOLD',
    name: 'Gold loan',
    secured: true,
    rateFloor: 8.75,
    rateMid: 12.00,
    rateCeiling: 20.00,
    minTenureMonths: 6,
    maxTenureMonths: 36,
    defaultTenureMonths: 24,
    maxLtvPct: 75,
    minTicket: 20_000,
    maxTicket: 2_000_000,
    processingFeePct: 0.50,
    processingFeeMin: 500,
    processingFeeMax: 10_000,
    otherChargesFlat: 500,
  },
  TWO_WHEELER: {
    code: 'TWO_WHEELER',
    name: 'Two-wheeler / EV loan',
    secured: true,
    rateFloor: 9.50,
    rateMid: 13.50,
    rateCeiling: 22.00,
    minTenureMonths: 12,
    maxTenureMonths: 48,
    defaultTenureMonths: 36,
    maxLtvPct: 85,
    minTicket: 25_000,
    maxTicket: 500_000,
    processingFeePct: 2.00,
    processingFeeMin: 1_000,
    processingFeeMax: 8_000,
    otherChargesFlat: 1_500,
  },
  AUTO: {
    code: 'AUTO',
    name: 'Car loan',
    secured: true,
    rateFloor: 8.75,
    rateMid: 10.50,
    rateCeiling: 15.00,
    minTenureMonths: 12,
    maxTenureMonths: 84,
    defaultTenureMonths: 60,
    maxLtvPct: 85,
    minTicket: 100_000,
    maxTicket: 10_000_000,
    processingFeePct: 1.00,
    processingFeeMin: 2_000,
    processingFeeMax: 25_000,
    otherChargesFlat: 2_000,
  },
};

/** RBI caps gold-loan LTV; the others are market practice. */
export const GST_ON_FEES_PCT = 18;

/**
 * Which products can serve which purpose, best-fit first. Routing then filters
 * this list by eligibility and prices what survives.
 */
export const PURPOSE_TO_PRODUCTS: Record<LoanPurpose, ProductCode[]> = {
  wedding: ['PERSONAL', 'GOLD', 'LAP'],
  medical: ['PERSONAL', 'GOLD', 'LAP'],
  education: ['PERSONAL', 'LAP', 'GOLD'],
  home_purchase: ['HOME', 'LAP'],
  home_renovation: ['LAP', 'PERSONAL', 'GOLD'],
  business_expansion: ['LAP', 'BUSINESS_UNSEC', 'GOLD'],
  working_capital: ['BUSINESS_UNSEC', 'LAP', 'GOLD'],
  vehicle_personal: ['AUTO', 'TWO_WHEELER', 'PERSONAL'],
  vehicle_productive: ['TWO_WHEELER', 'AUTO', 'BUSINESS_UNSEC', 'PERSONAL'],
  debt_consolidation: ['PERSONAL', 'LAP', 'GOLD'],
  other_consumption: ['PERSONAL', 'GOLD'],
};

/** Purposes where the borrowed money is expected to generate income. */
export const PRODUCTIVE_PURPOSES: LoanPurpose[] = [
  'business_expansion',
  'working_capital',
  'vehicle_productive',
  'education',
];

/** Purposes that buy nothing durable: the bar for these is higher. */
export const PURE_CONSUMPTION_PURPOSES: LoanPurpose[] = [
  'wedding',
  'other_consumption',
];

// ---------------------------------------------------------------------------
// 5. Pricing scorecard -- what moves a borrower inside the band
// ---------------------------------------------------------------------------

export const RATE_ADJ_CREDIT_SCORE: Record<CreditScoreBand, number> = {
  '800_plus': -2.00,
  '750_799': -1.25,
  '700_749': -0.25,
  '650_699': +2.00,
  below_650: +4.00,
  unknown: +1.00,
  no_history: +1.50,
};

/** A missing score matters far less when there is collateral behind the loan. */
export const RATE_ADJ_NO_SCORE_SECURED_RELIEF = -0.75;

export const RATE_ADJ_INCOME_TYPE: Record<IncomeType, number> = {
  salaried: 0,
  self_employed: +0.75,
  informal: +2.25,
};

export const RATE_ADJ_EMPLOYER: Record<EmployerCategory, number> = {
  govt_psu: -0.75,
  large_listed_mnc: -0.50,
  mid_size: 0,
  small_unlisted: +0.75,
  startup: +0.50,
};

export const RATE_ADJ_VINTAGE = {
  fiveYearsPlus: -0.40,
  threeToFive: -0.20,
  oneToThree: 0,
  underOneYear: +0.75,
};

export const RATE_ADJ_OTHER = {
  perMissedPayment: +1.25,
  missedPaymentCap: +3.00,
  existingRelationship: -0.25,
  smallTicketUnder2L: +0.75,
  largeTicketOver10L: -0.25,
  highPostLoanFoir: +0.50,
  lowLtvUnder50: -0.50,
  highLtvOver65: +0.50,
  highCardUtilisation: +0.50,
  carriesPredatoryDebt: +0.50,
};

export const HIGH_CARD_UTILISATION_PCT = 50;
export const PREDATORY_APR_PCT = 24;

// ---------------------------------------------------------------------------
// 6. Confidence -- how much the band widens when the borrower stays silent
// ---------------------------------------------------------------------------

export const RATE_BAND_HALF_WIDTH = {
  /** Half-width in percentage points when every relevant question is answered. */
  fullyAnswered: 0.60,
  /** Half-width when only the MUST block is answered. */
  mustsOnly: 2.50,
  /** Added when the credit score is unknown. */
  unknownScorePenalty: 1.00,
  /** Added when income is variable and the worst month was not given. */
  unknownWorstMonthPenalty: 0.50,
};

export const CONFIDENCE_THRESHOLDS = {
  high: 0.80,
  medium: 0.50,
};

/** Amount bands widen the same way rate bands do. */
export const AMOUNT_BAND_WIDTH_PCT = {
  fullyAnswered: 8,
  mustsOnly: 25,
};

// ---------------------------------------------------------------------------
// 7. Verdict thresholds
// ---------------------------------------------------------------------------

export const VERDICT_RULES = {
  /** A bounce this recent makes an unsecured application near-certain to fail. */
  recentMissMonths: 3,
  /** Months a borrower should wait after a miss before applying unsecured. */
  cooldownMonths: 6,
  /** Below this many months of expenses saved, consumption borrowing is refused. */
  minEmergencyMonthsForConsumption: 1,
  /** Asking for more than this multiple of the safe number is a red flag. */
  wildOverAskMultiple: 2.5,
  /** Borrow-less fires when the safe number is under this share of the ask. */
  borrowLessThresholdPct: 95,
};

/**
 * At most this share of a new EMI may be serviced out of income the borrower
 * does not yet have. Productive loans deserve credit for the income they
 * create, but never enough to carry the whole repayment on a projection.
 */
export const PRODUCTIVE_CREDIT_MAX_SHARE = 0.50;

/** Projected new income is discounted before it counts at all. */
export const PRODUCTIVE_INCOME_DISCOUNT = 0.50;

// ---------------------------------------------------------------------------
// 8. Age and tenure
// ---------------------------------------------------------------------------

export const RETIREMENT_AGE: Record<IncomeType, number> = {
  salaried: 60,
  self_employed: 65,
  informal: 65,
};

export const MIN_BORROWER_AGE = 21;
export const MAX_BORROWER_AGE_AT_MATURITY_BUFFER = 0;

// ---------------------------------------------------------------------------
// 9. Stress testing
// ---------------------------------------------------------------------------

export const STRESS_CASES = {
  rateRisePp: 2.00,
  incomeDropPct: 20,
  informalIncomeDropPct: 30,
};

// ---------------------------------------------------------------------------
// 10. Negotiation card tolerances
// ---------------------------------------------------------------------------

export const CARD_RULES = {
  /** How far above the fair band the borrower should still accept before walking. */
  acceptableAprPaddingPp: 0.50,
  /** Processing fee above this multiple of the market norm is worth contesting. */
  feeToleranceMultiple: 1.0,
};

// ---------------------------------------------------------------------------
// Documentation registry
// ---------------------------------------------------------------------------

export interface RuleDoc {
  id: string;
  what: string;
  value: string;
  why: string;
  source: 'RBI' | 'MARKET' | 'JUDGEMENT';
}

const pct = (n: number) => `${n}%`;
const pp = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} pp`;

/**
 * Rows are built from the live constants above, so RULES.md cannot describe a
 * number the engine is not actually using.
 */
export const RULE_DOCS: RuleDoc[] = [
  {
    id: 'FOIR.slab',
    what: 'Lender FOIR by net monthly income slab',
    value: FOIR_BY_INCOME_SLAB.map(
      (s) => `<=${s.upTo === Infinity ? 'inf' : s.upTo.toLocaleString('en-IN')}: ${s.foirPct}%`,
    ).join('; '),
    why: 'Indian lenders cap total EMIs as a share of net income, and allow a larger share as income rises because absolute residual income grows. These slabs match published retail underwriting norms.',
    source: 'MARKET',
  },
  {
    id: 'FOIR.secured',
    what: 'FOIR relief for a secured product',
    value: pp(FOIR_ADJUSTMENTS.securedProduct),
    why: 'Collateral reduces loss given default, so secured lenders accept a higher obligation ratio than unsecured ones.',
    source: 'MARKET',
  },
  {
    id: 'FOIR.scoreUnknown',
    what: 'FOIR penalty for unknown or sub-700 score',
    value: pp(FOIR_ADJUSTMENTS.scoreUnknownOrLow),
    why: 'Without proven repayment behaviour the lender lends less, not at a worse price only. Tightening the ratio is how that shows up in practice.',
    source: 'JUDGEMENT',
  },
  {
    id: 'FOIR.recentMiss',
    what: 'FOIR penalty for a missed payment in 12 months',
    value: pp(FOIR_ADJUSTMENTS.recentMissedPayment),
    why: 'A recent bounce is the strongest single predictor of the next one, and is treated far more harshly than a merely low score.',
    source: 'MARKET',
  },
  {
    id: 'FOIR.bounds',
    what: 'FOIR floor and ceiling after all adjustments',
    value: `${FOIR_FLOOR_PCT}% to ${FOIR_CEILING_PCT}%`,
    why: 'Keeps the adjustments from compounding into a ratio no real lender would use in either direction.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.savingsRate',
    what: 'Minimum savings carved out before surplus',
    value: pct(MIN_SAVINGS_RATE * 100),
    why: 'A household that saves nothing is one shock away from the next loan. Savings are treated as a fixed obligation, not as spare cash.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.factor',
    what: 'Share of true surplus available for a new EMI',
    value: Object.entries(SAFE_EMI_FACTOR_BY_STABILITY)
      .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
      .join('; '),
    why: 'The bad month decides whether a loan is repaid. Less predictable income gets a thinner slice of surplus because its bad month is further below its average.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.emergencyFund',
    what: 'Surplus multiplier by emergency fund depth',
    value: `<1 month: x${SAFE_EMI_MODIFIERS.noEmergencyFund}; 1-3 months: x${SAFE_EMI_MODIFIERS.thinEmergencyFund}; 6+ months: x${SAFE_EMI_MODIFIERS.strongEmergencyFund}`,
    why: 'Savings are what convert a missed paycheque into an inconvenience rather than a default. Without them the same EMI is a materially riskier promise.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.totalCeiling',
    what: 'Borrower-side ceiling on total EMIs',
    value: pct(BORROWER_TOTAL_EMI_CEILING_PCT),
    why: 'An absolute backstop above the surplus arithmetic. Past half of reliable income, servicing debt starts displacing food, school fees and health spending.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.overextended',
    what: 'Post-loan ratio that triggers an outright refusal',
    value: pct(BORROWER_OVEREXTENDED_PCT),
    why: 'The brief describes borrowers stretched to 65% of income. This is the line the app will not help anyone cross.',
    source: 'JUDGEMENT',
  },
  {
    id: 'SAFE.expenseFloor',
    what: 'Plausibility floor for declared expenses',
    value: Object.entries(EXPENSE_FLOOR_BY_CITY)
      .map(([k, v]) => `${k}: Rs ${v.toLocaleString('en-IN')}`)
      .join('; ') + `; +Rs ${EXPENSE_FLOOR_PER_DEPENDENT.toLocaleString('en-IN')} per extra dependant`,
    why: 'Borrowers under-report expenses, usually honestly. Trusting an implausible figure manufactures surplus that does not exist, so the safe number uses the higher of declared and floor.',
    source: 'JUDGEMENT',
  },
  {
    id: 'INCOME.variablePay',
    what: 'Credit given to bonus and incentive pay',
    value: `lender ${(INCOME_RULES.variablePayCreditLender * 100).toFixed(0)}%, borrower ${(INCOME_RULES.variablePayCreditBorrower * 100).toFixed(0)}%`,
    why: 'Lenders average variable pay over two years and count roughly half. The borrower should plan on less, because a bad year cuts the bonus before it cuts the salary.',
    source: 'MARKET',
  },
  {
    id: 'INCOME.surrogate',
    what: 'Banking-surrogate margin on business turnover',
    value: pct(INCOME_RULES.bankingSurrogateMargin * 100),
    why: 'Self-employed borrowers legitimately declare less to tax than they earn. Surrogate programmes size income as a margin on banked turnover, which is why a kirana owner can beat their ITR.',
    source: 'MARKET',
  },
  {
    id: 'INCOME.informalHaircut',
    what: 'Haircut on unverified cash income',
    value: pct(INCOME_RULES.informalUnverifiedFloor * 100),
    why: 'Fully cash income gets 60% credit, scaling to 100% as more of it lands in a bank account. This is why "get paid into your account" is real advice, not a platitude.',
    source: 'JUDGEMENT',
  },
  {
    id: 'INCOME.coApplicant',
    what: 'Co-applicant income credit',
    value: `secured ${(INCOME_RULES.coApplicantCreditSecured * 100).toFixed(0)}%, unsecured ${(INCOME_RULES.coApplicantCreditUnsecured * 100).toFixed(0)}%`,
    why: 'Most Indian personal-loan programmes do not accept co-applicants at all, while secured products routinely do. Counting a spouse on an unsecured loan would overstate eligibility.',
    source: 'MARKET',
  },
  {
    id: 'RATE.score',
    what: 'Rate adjustment by credit score band',
    value: Object.entries(RATE_ADJ_CREDIT_SCORE)
      .map(([k, v]) => `${k}: ${pp(v)}`)
      .join('; '),
    why: 'Risk-based pricing. The step between 700-749 and 650-699 is deliberately large because that is where most lenders switch from bank pricing to NBFC pricing.',
    source: 'MARKET',
  },
  {
    id: 'RATE.noScoreSecured',
    what: 'Relief on the no-score penalty when secured',
    value: pp(RATE_ADJ_NO_SCORE_SECURED_RELIEF),
    why: 'With property behind the loan the lender is pricing the asset more than the borrower, so a missing score costs far less.',
    source: 'JUDGEMENT',
  },
  {
    id: 'RATE.incomeType',
    what: 'Rate adjustment by income type',
    value: Object.entries(RATE_ADJ_INCOME_TYPE)
      .map(([k, v]) => `${k}: ${pp(v)}`)
      .join('; '),
    why: 'Documentation quality, not character. Verified salary is cheapest to underwrite; informal income costs the lender more to assess and to collect.',
    source: 'MARKET',
  },
  {
    id: 'RATE.missedPayment',
    what: 'Rate adjustment per missed payment',
    value: `${pp(RATE_ADJ_OTHER.perMissedPayment)} each, capped at ${pp(RATE_ADJ_OTHER.missedPaymentCap)}`,
    why: 'Capped because beyond three misses the realistic outcome is rejection, not a higher price, and the app says so through the verdict instead.',
    source: 'JUDGEMENT',
  },
  {
    id: 'RATE.bandWidth',
    what: 'Half-width of the quoted fair band',
    value: `${RATE_BAND_HALF_WIDTH.fullyAnswered} pp fully answered, ${RATE_BAND_HALF_WIDTH.mustsOnly} pp on musts only, +${RATE_BAND_HALF_WIDTH.unknownScorePenalty} pp if score unknown`,
    why: 'The band is an honesty device. Fewer answers must produce a visibly wider band, never a confident-looking wrong number.',
    source: 'JUDGEMENT',
  },
  {
    id: 'FEE.gst',
    what: 'GST charged on lender fees',
    value: pct(GST_ON_FEES_PCT),
    why: 'Statutory rate on financial services. It is included in the APR because the borrower actually pays it.',
    source: 'RBI',
  },
  {
    id: 'PRODUCT.ltv',
    what: 'Maximum loan-to-value by product',
    value: Object.values(PRODUCTS)
      .filter((p) => p.maxLtvPct)
      .map((p) => `${p.code}: ${p.maxLtvPct}%`)
      .join('; '),
    why: 'Gold at 75% is the RBI cap. Home at 80% reflects the RBI risk-weight slab for mid-sized loans. LAP at 60% and vehicle at 85% are market norms.',
    source: 'RBI',
  },
  {
    id: 'VERDICT.recentMiss',
    what: 'Cooling-off after a missed payment',
    value: `miss within ${VERDICT_RULES.recentMissMonths} months blocks unsecured borrowing; advise waiting ${VERDICT_RULES.cooldownMonths} months`,
    why: 'A fresh bounce sits on the bureau record and will either be rejected or priced punitively. Telling the borrower to wait is worth more than routing them to a 30% lender.',
    source: 'JUDGEMENT',
  },
  {
    id: 'VERDICT.productiveCredit',
    what: 'Cap on EMI serviced from projected new income',
    value: `${(PRODUCTIVE_CREDIT_MAX_SHARE * 100).toFixed(0)}% of the EMI, after a ${(PRODUCTIVE_INCOME_DISCOUNT * 100).toFixed(0)}% discount on the projection`,
    why: 'A loan that buys an earning asset genuinely differs from a loan that buys a wedding, but a projection is not a payslip. Half the EMI must survive on income that already exists.',
    source: 'JUDGEMENT',
  },
  {
    id: 'STRESS.cases',
    what: 'Stress scenarios applied to every result',
    value: `rate +${STRESS_CASES.rateRisePp} pp; income -${STRESS_CASES.incomeDropPct}% (-${STRESS_CASES.informalIncomeDropPct}% if informal)`,
    why: 'Two shocks a retail borrower in India actually meets: a repo-linked reset, and a lost month of work or a lost incentive.',
    source: 'JUDGEMENT',
  },
  {
    id: 'TENURE.age',
    what: 'Tenure capped at working life remaining',
    value: Object.entries(RETIREMENT_AGE)
      .map(([k, v]) => `${k}: to age ${v}`)
      .join('; '),
    why: 'No lender will let a loan mature after the borrower stops earning, and no borrower should want one that does.',
    source: 'MARKET',
  },
];
