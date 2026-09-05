/**
 * Loan arithmetic. Pure functions, no domain judgement -- every threshold that
 * involves an opinion lives in constants.ts instead.
 */

/** Monthly instalment on a reducing-balance loan. */
export function emi(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  if (principal <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const growth = Math.pow(1 + r, months);
  return (principal * r * growth) / (growth - 1);
}

/** The largest principal whose EMI does not exceed `targetEmi`. */
export function principalFromEmi(
  targetEmi: number,
  annualRatePct: number,
  months: number,
): number {
  if (targetEmi <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return targetEmi * months;
  const growth = Math.pow(1 + r, months);
  return (targetEmi * (growth - 1)) / (r * growth);
}

/** EMI on one lakh, the unit Indian borrowers actually compare with. */
export function emiPerLakh(annualRatePct: number, months: number): number {
  return emi(100_000, annualRatePct, months);
}

export function totalInterest(principal: number, annualRatePct: number, months: number): number {
  return emi(principal, annualRatePct, months) * months - principal;
}

/**
 * Effective annual cost of a loan whose fees are deducted up front.
 *
 * The borrower repays instalments computed on the full sanctioned amount but
 * only receives amount-minus-fees, so the true cost is higher than the quoted
 * rate. This is the number RBI's Key Facts Statement is meant to surface, and
 * the one a lender's brochure quietly omits.
 *
 * Solved by bisection on the monthly rate: robust and dependency-free.
 */
export function aprWithFees(
  principal: number,
  annualRatePct: number,
  months: number,
  feesDeductedUpfront: number,
): number {
  if (principal <= 0 || months <= 0) return annualRatePct;
  const instalment = emi(principal, annualRatePct, months);
  const netReceived = principal - feesDeductedUpfront;
  if (netReceived <= 0) return Number.POSITIVE_INFINITY;

  const presentValue = (monthlyRate: number): number => {
    if (monthlyRate === 0) return instalment * months;
    const growth = Math.pow(1 + monthlyRate, months);
    return (instalment * (growth - 1)) / (monthlyRate * growth);
  };

  let lo = 0;
  let hi = 1; // 100% per month is far beyond any real loan
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > netReceived) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

/** Round down to a tidy number a borrower can repeat out loud. */
export function roundDownTo(value: number, step: number): number {
  if (value <= 0) return 0;
  return Math.floor(value / step) * step;
}

/** Choose a sensible rounding step for the magnitude of a loan amount. */
export function tidyAmount(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1_000_000) return roundDownTo(value, 50_000);
  if (value >= 100_000) return roundDownTo(value, 10_000);
  if (value >= 10_000) return roundDownTo(value, 5_000);
  return roundDownTo(value, 1_000);
}

export function tidyEmi(value: number): number {
  if (value <= 0) return 0;
  if (value >= 10_000) return roundDownTo(value, 500);
  if (value >= 1_000) return roundDownTo(value, 100);
  return roundDownTo(value, 50);
}

/** Indian digit grouping: 8,00,000 rather than 800,000. */
export function formatINR(value: number, withPaise = false): string {
  const rounded = withPaise ? value : Math.round(value);
  return `₹${rounded.toLocaleString('en-IN', {
    maximumFractionDigits: withPaise ? 2 : 0,
  })}`;
}

/** Lakh / crore shorthand, because that is how the conversation is held. */
export function formatINRShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2).replace(/\.00$/, '')} L`;
  return formatINR(value);
}

export function formatPct(value: number, dp = 1): string {
  return `${value.toFixed(dp)}%`;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
