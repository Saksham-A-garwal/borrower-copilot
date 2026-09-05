/**
 * The engine. One entry point: `assess(answers) -> Assessment`.
 *
 * Order matters and is deliberate:
 *   1. confidence   -- how much we are allowed to claim to know
 *   2. routing      -- which product this borrower should actually be discussing
 *   3. income       -- the lender's view and the borrower's view, separately
 *   4. affordability-- the two capacity numbers
 *   5. O1..O4       -- the four outputs, each carrying its own reasons
 *   6. the card     -- one screen to hold up at a branch counter
 *
 * Every number that reaches the UI arrives with the sentence that justifies it.
 */

import { CARD_RULES, PRODUCTS, VERDICT_RULES } from './constants';
import { assessConfidence } from './confidence';
import { assessIncome } from './income';
import { assessAffordability } from './affordability';
import { routeProduct, chosenTenureFor } from './products';
import { assessRate, compareQuote, computeFees } from './pricing';
import { assessVerdict, buildPathToYes } from './verdict';
import { buildStressCases } from './stress';
import {
  clamp,
  emi,
  formatINR,
  formatINRShort,
  tidyEmi,
  totalInterest,
} from './finance';
import type {
  Answers,
  Assessment,
  Assumption,
  NegotiationCard,
  O2Amount,
  O3Rate,
  O4Emi,
  ProductOption,
  Reason,
} from './types';

export function assess(a: Answers): Assessment {
  const confidence = assessConfidence(a);
  const { primary, alternatives, note } = routeProduct(a, confidence);
  const spec = PRODUCTS[primary.code];

  const income = assessIncome(a, primary.secured);
  const afford = assessAffordability(a, income, primary.secured);

  const wanted = a.amountWanted ?? 0;
  const tenure = primary.tenureMonths;

  // ---- O1: the verdict --------------------------------------------------
  const o1 = assessVerdict(a, primary, income, afford);
  const pathToYes =
    o1.verdict === 'DONT_BORROW' || o1.verdict === 'BORROW_LESS'
      ? buildPathToYes(a, primary, income, afford)
      : undefined;

  // ---- O2: two amounts, clearly separated -------------------------------
  const o2: O2Amount = {
    lenderWillLikelySanction: primary.lenderMaxAmount,
    borrowerCanSafelyCarry: primary.safeMaxAmount,
    useThisNumber: Math.min(primary.safeMaxAmount, wanted > 0 ? wanted : primary.safeMaxAmount),
    whichOne: 'borrower',
    reasons: [
      ...income.reasons,
      ...afford.reasons,
      {
        ruleId: 'O2.gap',
        text:
          primary.lenderMaxAmount > primary.safeMaxAmount * 1.15
            ? `A lender will likely sanction up to ${formatINRShort(
                primary.lenderMaxAmount,
              )} because its test only looks at income against EMIs. Your own cash flow supports ${formatINRShort(
                primary.safeMaxAmount,
              )}. The gap of ${formatINRShort(
                primary.lenderMaxAmount - primary.safeMaxAmount,
              )} is not free money: it is the amount the lender is willing to let you struggle with. Use the smaller number.`
            : `A lender would sanction about ${formatINRShort(
                primary.lenderMaxAmount,
              )} and your own cash flow supports ${formatINRShort(
                primary.safeMaxAmount,
              )}. These are close, which means the lender's limit and your real limit agree for once. Use the smaller number anyway.`,
      },
    ],
  };

  // ---- O3: fair rate and honest all-in cost -----------------------------
  /**
   * When the safe amount is zero we still owe the borrower an honest rate, so
   * we price the loan they ASKED for. Pricing at the product's minimum ticket
   * instead would let fixed fees dominate and report a wildly overstated APR.
   */
  const pricedAmount = clamp(
    o2.useThisNumber > 0 ? o2.useThisNumber : wanted,
    spec.minTicket,
    spec.maxTicket,
  );
  const rate = assessRate(
    a,
    primary.code,
    pricedAmount,
    tenure,
    confidence,
    income.lenderMonthly > 0
      ? ((emi(pricedAmount, primary.rate.point, tenure) + (a.existingEmiTotal ?? 0)) /
          income.lenderMonthly) *
          100
      : 0,
    (a.collateralValue ?? 0) > 0 ? (pricedAmount / a.collateralValue!) * 100 : undefined,
  );
  const fees = computeFees(primary.code, pricedAmount);
  const quoteComparison = compareQuote(a, primary.code, pricedAmount, tenure, rate);

  const o3: O3Rate = {
    fairBand: rate.band,
    allInAprBand: rate.aprBand,
    feeBreakdown: fees.lines,
    quoteComparison,
    reasons: [
      ...rate.reasons,
      ...(quoteComparison
        ? [
            {
              ruleId: 'O3.quote',
              text:
                quoteComparison.verdict === 'fair'
                  ? `The ${quoteComparison.quotedRate}% you were quoted is inside your fair band. Its true all-in cost is ${quoteComparison.quotedApr.toFixed(
                      2,
                    )}%. This is a reasonable offer.`
                  : `You were quoted ${quoteComparison.quotedRate}%, which is above the ${rate.band.high.toFixed(
                      2,
                    )}% top of your fair band. Its true all-in cost is ${quoteComparison.quotedApr.toFixed(
                      2,
                    )}%, and over the full tenure you would pay about ${formatINR(
                      quoteComparison.extraCostOverTenure,
                    )} more than a fair offer. ${
                      quoteComparison.verdict === 'very_high'
                        ? 'That is far enough above fair that you should walk and try two more lenders.'
                        : 'Show them this and ask them to match your band.'
                    }`,
            } as Reason,
          ]
        : []),
    ],
  };

  // ---- O4: the EMI ceiling ----------------------------------------------
  const ceilingEmi = tidyEmi(afford.safeMaxEmi);
  const recommendedEmi = emi(o2.useThisNumber, rate.point, tenure);

  const tenureCandidates = Array.from(
    new Set(
      [12, 24, 36, 48, 60, 84, 120, 180, 240]
        .filter((m) => m >= spec.minTenureMonths && m <= primary.tenureMonths)
        .concat(primary.tenureMonths),
    ),
  ).sort((x, y) => x - y);

  const o4: O4Emi = {
    ceilingEmi,
    recommendedEmi,
    tenureOptions: tenureCandidates.map((m) => {
      const e = emi(o2.useThisNumber, rate.point, m);
      return {
        months: m,
        emi: e,
        totalInterest: totalInterest(o2.useThisNumber, rate.point, m),
        withinCeiling: e <= ceilingEmi,
      };
    }),
    /**
     * If we are recommending nothing, stress-test the loan they came in for.
     * Showing why the requested loan breaks is far more useful than stressing
     * a zero-rupee loan, which trivially survives everything.
     */
    stressCases: buildStressCases(
      a,
      o2.useThisNumber > 0 ? o2.useThisNumber : wanted,
      rate.point,
      tenure,
      income,
      afford,
      o2.useThisNumber <= 0,
    ),
    reasons: [
      {
        ruleId: 'O4.ceiling',
        text: `Your ceiling is ${formatINR(ceilingEmi)} a month, not a rupee more. It comes from ${formatINR(
          afford.surplus,
        )} of real monthly surplus, of which we let a new EMI take ${(
          (afford.safeMaxEmi / Math.max(afford.surplus, 1)) *
          100
        ).toFixed(0)}%. Whatever a lender offers, this is the number you refuse to cross.`,
      },
      {
        ruleId: 'O4.tenureTradeoff',
        text: (() => {
          const shortest = o4TenureNote(o2.useThisNumber, rate.point, tenureCandidates, ceilingEmi);
          return shortest;
        })(),
      },
    ],
  };

  // ---- The negotiation card ---------------------------------------------
  const card = buildCard(a, primary, o2, o3, o4, income, afford);

  // ---- Assumptions, gathered from everywhere ----------------------------
  const assumptions: Assumption[] = [
    ...income.assumptions,
    ...afford.assumptions,
    ...rate.assumptions,
  ];

  if (a.householdMonthlyExpenses === undefined) {
    assumptions.push({
      ruleId: 'SAFE.expenseFloor',
      text: 'We had no figure for your household expenses and used a floor for your city instead. This is the single biggest driver of your safe amount.',
      wouldNarrowIfAnswered: 'householdMonthlyExpenses',
    });
  }

  return {
    product: primary,
    alternatives,
    income,
    affordability: afford,
    o1,
    o2,
    o3,
    o4,
    card,
    pathToYes,
    confidence: confidence.level,
    answeredCount: confidence.answered,
    relevantCount: confidence.relevant,
    assumptions,
    routingNote: note,
  };
}

function o4TenureNote(
  amount: number,
  ratePct: number,
  tenures: number[],
  ceiling: number,
): string {
  const affordable = tenures.filter((m) => emi(amount, ratePct, m) <= ceiling);
  if (affordable.length === 0) {
    return `Even at the longest tenure available, the EMI on ${formatINRShort(
      amount,
    )} sits above your ceiling. That is the arithmetic telling you the amount is too large, not the tenure too short.`;
  }
  const shortest = affordable[0];
  const longest = tenures[tenures.length - 1];
  const shortEmi = emi(amount, ratePct, shortest);
  const longEmi = emi(amount, ratePct, longest);
  const shortInt = totalInterest(amount, ratePct, shortest);
  const longInt = totalInterest(amount, ratePct, longest);

  if (shortest === longest) {
    return `Over ${shortest} months the EMI is ${formatINR(shortEmi)} and you pay ${formatINR(
      shortInt,
    )} in total interest.`;
  }

  return `The trade-off: ${shortest} months costs ${formatINR(
    shortEmi,
  )} a month and ${formatINR(shortInt)} in total interest; ${longest} months costs ${formatINR(
    longEmi,
  )} a month but ${formatINR(longInt)} in interest. The longer tenure buys you ${formatINR(
    shortEmi - longEmi,
  )} of monthly breathing room for ${formatINR(
    longInt - shortInt,
  )} extra. Take the shortest tenure whose EMI stays under your ceiling.`;
}

function buildCard(
  a: Answers,
  product: ProductOption,
  o2: O2Amount,
  o3: O3Rate,
  o4: O4Emi,
  income: ReturnType<typeof assessIncome>,
  afford: ReturnType<typeof assessAffordability>,
): NegotiationCard {
  const spec = PRODUCTS[product.code];
  const wanted = a.amountWanted ?? 0;
  const maxFee =
    (o2.useThisNumber * spec.processingFeePct * CARD_RULES.feeToleranceMultiple) / 100;

  const because: string[] = [];

  if (a.creditScoreBand && a.creditScoreBand !== 'unknown' && a.creditScoreBand !== 'no_history') {
    because.push(`Credit score in the ${a.creditScoreBand.replace('_', '-')} band.`);
  } else {
    because.push('No credit score on file, which is why this band is wide rather than high.');
  }

  if (a.incomeType === 'salaried' && a.yearsAtCurrentEmployer !== undefined) {
    because.push(
      `${a.yearsAtCurrentEmployer} years with the same employer on ${formatINR(
        a.netMonthlyIncome ?? 0,
      )} a month.`,
    );
  }
  if (a.incomeType === 'self_employed' && a.yearsInBusiness !== undefined) {
    because.push(`${a.yearsInBusiness} years running the same business.`);
  }
  if (product.secured && (a.collateralValue ?? 0) > 0) {
    const ltv = (o2.useThisNumber / a.collateralValue!) * 100;
    because.push(
      `Secured against an asset worth ${formatINRShort(
        a.collateralValue!,
      )}, so the loan-to-value is only ${ltv.toFixed(0)}%.`,
    );
  }
  because.push(
    `After this loan my total EMIs are ${(
      ((o4.recommendedEmi + (a.existingEmiTotal ?? 0)) / Math.max(income.householdMonthly, 1)) *
      100
    ).toFixed(0)}% of my income.`,
  );

  const walkAway: string[] = [
    `All-in APR above ${(o3.allInAprBand.high + CARD_RULES.acceptableAprPaddingPp).toFixed(2)}%.`,
    `A monthly EMI above ${formatINR(o4.ceilingEmi)}.`,
    `A processing fee above ${formatINR(maxFee)} plus GST.`,
    'Any prepayment or foreclosure penalty on a floating-rate loan.',
    'Insurance or a membership bundled into the loan that I did not ask for.',
  ];

  const readyToNegotiate = o2.useThisNumber > 0;

  return {
    readyToNegotiate,
    notReadyReason: readyToNegotiate
      ? undefined
      : 'Your safe amount is currently ₹0, so there is nothing to negotiate yet. See "Your path to yes" above for what changes that.',
    borrowerLabel: `${a.age ?? ''}${a.age ? ', ' : ''}${(a.incomeType ?? 'salaried').replace('_', '-')}, ${
      a.cityTier === 'metro' ? 'metro' : a.cityTier === 'tier2' ? 'tier-2 city' : 'town'
    }`,
    productName: product.name,
    askAmount: wanted,
    recommendedAmount: o2.useThisNumber,
    tenureMonths: product.tenureMonths,
    fairRateBand: o3.fairBand,
    maxAprAccepted: o3.allInAprBand.high + CARD_RULES.acceptableAprPaddingPp,
    maxEmi: o4.ceilingEmi,
    maxProcessingFee: maxFee,
    becauseLines: because,
    walkAwayIf: walkAway,
  };
}
