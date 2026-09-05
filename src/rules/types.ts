/**
 * Domain types for the Borrower Copilot rules engine.
 *
 * Everything in src/rules is pure TypeScript: zero dependencies, zero React.
 * It is imported by the UI, by the tests, and by the documentation generator.
 * Nothing in here knows that a screen exists.
 */

// ---------------------------------------------------------------------------
// Answers: what the borrower tells us
// ---------------------------------------------------------------------------

export type IncomeType = 'salaried' | 'self_employed' | 'informal';

export type LoanPurpose =
  | 'wedding'
  | 'medical'
  | 'education'
  | 'home_purchase'
  | 'home_renovation'
  | 'business_expansion'
  | 'working_capital'
  | 'vehicle_personal'
  | 'vehicle_productive'
  | 'debt_consolidation'
  | 'other_consumption';

export type ProductCode =
  | 'HOME'
  | 'LAP'
  | 'PERSONAL'
  | 'BUSINESS_UNSEC'
  | 'GOLD'
  | 'TWO_WHEELER'
  | 'AUTO';

export type CreditScoreBand =
  | 'unknown' // has a credit history but does not know the score
  | 'no_history' // never borrowed formally, so no score exists
  | 'below_650'
  | '650_699'
  | '700_749'
  | '750_799'
  | '800_plus';

export type EmployerCategory =
  | 'govt_psu'
  | 'large_listed_mnc'
  | 'mid_size'
  | 'small_unlisted'
  | 'startup';

export type CityTier = 'metro' | 'tier2' | 'tier3_rural';

export type CollateralType = 'residential_property' | 'commercial_property' | 'gold' | 'none';

export type Confidence = 'low' | 'medium' | 'high';

/**
 * Every field outside the MUST block is optional. The engine must produce all
 * four outputs from the MUST block alone -- just with wider bands and lower
 * stated confidence.
 */
export interface Answers {
  // ---- MUST (M1-M10) ----
  // Note: the brief's "loan type" must-question is deliberately not a
  // separate field. Asking a borrower to name a loan type they may not know
  // exists (LAP vs personal vs gold) is worse than inferring it: `purpose`
  // plus `collateralType` drive product routing in products.ts instead.
  purpose?: LoanPurpose;
  amountWanted?: number; // rupees
  netMonthlyIncome?: number; // take-home in a typical month, rupees
  incomeType?: IncomeType;
  existingEmiTotal?: number; // rupees per month across all current loans
  householdMonthlyExpenses?: number; // rupees, includes rent, excludes EMIs
  age?: number;
  creditScoreBand?: CreditScoreBand;
  cityTier?: CityTier;

  // ---- ADDITIONAL: universal ----
  emergencySavingsMonths?: number;
  missedPaymentsLast12m?: number;
  monthsSinceLastMiss?: number;
  coApplicantIncome?: number;
  dependents?: number;
  soleEarner?: boolean;
  largeExpenseNext12m?: number;
  preferredTenureMonths?: number;
  creditCardUtilisationPct?: number;
  highestExistingApr?: number;
  existingLoanCount?: number;
  offerRatePct?: number;
  offerProcessingFeePct?: number;

  // ---- ADDITIONAL: collateral ----
  collateralType?: CollateralType;
  collateralValue?: number;
  collateralExistingLoan?: number;

  // ---- ADDITIONAL: salaried ----
  employerCategory?: EmployerCategory;
  yearsAtCurrentEmployer?: number;
  totalWorkExperienceYears?: number;
  variableIncomeSharePct?: number;
  salaryAccountWithLender?: boolean;

  // ---- ADDITIONAL: self-employed ----
  yearsInBusiness?: number;
  itrAnnualIncome?: number;
  avgMonthlyBankCredits?: number;
  gstRegistered?: boolean;
  worstMonthIncome?: number;

  // ---- ADDITIONAL: informal ----
  bankedIncomeSharePct?: number;
  earningMembersInHousehold?: number;

  // ---- ADDITIONAL: productive loans ----
  expectedAdditionalMonthlyIncome?: number;
  expectedAdditionalMonthlyCost?: number;
}

export type AnswerKey = keyof Answers;

// ---------------------------------------------------------------------------
// Traceability: every number carries the sentence that explains it
// ---------------------------------------------------------------------------

/** One human-readable sentence justifying a number, tagged with the rule id. */
export interface Reason {
  ruleId: string;
  text: string;
}

/** Something the engine had to guess because the borrower did not tell us. */
export interface Assumption {
  ruleId: string;
  text: string;
  wouldNarrowIfAnswered?: AnswerKey;
}

export interface Band {
  low: number;
  high: number;
}

// ---------------------------------------------------------------------------
// Intermediate facts
// ---------------------------------------------------------------------------

export interface IncomeAssessment {
  /** What a lender credits the borrower with after its verification rules. */
  lenderMonthly: number;
  /** What the borrower can actually rely on every month, worst case. */
  borrowerMonthly: number;
  /** Borrower-safe income plus co-applicant, set against household expenses. */
  householdMonthly: number;
  reasons: Reason[];
  assumptions: Assumption[];
}

export interface AffordabilityAssessment {
  foirPct: number;
  lenderMaxEmi: number;
  safeMaxEmi: number;
  surplus: number;
  expensesUsed: number;
  productiveIncomeCredit: number;
  reasons: Reason[];
  assumptions: Assumption[];
}

export interface RateAssessment {
  point: number; // best single estimate, % p.a.
  band: Band; // fair range the borrower should expect
  aprBand: Band; // all-in cost including fees, % p.a.
  processingFeePct: number;
  processingFeeRupees: number;
  gstOnFee: number;
  reasons: Reason[];
  assumptions: Assumption[];
}

export interface StressCase {
  label: string;
  detail: string;
  survives: boolean;
}

export interface ProductOption {
  code: ProductCode;
  name: string;
  secured: boolean;
  eligible: boolean;
  ineligibleReason?: string;
  lenderMaxAmount: number;
  safeMaxAmount: number;
  tenureMonths: number;
  rate: RateAssessment;
  emiAtRecommended: number;
}

// ---------------------------------------------------------------------------
// The four outputs
// ---------------------------------------------------------------------------

export type Verdict = 'BORROW' | 'BORROW_LESS' | 'DONT_BORROW';

export interface O1Verdict {
  verdict: Verdict;
  headline: string;
  reasons: Reason[];
  hardStops: Reason[];
}

export interface O2Amount {
  lenderWillLikelySanction: number;
  borrowerCanSafelyCarry: number;
  useThisNumber: number;
  whichOne: 'lender' | 'borrower';
  reasons: Reason[];
}

export interface O3Rate {
  fairBand: Band;
  allInAprBand: Band;
  feeBreakdown: { label: string; amount: number }[];
  quoteComparison?: {
    quotedRate: number;
    quotedApr: number;
    verdict: 'fair' | 'high' | 'very_high';
    extraCostOverTenure: number;
  };
  reasons: Reason[];
}

export interface O4Emi {
  ceilingEmi: number;
  recommendedEmi: number;
  tenureOptions: {
    months: number;
    emi: number;
    totalInterest: number;
    withinCeiling: boolean;
  }[];
  stressCases: StressCase[];
  reasons: Reason[];
}

export interface PathToYesStep {
  action: string;
  effect: string;
}

export interface PathToYes {
  steps: PathToYesStep[];
  timelineMonths: number;
  unlocksAmount: number;
}

export interface NegotiationCard {
  /**
   * False when there is nothing to negotiate yet -- safe capacity is zero.
   * The UI should show the reason and point at pathToYes instead of a card
   * full of zeroes, which would read as a bug rather than as "don't borrow".
   */
  readyToNegotiate: boolean;
  notReadyReason?: string;
  borrowerLabel: string;
  productName: string;
  askAmount: number;
  recommendedAmount: number;
  tenureMonths: number;
  fairRateBand: Band;
  maxAprAccepted: number;
  maxEmi: number;
  maxProcessingFee: number;
  becauseLines: string[];
  walkAwayIf: string[];
}

export interface Assessment {
  product: ProductOption;
  alternatives: ProductOption[];
  income: IncomeAssessment;
  affordability: AffordabilityAssessment;
  o1: O1Verdict;
  o2: O2Amount;
  o3: O3Rate;
  o4: O4Emi;
  card: NegotiationCard;
  pathToYes?: PathToYes;
  confidence: Confidence;
  answeredCount: number;
  relevantCount: number;
  assumptions: Assumption[];
  routingNote?: string;
}
