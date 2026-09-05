/**
 * Output O1: borrow, borrow less, or do not borrow.
 *
 * "Do not borrow" must be genuinely reachable, so it is implemented as a set of
 * hard stops evaluated before anything else. If a stop fires, no amount of
 * favourable arithmetic elsewhere can overturn it.
 *
 * A refusal on its own is useless to someone who needs money, so every refusal
 * is paired with a path back: what to change, how long it takes, and what it
 * unlocks.
 */

import {
  BORROWER_OVEREXTENDED_PCT,
  PREDATORY_APR_PCT,
  PRODUCTIVE_PURPOSES,
  PURE_CONSUMPTION_PURPOSES,
  VERDICT_RULES,
} from './constants';
import { emi, formatINR, formatINRShort, principalFromEmi } from './finance';
import type {
  AffordabilityAssessment,
  Answers,
  IncomeAssessment,
  O1Verdict,
  PathToYes,
  ProductOption,
  Reason,
} from './types';

export function assessVerdict(
  a: Answers,
  product: ProductOption,
  income: IncomeAssessment,
  afford: AffordabilityAssessment,
): O1Verdict {
  const hardStops: Reason[] = [];
  const reasons: Reason[] = [];
  const wanted = a.amountWanted ?? 0;
  const existingEmi = a.existingEmiTotal ?? 0;

  const isConsumption = a.purpose ? PURE_CONSUMPTION_PURPOSES.includes(a.purpose) : false;
  const isProductive = a.purpose ? PRODUCTIVE_PURPOSES.includes(a.purpose) : false;

  // --- Hard stop 1: there is no surplus at all --------------------------
  if (afford.safeMaxEmi <= 0) {
    hardStops.push({
      ruleId: 'STOP.noSurplus',
      text: `After ${formatINR(afford.expensesUsed)} of living costs and ${formatINR(
        existingEmi,
      )} of existing EMIs, your household has ${formatINR(
        Math.max(0, afford.surplus),
      )} left over. There is no room for another EMI at any size, and a lender who offers you one is not doing you a favour.`,
    });
  }

  // --- Hard stop 2: a very recent missed payment ------------------------
  const misses = a.missedPaymentsLast12m ?? 0;
  const monthsSince = a.monthsSinceLastMiss;
  if (misses > 0 && monthsSince !== undefined && monthsSince <= VERDICT_RULES.recentMissMonths && !product.secured) {
    hardStops.push({
      ruleId: 'STOP.recentMiss',
      text: `You bounced a payment ${monthsSince} month${
        monthsSince === 1 ? '' : 's'
      } ago. That is sitting on your bureau record right now, and an unsecured application today will either be rejected or priced punitively. Waiting ${
        VERDICT_RULES.cooldownMonths
      } months of clean repayment is worth more to you than any lender you could find this week.`,
    });
  }

  /**
   * A miss was declared but its date was not. Silence must never buy a better
   * answer than any disclosure could: saying "1 month ago" is a hard stop, so
   * saying nothing cannot be a clean pass. We do not resolve the unknown to
   * the worst case either (Rule 3) -- the miss may well be eleven months old.
   * Instead we refuse to certify the borrower, say so in plain words, and
   * cap the verdict below BORROW until they tell us.
   */
  const missDateUndisclosed = misses > 0 && monthsSince === undefined && !product.secured;
  if (missDateUndisclosed) {
    reasons.push({
      ruleId: 'ADVICE.missDateUnknown',
      text: `You told us about ${misses} missed payment${
        misses > 1 ? 's' : ''
      } but not when the most recent one was. That single fact decides whether a lender sees you as a current risk or an old one, so we cannot give you a clean answer without it. We have assumed it could be recent and held the amount back accordingly — tell us the month and this may improve immediately.`,
    });
  }

  // --- Hard stop 3: the loan would over-extend the household -------------
  const newEmiAtWanted = emi(wanted, product.rate.band.high, product.tenureMonths);
  const postLoanRatio =
    income.householdMonthly > 0
      ? ((newEmiAtWanted + existingEmi) / income.householdMonthly) * 100
      : 100;

  if (postLoanRatio > BORROWER_OVEREXTENDED_PCT && wanted > 0) {
    hardStops.push({
      ruleId: 'STOP.overExtended',
      text: `Borrowing ${formatINRShort(wanted)} would put ${postLoanRatio.toFixed(
        0,
      )}% of your reliable income into EMIs. Past ${BORROWER_OVEREXTENDED_PCT}%, repayment starts displacing food, school fees and health spending. We will not help you cross that line.`,
    });
  }

  // --- Hard stop 4: consumption borrowing with no cushion ----------------
  const emergency = a.emergencySavingsMonths;
  if (
    isConsumption &&
    emergency !== undefined &&
    emergency < VERDICT_RULES.minEmergencyMonthsForConsumption &&
    (a.incomeType === 'informal' || (a.missedPaymentsLast12m ?? 0) > 0)
  ) {
    hardStops.push({
      ruleId: 'STOP.consumptionNoBuffer',
      text: 'This loan buys something that will not earn anything back, and you have less than a month of savings behind you. One bad month and this EMI becomes the reason you take the next loan.',
    });
  }

  // --- Hard stop 5: no lender would take this on ------------------------
  if (!product.eligible && product.ineligibleReason) {
    hardStops.push({ ruleId: 'STOP.ineligible', text: product.ineligibleReason });
  }

  // --- Advisory: expensive existing debt first --------------------------
  if ((a.highestExistingApr ?? 0) >= PREDATORY_APR_PCT && a.purpose !== 'debt_consolidation') {
    reasons.push({
      ruleId: 'ADVICE.predatoryDebt',
      text: `You are already paying ${a.highestExistingApr}% on an existing loan. Clearing that debt returns you ${a.highestExistingApr}% a year risk-free, which almost certainly beats whatever this new loan buys you. Deal with it first.`,
    });
  }

  if (hardStops.length > 0) {
    return {
      verdict: 'DONT_BORROW',
      headline: 'Not this loan, and not right now.',
      reasons,
      hardStops,
    };
  }

  // --- Borrow less -------------------------------------------------------
  const safeMax = product.safeMaxAmount;
  const threshold = (wanted * VERDICT_RULES.borrowLessThresholdPct) / 100;

  if (wanted > 0 && safeMax < threshold) {
    const wildOverAsk = wanted > safeMax * VERDICT_RULES.wildOverAskMultiple;
    reasons.push({
      ruleId: 'VERDICT.borrowLess',
      text: `You asked for ${formatINRShort(wanted)}. On your own cash flow, ${formatINRShort(
        safeMax,
      )} is what you can carry without the loan running your household. ${
        wildOverAsk
          ? 'The gap is large enough that you should reconsider the plan itself, not just the amount.'
          : 'The gap is closeable: a longer tenure or a smaller ask gets you there.'
      }`,
    });
    if (isProductive) {
      reasons.push({
        ruleId: 'VERDICT.productiveBorrowLess',
        text: 'Because this loan is meant to earn, a smaller first loan repaid cleanly is usually the fastest route to a bigger second one at a better rate.',
      });
    }
    return {
      verdict: 'BORROW_LESS',
      headline: `Borrow ${formatINRShort(safeMax)}, not ${formatINRShort(wanted)}.`,
      reasons,
      hardStops: [],
    };
  }

  // An undisclosed miss date cannot pass as a clean yes -- see above.
  if (missDateUndisclosed) {
    return {
      verdict: 'BORROW_LESS',
      headline: `Tell us when you last missed a payment before borrowing ${formatINRShort(wanted)}.`,
      reasons,
      hardStops: [],
    };
  }

  // --- Borrow ------------------------------------------------------------
  reasons.push({
    ruleId: 'VERDICT.borrow',
    text: `${formatINRShort(wanted)} fits. After this loan your EMIs would be ${postLoanRatio.toFixed(
      0,
    )}% of reliable income, you keep ${formatINR(
      Math.max(0, afford.surplus - newEmiAtWanted),
    )} a month of breathing room, and the amount is within both what a lender will approve and what you can carry.`,
  });

  if (isConsumption) {
    reasons.push({
      ruleId: 'ADVICE.consumption',
      text: 'It still buys something that earns nothing back, so take the smallest amount that does the job rather than the largest you are offered.',
    });
  }

  return {
    verdict: 'BORROW',
    headline: `Yes, up to ${formatINRShort(Math.min(wanted, safeMax))}.`,
    reasons,
    hardStops: [],
  };
}

/**
 * When the answer is no, say what would make it yes. This is what stops the
 * app being a rejection letter.
 */
export function buildPathToYes(
  a: Answers,
  product: ProductOption,
  income: IncomeAssessment,
  afford: AffordabilityAssessment,
): PathToYes | undefined {
  const steps: { action: string; effect: string }[] = [];
  let timelineMonths = 0;
  const existingEmi = a.existingEmiTotal ?? 0;

  const misses = a.missedPaymentsLast12m ?? 0;
  const monthsSince = a.monthsSinceLastMiss;

  // Not knowing the date is itself a blocker worth naming, rather than being
  // silently defaulted to "long ago" -- which would drop this step entirely.
  if (misses > 0 && monthsSince === undefined) {
    steps.push({
      action: 'Tell us the month of your most recent missed payment.',
      effect:
        'It is the single most decision-relevant fact you have not given us. A bounce last month and one eleven months ago are completely different applications, and until we know which, we have to hold your amount back.',
    });
  }

  if (misses > 0 && monthsSince !== undefined && monthsSince <= VERDICT_RULES.recentMissMonths) {
    const wait = Math.max(0, VERDICT_RULES.cooldownMonths - monthsSince);
    steps.push({
      action: `Pay every instalment on time for the next ${wait} months.`,
      effect: `Moves the bounce far enough back on your record that lenders stop treating you as a current default risk. This alone is worth several percentage points on your rate.`,
    });
    timelineMonths = Math.max(timelineMonths, wait);
  }

  if ((a.highestExistingApr ?? 0) >= PREDATORY_APR_PCT) {
    steps.push({
      action: `Clear the loan you are paying ${a.highestExistingApr}% on, smallest balance first.`,
      effect: `Frees up part of the ${formatINR(
        existingEmi,
      )} you pay every month, and every rupee freed is a rupee of new EMI capacity. It also removes the strongest negative signal a lender sees.`,
    });
    timelineMonths = Math.max(timelineMonths, 4);
  }

  if (a.incomeType === 'informal' && (a.bankedIncomeSharePct ?? 0) < 70) {
    steps.push({
      action: 'Take as much of your income as you can into your bank account, by UPI or transfer.',
      effect: `Lenders can only count income they can see. Going from ${
        a.bankedIncomeSharePct ?? 0
      }% to 70% banked raises the income a lender credits you with by roughly ${Math.round(
        (0.7 - (a.bankedIncomeSharePct ?? 0) / 100) * 40,
      )}%, with no change to what you actually earn.`,
    });
    timelineMonths = Math.max(timelineMonths, 6);
  }

  if (a.creditScoreBand === 'unknown' || a.creditScoreBand === 'no_history') {
    steps.push({
      action: 'Check your credit score free on the CIBIL, Experian or CRIF site.',
      effect: 'Costs nothing and takes ten minutes. Right now every number in this app is wider than it needs to be purely because we do not know it.',
    });
  }

  if ((a.emergencySavingsMonths ?? 99) < 1) {
    steps.push({
      action: 'Build one month of expenses in savings before taking on a new EMI.',
      effect: `About ${formatINR(
        afford.expensesUsed,
      )} set aside. It is what turns a bad month into an inconvenience instead of the reason you take the next loan.`,
    });
    timelineMonths = Math.max(timelineMonths, 4);
  }

  if (steps.length === 0) return undefined;

  // What capacity looks like once the expensive debt is gone and the household
  // is no longer being penalised for a fresh miss.
  const freedEmi = (a.highestExistingApr ?? 0) >= PREDATORY_APR_PCT ? existingEmi : 0;
  const improvedEmi = afford.safeMaxEmi + freedEmi;
  const unlocksAmount = principalFromEmi(improvedEmi, product.rate.point, product.tenureMonths);

  return {
    steps,
    timelineMonths: Math.max(timelineMonths, 1),
    unlocksAmount: Math.max(0, unlocksAmount),
  };
}
