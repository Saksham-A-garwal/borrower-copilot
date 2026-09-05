/**
 * Pricing: what a fair rate for THIS borrower looks like, and what it really
 * costs once the fees are put back in.
 *
 * Two separate ideas live here, and lenders benefit from them being confused:
 *
 *   rate  - the headline number on the sanction letter.
 *   APR   - what the borrower actually pays, because the processing fee and its
 *           GST are deducted before the money reaches them. RBI's Key Facts
 *           Statement exists to force this disclosure; this app computes it
 *           before the borrower ever walks in.
 */

import {
  GST_ON_FEES_PCT,
  HIGH_CARD_UTILISATION_PCT,
  PREDATORY_APR_PCT,
  PRODUCTS,
  RATE_ADJ_CREDIT_SCORE,
  RATE_ADJ_EMPLOYER,
  RATE_ADJ_INCOME_TYPE,
  RATE_ADJ_NO_SCORE_SECURED_RELIEF,
  RATE_ADJ_OTHER,
  RATE_ADJ_VINTAGE,
} from './constants';
import { aprWithFees, clamp, emi, formatINR } from './finance';
import type { Answers, Assumption, ProductCode, RateAssessment, Reason } from './types';
import type { ConfidenceProfile } from './confidence';

export interface FeeBreakdown {
  processingFeePct: number;
  processingFee: number;
  gst: number;
  otherCharges: number;
  total: number;
  lines: { label: string; amount: number }[];
}

export function computeFees(code: ProductCode, amount: number): FeeBreakdown {
  const spec = PRODUCTS[code];
  const raw = (amount * spec.processingFeePct) / 100;
  const processingFee = clamp(raw, spec.processingFeeMin, spec.processingFeeMax);
  const gst = (processingFee * GST_ON_FEES_PCT) / 100;
  const otherCharges = spec.otherChargesFlat;
  const total = processingFee + gst + otherCharges;

  return {
    processingFeePct: spec.processingFeePct,
    processingFee,
    gst,
    otherCharges,
    total,
    lines: [
      { label: `Processing fee (${spec.processingFeePct}%)`, amount: processingFee },
      { label: `GST on the fee (${GST_ON_FEES_PCT}%)`, amount: gst },
      { label: 'Documentation, stamping and valuation', amount: otherCharges },
    ],
  };
}

/**
 * The scorecard. Starts at the product's mid rate and moves the borrower with
 * signed, individually explainable adjustments -- never a black box.
 */
export function assessRate(
  a: Answers,
  code: ProductCode,
  amount: number,
  tenureMonths: number,
  confidence: ConfidenceProfile,
  postLoanFoirPct: number,
  ltvPct?: number,
): RateAssessment {
  const spec = PRODUCTS[code];
  const reasons: Reason[] = [];
  const assumptions: Assumption[] = [];

  let rate = spec.rateMid;
  const moves: { label: string; pp: number }[] = [];

  const push = (label: string, pp: number) => {
    if (pp === 0) return;
    rate += pp;
    moves.push({ label, pp });
  };

  // --- Credit score ------------------------------------------------------
  const band = a.creditScoreBand ?? 'unknown';
  const scoreAdj = RATE_ADJ_CREDIT_SCORE[band];
  const noScore = band === 'unknown' || band === 'no_history';

  if (noScore && spec.secured) {
    push('no credit score, but collateral carries the risk', scoreAdj + RATE_ADJ_NO_SCORE_SECURED_RELIEF);
    reasons.push({
      ruleId: 'RATE.noScoreSecured',
      text: 'Having no credit score costs you far less here than it would on an unsecured loan, because the lender is pricing the asset behind the loan more than your history.',
    });
  } else {
    push(`credit score band ${band.replace('_', ' ')}`, scoreAdj);
  }

  if (noScore) {
    assumptions.push({
      ruleId: 'RATE.score',
      text: 'We treated your credit score as unknown, not as bad. That widens the band rather than pushing it up, because we genuinely do not know.',
      wouldNarrowIfAnswered: 'creditScoreBand',
    });
  }

  // --- Income type and employer -----------------------------------------
  push(`${(a.incomeType ?? 'salaried').replace('_', '-')} income`, RATE_ADJ_INCOME_TYPE[a.incomeType ?? 'salaried']);

  if (a.incomeType === 'salaried' && a.employerCategory) {
    push(`${a.employerCategory.replace(/_/g, ' ')} employer`, RATE_ADJ_EMPLOYER[a.employerCategory]);
  }

  // --- Vintage -----------------------------------------------------------
  const vintage =
    a.incomeType === 'salaried' ? a.yearsAtCurrentEmployer : a.yearsInBusiness;
  if (vintage !== undefined) {
    if (vintage >= 5) push(`${vintage} years of stability`, RATE_ADJ_VINTAGE.fiveYearsPlus);
    else if (vintage >= 3) push(`${vintage} years of stability`, RATE_ADJ_VINTAGE.threeToFive);
    else if (vintage < 1) push('less than a year in your current work', RATE_ADJ_VINTAGE.underOneYear);
  }

  // --- Repayment behaviour ----------------------------------------------
  const misses = a.missedPaymentsLast12m ?? 0;
  if (misses > 0) {
    const adj = Math.min(misses * RATE_ADJ_OTHER.perMissedPayment, RATE_ADJ_OTHER.missedPaymentCap);
    push(`${misses} missed payment${misses > 1 ? 's' : ''} in the last year`, adj);
  }

  if ((a.creditCardUtilisationPct ?? 0) > HIGH_CARD_UTILISATION_PCT) {
    push(`card utilisation above ${HIGH_CARD_UTILISATION_PCT}%`, RATE_ADJ_OTHER.highCardUtilisation);
  }

  if ((a.highestExistingApr ?? 0) >= PREDATORY_APR_PCT) {
    push('you already carry very expensive debt', RATE_ADJ_OTHER.carriesPredatoryDebt);
  }

  // --- Relationship and ticket size --------------------------------------
  if (a.salaryAccountWithLender) push('salary already banked with the lender', RATE_ADJ_OTHER.existingRelationship);

  if (!spec.secured) {
    if (amount < 200_000) push('a small unsecured ticket', RATE_ADJ_OTHER.smallTicketUnder2L);
    else if (amount > 1_000_000) push('a large ticket', RATE_ADJ_OTHER.largeTicketOver10L);
  }

  if (postLoanFoirPct > 55) push('obligations will be a large share of income', RATE_ADJ_OTHER.highPostLoanFoir);

  // --- Loan to value -----------------------------------------------------
  if (spec.secured && ltvPct !== undefined) {
    if (ltvPct < 50) push(`a low loan-to-value of ${ltvPct.toFixed(0)}%`, RATE_ADJ_OTHER.lowLtvUnder50);
    else if (ltvPct > 65) push(`a high loan-to-value of ${ltvPct.toFixed(0)}%`, RATE_ADJ_OTHER.highLtvOver65);
  }

  const point = clamp(rate, spec.rateFloor, spec.rateCeiling);

  const up = moves.filter((m) => m.pp > 0);
  const down = moves.filter((m) => m.pp < 0);
  const describe = (list: typeof moves) => list.map((m) => m.label).join(', ');

  reasons.push({
    ruleId: 'RATE.scorecard',
    text: `We start from ${spec.rateMid.toFixed(2)}%, the middle of the ${spec.name.toLowerCase()} market.${
      down.length ? ` In your favour: ${describe(down)}.` : ''
    }${up.length ? ` Against you: ${describe(up)}.` : ''} That lands you at about ${point.toFixed(2)}%.`,
  });

  // --- Band --------------------------------------------------------------
  const half = confidence.rateHalfWidthPp;
  const bandLow = clamp(point - half, spec.rateFloor, spec.rateCeiling);
  const bandHigh = clamp(point + half, spec.rateFloor, spec.rateCeiling);

  reasons.push({
    ruleId: 'RATE.bandWidth',
    text: `The band is ${bandLow.toFixed(2)}% to ${bandHigh.toFixed(
      2,
    )}%, ${half.toFixed(2)} points either side. It is this wide because of what you have not told us, and it narrows as you answer more.`,
  });

  // --- All-in APR --------------------------------------------------------
  const fees = computeFees(code, amount);
  const aprLow = aprWithFees(amount, bandLow, tenureMonths, fees.total);
  const aprHigh = aprWithFees(amount, bandHigh, tenureMonths, fees.total);

  reasons.push({
    ruleId: 'FEE.apr',
    text: `Fees of ${formatINR(
      fees.total,
    )} come out before the money reaches you, so you repay on ${formatINR(
      amount,
    )} but receive ${formatINR(amount - fees.total)}. That turns the ${bandLow.toFixed(
      2,
    )}-${bandHigh.toFixed(2)}% headline rate into a true cost of ${aprLow.toFixed(2)}-${aprHigh.toFixed(
      2,
    )}% a year. Ask every lender for this number, not the headline one.`,
  });

  return {
    point,
    band: { low: bandLow, high: bandHigh },
    aprBand: { low: aprLow, high: aprHigh },
    processingFeePct: fees.processingFeePct,
    processingFeeRupees: fees.processingFee,
    gstOnFee: fees.gst,
    reasons,
    assumptions,
  };
}

/** Compare a quote the borrower has already been given against the fair band. */
export function compareQuote(
  a: Answers,
  code: ProductCode,
  amount: number,
  tenureMonths: number,
  fair: RateAssessment,
): {
  quotedRate: number;
  quotedApr: number;
  verdict: 'fair' | 'high' | 'very_high';
  extraCostOverTenure: number;
} | undefined {
  if (!a.offerRatePct) return undefined;

  const spec = PRODUCTS[code];
  const feePct = a.offerProcessingFeePct ?? spec.processingFeePct;
  const fee = (amount * feePct) / 100;
  const totalFee = fee * (1 + GST_ON_FEES_PCT / 100) + spec.otherChargesFlat;

  const quotedApr = aprWithFees(amount, a.offerRatePct, tenureMonths, totalFee);
  const quotedTotal = emi(amount, a.offerRatePct, tenureMonths) * tenureMonths + totalFee;
  const fairTotal =
    emi(amount, fair.band.high, tenureMonths) * tenureMonths + computeFees(code, amount).total;

  const overBandPp = a.offerRatePct - fair.band.high;
  const verdict: 'fair' | 'high' | 'very_high' =
    overBandPp <= 0 ? 'fair' : overBandPp <= 1.5 ? 'high' : 'very_high';

  return {
    quotedRate: a.offerRatePct,
    quotedApr,
    verdict,
    extraCostOverTenure: Math.max(0, quotedTotal - fairTotal),
  };
}
