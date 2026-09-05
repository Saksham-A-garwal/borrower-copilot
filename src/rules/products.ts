/**
 * Product routing.
 *
 * A borrower asks for "a loan". The right answer is often a different product
 * from the one they had in mind, and the difference is worth lakhs. A kirana
 * owner with an unencumbered shop who applies for an unsecured business loan
 * gets a small, expensive offer sized off his ITR. The same man against the
 * same shop gets several times the amount at roughly half the rate.
 *
 * So this module prices EVERY product that could serve the purpose, then ranks
 * them by what the borrower actually cares about: can it cover the need, and
 * what does it truly cost.
 */

import { PRODUCTS, PURPOSE_TO_PRODUCTS, RETIREMENT_AGE } from './constants';
import { assessIncome } from './income';
import { assessAffordability } from './affordability';
import { assessRate } from './pricing';
import { clamp, emi, principalFromEmi, tidyAmount } from './finance';
import type { ConfidenceProfile } from './confidence';
import type { Answers, ProductCode, ProductOption } from './types';

/** Longest tenure this borrower may take on this product. */
export function maxTenureFor(a: Answers, code: ProductCode): number {
  const spec = PRODUCTS[code];
  const age = a.age ?? 35;
  const retirement = RETIREMENT_AGE[a.incomeType ?? 'salaried'];
  const monthsOfWorkingLifeLeft = Math.max(0, (retirement - age) * 12);
  return Math.min(spec.maxTenureMonths, monthsOfWorkingLifeLeft);
}

/** The tenure we actually quote against. */
export function chosenTenureFor(a: Answers, code: ProductCode): number {
  const spec = PRODUCTS[code];
  const cap = maxTenureFor(a, code);
  const preferred = a.preferredTenureMonths ?? spec.defaultTenureMonths;
  return clamp(Math.min(preferred, cap), Math.min(spec.minTenureMonths, cap), cap);
}

/** How much of the pledged asset is actually free to support a new loan. */
function collateralCapacity(a: Answers, code: ProductCode): number | undefined {
  const spec = PRODUCTS[code];
  if (!spec.secured || spec.maxLtvPct === undefined) return undefined;

  // Vehicle loans are secured by the vehicle being bought, not by an asset the
  // borrower already owns, so LTV applies to the purchase itself.
  if (code === 'TWO_WHEELER' || code === 'AUTO') {
    const assetCost = a.amountWanted ?? 0;
    return (assetCost * spec.maxLtvPct) / 100;
  }

  if (code === 'GOLD') {
    if (a.collateralType !== 'gold') return 0;
    return ((a.collateralValue ?? 0) * spec.maxLtvPct) / 100;
  }

  // HOME and LAP run against property.
  const isProperty =
    a.collateralType === 'residential_property' || a.collateralType === 'commercial_property';
  if (!isProperty) return 0;

  const value = a.collateralValue ?? 0;
  // Commercial premises are advanced against more conservatively.
  const ltv = a.collateralType === 'commercial_property' ? spec.maxLtvPct - 5 : spec.maxLtvPct;
  const gross = (value * ltv) / 100;
  return Math.max(0, gross - (a.collateralExistingLoan ?? 0));
}

/** Reasons a product simply is not available to this borrower. */
function eligibilityCheck(a: Answers, code: ProductCode): string | undefined {
  const spec = PRODUCTS[code];
  const age = a.age ?? 35;

  if (age < 21) return 'You need to be at least 21 to borrow.';
  if (maxTenureFor(a, code) < spec.minTenureMonths) {
    return `Your working life left is shorter than the minimum tenure for a ${spec.name.toLowerCase()}.`;
  }

  const hasProperty =
    a.collateralType === 'residential_property' || a.collateralType === 'commercial_property';

  if ((code === 'LAP' || code === 'HOME') && !hasProperty) {
    return 'This needs property to secure it, and you told us you have none to pledge.';
  }
  if (code === 'LAP' && hasProperty && (a.collateralValue ?? 0) <= 0) {
    return 'We need a rough value for your property before we can size a loan against it.';
  }
  if (code === 'GOLD' && a.collateralType !== 'gold') {
    return 'This needs gold to pledge.';
  }
  if (code === 'BUSINESS_UNSEC' && a.incomeType === 'informal') {
    return 'Unsecured business lenders need filed accounts or GST returns, which informal income cannot provide.';
  }
  if (code === 'PERSONAL' && a.incomeType === 'informal' && (a.bankedIncomeSharePct ?? 0) < 30) {
    return 'Mainstream personal-loan lenders need income visible in a bank account. Very little of yours is.';
  }
  return undefined;
}

/** Price and size one product for this borrower. */
export function evaluateProduct(
  a: Answers,
  code: ProductCode,
  confidence: ConfidenceProfile,
): ProductOption {
  const spec = PRODUCTS[code];
  const tenure = chosenTenureFor(a, code);
  const income = assessIncome(a, spec.secured);
  const afford = assessAffordability(a, income, spec.secured);
  const ineligibleReason = eligibilityCheck(a, code);

  // Size from EMI capacity at a provisional rate, then re-price at the real
  // amount. One pass is enough: the rate moves by at most a fraction of a point.
  const provisional = assessRate(a, code, a.amountWanted ?? spec.minTicket, tenure, confidence, 0);

  const lenderFromEmi = principalFromEmi(afford.lenderMaxEmi, provisional.point, tenure);
  const safeFromEmi = principalFromEmi(afford.safeMaxEmi, provisional.band.high, tenure);

  const assetCap = collateralCapacity(a, code);

  let lenderMaxAmount = Math.min(lenderFromEmi, spec.maxTicket);
  if (assetCap !== undefined) lenderMaxAmount = Math.min(lenderMaxAmount, assetCap);
  let safeMaxAmount = Math.min(safeFromEmi, lenderMaxAmount);

  lenderMaxAmount = tidyAmount(Math.max(0, lenderMaxAmount));
  safeMaxAmount = tidyAmount(Math.max(0, safeMaxAmount));

  const recommended = Math.min(safeMaxAmount, a.amountWanted ?? safeMaxAmount);

  /**
   * Price every product at a COMPARABLE amount, so the ranking below compares
   * like with like. Pricing each product at its own minimum ticket makes fixed
   * fees dominate the APR and can route a scooter buyer to a personal loan
   * purely because the personal-loan minimum happens to be larger.
   */
  const comparisonAmount = clamp(
    recommended > 0 ? recommended : a.amountWanted ?? spec.minTicket,
    spec.minTicket,
    spec.maxTicket,
  );

  const ltvPct =
    assetCap !== undefined && (a.collateralValue ?? 0) > 0
      ? (comparisonAmount / (a.collateralValue ?? 1)) * 100
      : undefined;

  const postLoanEmi = emi(comparisonAmount, provisional.point, tenure) + (a.existingEmiTotal ?? 0);
  const postLoanFoirPct =
    income.lenderMonthly > 0 ? (postLoanEmi / income.lenderMonthly) * 100 : 0;

  const rate = assessRate(a, code, comparisonAmount, tenure, confidence, postLoanFoirPct, ltvPct);

  return {
    code,
    name: spec.name,
    secured: spec.secured,
    eligible: ineligibleReason === undefined && lenderMaxAmount >= spec.minTicket,
    ineligibleReason:
      ineligibleReason ??
      (lenderMaxAmount < spec.minTicket
        ? `Your income supports less than the ${spec.name.toLowerCase()} minimum of ₹${spec.minTicket.toLocaleString(
            'en-IN',
          )}.`
        : undefined),
    lenderMaxAmount,
    safeMaxAmount,
    tenureMonths: tenure,
    rate,
    emiAtRecommended: emi(recommended, rate.point, tenure),
  };
}

export interface RoutingResult {
  primary: ProductOption;
  alternatives: ProductOption[];
  note?: string;
}

/**
 * Rank the candidates. A product that can actually cover the borrower's need
 * beats one that cannot, and among those, cheapest all-in cost wins.
 */
export function routeProduct(a: Answers, confidence: ConfidenceProfile): RoutingResult {
  const purpose = a.purpose ?? 'other_consumption';
  const candidateCodes = PURPOSE_TO_PRODUCTS[purpose];
  const wanted = a.amountWanted ?? 0;

  const evaluated = candidateCodes.map((code) => evaluateProduct(a, code, confidence));
  const eligible = evaluated.filter((p) => p.eligible);

  // If the borrower named a product and it is eligible, respect the choice but
  // still surface a materially better route as an alternative.
  const pool = eligible.length > 0 ? eligible : evaluated;

  const score = (p: ProductOption) => {
    const coversNeed = p.safeMaxAmount >= wanted * 0.9 ? 1 : 0;
    const coverage = wanted > 0 ? Math.min(p.safeMaxAmount / wanted, 1) : 1;
    // Best fit for the stated purpose, as a small tie-break only.
    const fitRank = candidateCodes.indexOf(p.code);
    const fitBonus = (candidateCodes.length - fitRank) * 0.25;
    // Coverage dominates; true all-in cost decides among products that cover
    // the need; purpose-fit breaks a remaining tie. Costs are comparable
    // because evaluateProduct prices every product at the same amount.
    return coversNeed * 1000 + coverage * 100 - p.rate.aprBand.high + fitBonus;
  };

  const ranked = [...pool].sort((x, y) => score(y) - score(x));
  const primary = ranked[0];
  const alternatives = ranked.slice(1).concat(eligible.length > 0 ? evaluated.filter((p) => !p.eligible) : []);

  // Say out loud when routing has moved the borrower off the obvious product.
  let note: string | undefined;
  const unsecuredBest = evaluated
    .filter((p) => !p.secured && p.eligible)
    .sort((x, y) => y.safeMaxAmount - x.safeMaxAmount)[0];

  if (primary.secured && unsecuredBest && primary.safeMaxAmount > unsecuredBest.safeMaxAmount * 1.3) {
    const rateSaving = unsecuredBest.rate.point - primary.rate.point;
    note =
      `You probably came in expecting an ${unsecuredBest.name.toLowerCase()}. That would get you about ` +
      `₹${unsecuredBest.safeMaxAmount.toLocaleString('en-IN')} at roughly ${unsecuredBest.rate.point.toFixed(
        1,
      )}%. Because you own an asset you can pledge, a ${primary.name.toLowerCase()} gets you about ` +
      `₹${primary.safeMaxAmount.toLocaleString('en-IN')} at roughly ${primary.rate.point.toFixed(1)}%` +
      (rateSaving > 0 ? `, which is ${rateSaving.toFixed(1)} points cheaper` : '') +
      '. This is the single most valuable thing this app can tell you.';
  }

  return { primary, alternatives, note };
}
