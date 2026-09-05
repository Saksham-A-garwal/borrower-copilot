/**
 * Affordability: the two capacity numbers that make this product worth building.
 *
 *   lenderMaxEmi - FOIR arithmetic. What an underwriter will approve.
 *   safeMaxEmi   - cash-flow arithmetic. What the household can actually pay
 *                  every month without the loan quietly eating the grocery
 *                  budget.
 *
 * These are usually different, and for a well-paid salaried borrower the
 * lender's number can be two to three times the safe one. Showing both, and
 * saying plainly which to use, is output O2.
 */

import {
  BORROWER_TOTAL_EMI_CEILING_PCT,
  EXPENSE_FLOOR_BY_CITY,
  EXPENSE_FLOOR_PER_DEPENDENT,
  FOIR_ADJUSTMENTS,
  FOIR_BY_INCOME_SLAB,
  FOIR_CEILING_PCT,
  FOIR_FLOOR_PCT,
  MIN_SAVINGS_RATE,
  PRODUCTIVE_CREDIT_MAX_SHARE,
  PRODUCTIVE_INCOME_DISCOUNT,
  PRODUCTIVE_PURPOSES,
  SAFE_EMI_FACTOR_BY_STABILITY,
  SAFE_EMI_FACTOR_CEILING,
  SAFE_EMI_MODIFIERS,
} from './constants';
import { clamp, formatINR } from './finance';
import type {
  AffordabilityAssessment,
  Answers,
  Assumption,
  IncomeAssessment,
  Reason,
} from './types';

/** The FOIR an underwriter would apply to this borrower, after adjustments. */
export function computeFoir(a: Answers, income: IncomeAssessment, secured: boolean): {
  foirPct: number;
  reasons: Reason[];
} {
  const reasons: Reason[] = [];
  const slab =
    FOIR_BY_INCOME_SLAB.find((s) => income.lenderMonthly <= s.upTo) ??
    FOIR_BY_INCOME_SLAB[FOIR_BY_INCOME_SLAB.length - 1];

  let foir = slab.foirPct;
  const parts: string[] = [`${slab.foirPct}% base for your income slab`];

  if (secured) {
    foir += FOIR_ADJUSTMENTS.securedProduct;
    parts.push(`+${FOIR_ADJUSTMENTS.securedProduct} because the loan is secured`);
  }

  const scoreWeak =
    a.creditScoreBand === 'unknown' ||
    a.creditScoreBand === 'no_history' ||
    a.creditScoreBand === 'below_650' ||
    a.creditScoreBand === '650_699';
  if (scoreWeak) {
    foir += FOIR_ADJUSTMENTS.scoreUnknownOrLow;
    parts.push(`${FOIR_ADJUSTMENTS.scoreUnknownOrLow} for an unknown or sub-700 score`);
  }

  if ((a.missedPaymentsLast12m ?? 0) > 0) {
    foir += FOIR_ADJUSTMENTS.recentMissedPayment;
    parts.push(`${FOIR_ADJUSTMENTS.recentMissedPayment} for a missed payment in the last year`);
  }

  if (a.incomeType === 'informal') {
    foir += FOIR_ADJUSTMENTS.informalIncome;
    parts.push(`${FOIR_ADJUSTMENTS.informalIncome} because income is informal`);
  }

  foir = clamp(foir, FOIR_FLOOR_PCT, FOIR_CEILING_PCT);

  reasons.push({
    ruleId: 'FOIR.slab',
    text: `A lender will let your total EMIs reach ${foir}% of the ${formatINR(
      income.lenderMonthly,
    )} it credits you with: ${parts.join(', ')}.`,
  });

  return { foirPct: foir, reasons };
}

/** The expense figure the safe calculation should actually use. */
function expensesToUse(a: Answers): { value: number; reason?: Reason; assumption?: Assumption } {
  const declared = a.householdMonthlyExpenses ?? 0;
  const tier = a.cityTier ?? 'tier2';
  const dependents = a.dependents ?? 0;
  const floor =
    EXPENSE_FLOOR_BY_CITY[tier] + Math.max(0, dependents - 1) * EXPENSE_FLOOR_PER_DEPENDENT;

  if (declared >= floor) return { value: declared };

  return {
    value: floor,
    reason: {
      ruleId: 'SAFE.expenseFloor',
      text: `You told us your household spends ${formatINR(
        declared,
      )} a month, but a household like yours in this city rarely runs below ${formatINR(
        floor,
      )}. We used the higher figure for your safe number, so we do not invent surplus that is not there.`,
    },
    assumption: {
      ruleId: 'SAFE.expenseFloor',
      text: `Declared expenses (${formatINR(declared)}) were below our plausibility floor (${formatINR(
        floor,
      )}); the floor was used instead.`,
      wouldNarrowIfAnswered: 'householdMonthlyExpenses',
    },
  };
}

export function assessAffordability(
  a: Answers,
  income: IncomeAssessment,
  secured: boolean,
): AffordabilityAssessment {
  const reasons: Reason[] = [];
  const assumptions: Assumption[] = [];
  const existingEmi = a.existingEmiTotal ?? 0;

  // --- Lender side -------------------------------------------------------
  const { foirPct, reasons: foirReasons } = computeFoir(a, income, secured);
  reasons.push(...foirReasons);

  const lenderMaxEmi = Math.max(0, (income.lenderMonthly * foirPct) / 100 - existingEmi);
  reasons.push({
    ruleId: 'FOIR.capacity',
    text: `That gives ${formatINR(
      (income.lenderMonthly * foirPct) / 100,
    )} of total EMI room, minus the ${formatINR(existingEmi)} you already pay, so a lender has about ${formatINR(
      lenderMaxEmi,
    )} a month to work with.`,
  });

  // --- Borrower side -----------------------------------------------------
  const exp = expensesToUse(a);
  if (exp.reason) reasons.push(exp.reason);
  if (exp.assumption) assumptions.push(exp.assumption);

  const savingsTarget = income.householdMonthly * MIN_SAVINGS_RATE;
  const surplus = income.householdMonthly - exp.value - existingEmi - savingsTarget;

  reasons.push({
    ruleId: 'SAFE.surplus',
    text: `Your side of the arithmetic: ${formatINR(
      income.householdMonthly,
    )} reliable income, minus ${formatINR(exp.value)} of living costs, minus ${formatINR(
      existingEmi,
    )} of existing EMIs, minus ${formatINR(
      savingsTarget,
    )} that must keep going into savings, leaves ${formatINR(surplus)} a month.`,
  });

  // Stability factor, then the modifiers that make it harsher or kinder.
  let factor = SAFE_EMI_FACTOR_BY_STABILITY[a.incomeType ?? 'salaried'];
  const factorNotes: string[] = [
    `${(factor * 100).toFixed(0)}% of surplus for ${(a.incomeType ?? 'salaried').replace('_', '-')} income`,
  ];

  const em = a.emergencySavingsMonths;
  if (em !== undefined) {
    if (em < 1) {
      factor *= SAFE_EMI_MODIFIERS.noEmergencyFund;
      factorNotes.push('cut sharply because you have under a month of savings');
    } else if (em < 3) {
      factor *= SAFE_EMI_MODIFIERS.thinEmergencyFund;
      factorNotes.push('cut because your emergency fund is under three months');
    } else if (em >= 6) {
      factor *= SAFE_EMI_MODIFIERS.strongEmergencyFund;
      factorNotes.push('raised because you hold six months or more of savings');
    }
  } else {
    assumptions.push({
      ruleId: 'SAFE.emergencyFund',
      text: 'We did not know how many months of expenses you have saved, so no adjustment was made. Telling us would move your safe amount in either direction.',
      wouldNarrowIfAnswered: 'emergencySavingsMonths',
    });
  }

  if (a.soleEarner) {
    factor *= SAFE_EMI_MODIFIERS.soleEarner;
    factorNotes.push('cut because you are the only earner');
  }
  if ((a.largeExpenseNext12m ?? 0) > 0) {
    factor *= SAFE_EMI_MODIFIERS.largeExpenseComing;
    factorNotes.push(`cut because you expect a ${formatINR(a.largeExpenseNext12m!)} expense this year`);
  }
  if (a.incomeType === 'salaried' && (a.yearsAtCurrentEmployer ?? 99) < 1) {
    factor *= SAFE_EMI_MODIFIERS.jobUnderOneYear;
    factorNotes.push('cut because you have been in this job under a year');
  }

  factor = Math.min(factor, SAFE_EMI_FACTOR_CEILING);

  const baseSafeEmi = Math.max(0, surplus * factor);
  reasons.push({
    ruleId: 'SAFE.factor',
    text: `We let a new EMI take ${(factor * 100).toFixed(
      0,
    )}% of that surplus (${factorNotes.join(', ')}), which is ${formatINR(
      baseSafeEmi,
    )} a month. The rest of the surplus is what absorbs a bad month.`,
  });

  // --- Productive-loan credit -------------------------------------------
  let productiveIncomeCredit = 0;
  const isProductive = a.purpose ? PRODUCTIVE_PURPOSES.includes(a.purpose) : false;

  if (isProductive && (a.expectedAdditionalMonthlyIncome ?? 0) > 0) {
    const gross = a.expectedAdditionalMonthlyIncome!;
    const cost = a.expectedAdditionalMonthlyCost ?? 0;
    const net = Math.max(0, gross - cost);
    productiveIncomeCredit = net * PRODUCTIVE_INCOME_DISCOUNT;

    reasons.push({
      ruleId: 'VERDICT.productiveCredit',
      text: `This loan is meant to earn: you expect ${formatINR(gross)} more a month at ${formatINR(
        cost,
      )} of extra running cost. We count half of the ${formatINR(net)} net gain (${formatINR(
        productiveIncomeCredit,
      )}), because a projection is not a payslip, and we never let projected income cover more than ${(
        PRODUCTIVE_CREDIT_MAX_SHARE * 100
      ).toFixed(0)}% of the EMI.`,
    });
  } else if (isProductive) {
    assumptions.push({
      ruleId: 'VERDICT.productiveCredit',
      text: 'This loan is meant to generate income, but you did not tell us how much. We gave it no credit, so the safe amount shown is the pessimistic case.',
      wouldNarrowIfAnswered: 'expectedAdditionalMonthlyIncome',
    });
  }

  // Projected income may at most double what existing income supports.
  const productiveCap = baseSafeEmi / (1 - PRODUCTIVE_CREDIT_MAX_SHARE);
  let safeMaxEmi = Math.min(baseSafeEmi + productiveIncomeCredit, productiveCap);

  // --- Absolute backstop -------------------------------------------------
  const hardCeiling = Math.max(
    0,
    (income.householdMonthly * BORROWER_TOTAL_EMI_CEILING_PCT) / 100 - existingEmi,
  );
  if (safeMaxEmi > hardCeiling) {
    reasons.push({
      ruleId: 'SAFE.totalCeiling',
      text: `We also cap total EMIs at ${BORROWER_TOTAL_EMI_CEILING_PCT}% of reliable income whatever the surplus says, which limits a new EMI to ${formatINR(
        hardCeiling,
      )}.`,
    });
    safeMaxEmi = hardCeiling;
  }

  return {
    foirPct,
    lenderMaxEmi,
    safeMaxEmi: Math.max(0, safeMaxEmi),
    surplus,
    expensesUsed: exp.value,
    productiveIncomeCredit,
    reasons,
    assumptions,
  };
}
