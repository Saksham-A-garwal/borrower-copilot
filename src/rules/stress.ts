/**
 * Stress cases. Two shocks an Indian retail borrower actually meets: a
 * repo-linked rate reset, and a lost month of work or a lost incentive.
 *
 * The point is not the arithmetic. It is that the borrower sees, before
 * signing, which of these breaks them.
 */

import { BORROWER_TOTAL_EMI_CEILING_PCT, STRESS_CASES } from './constants';
import { emi, formatINR } from './finance';
import type { AffordabilityAssessment, Answers, IncomeAssessment, StressCase } from './types';

export function buildStressCases(
  a: Answers,
  amount: number,
  ratePct: number,
  tenureMonths: number,
  income: IncomeAssessment,
  afford: AffordabilityAssessment,
  /** True when we recommend nothing, so these stress the REQUESTED loan. */
  stressingRequestedLoan = false,
): StressCase[] {
  const cases: StressCase[] = [];
  const existingEmi = a.existingEmiTotal ?? 0;
  const baseEmi = emi(amount, ratePct, tenureMonths);

  if (stressingRequestedLoan) {
    cases.push({
      label: 'The loan you asked for, before any shock',
      detail: `${formatINR(amount)} over ${tenureMonths} months at ${ratePct.toFixed(
        2,
      )}% is an EMI of ${formatINR(baseEmi)}. Your surplus after living costs and existing EMIs is ${formatINR(
        afford.surplus,
      )}. That is the gap this loan would have to be paid out of, and it is why the answer above is no.`,
      survives: afford.surplus >= baseEmi,
    });
  }

  // --- Rate rises --------------------------------------------------------
  const stressedRate = ratePct + STRESS_CASES.rateRisePp;
  const stressedEmi = emi(amount, stressedRate, tenureMonths);
  const rateHeadroom = afford.surplus - (stressedEmi + 0);
  cases.push({
    label: `If your rate rises by ${STRESS_CASES.rateRisePp} points`,
    detail: `At ${stressedRate.toFixed(2)}% your EMI becomes ${formatINR(
      stressedEmi,
    )}, up ${formatINR(stressedEmi - baseEmi)} a month. ${
      rateHeadroom >= 0
        ? `Your surplus still covers it with ${formatINR(rateHeadroom)} to spare.`
        : `That is ${formatINR(Math.abs(rateHeadroom))} more than your surplus can absorb. Ask for a fixed rate, or borrow less.`
    }`,
    survives: rateHeadroom >= 0,
  });

  // --- Income falls ------------------------------------------------------
  const dropPct =
    a.incomeType === 'informal' || a.incomeType === 'self_employed'
      ? STRESS_CASES.informalIncomeDropPct
      : STRESS_CASES.incomeDropPct;
  const reducedIncome = income.householdMonthly * (1 - dropPct / 100);
  const totalEmiAfter = baseEmi + existingEmi;
  const ratioAfter = reducedIncome > 0 ? (totalEmiAfter / reducedIncome) * 100 : 999;
  const survivesIncome = ratioAfter <= BORROWER_TOTAL_EMI_CEILING_PCT;

  cases.push({
    label: `If your income drops ${dropPct}%`,
    detail: `Income of ${formatINR(reducedIncome)} against ${formatINR(
      totalEmiAfter,
    )} of total EMIs is ${ratioAfter.toFixed(0)}% of what you earn. ${
      survivesIncome
        ? 'Tight, but still inside the half-of-income line.'
        : `That is past the ${BORROWER_TOTAL_EMI_CEILING_PCT}% line where EMIs start displacing essentials.`
    }`,
    survives: survivesIncome,
  });

  // --- One month with no income -----------------------------------------
  const months = a.emergencySavingsMonths;
  if (months !== undefined) {
    const needed = afford.expensesUsed + totalEmiAfter;
    const covered = months * afford.expensesUsed;
    cases.push({
      label: 'If income stops for a month',
      detail: `You would need ${formatINR(needed)} to cover that month. Your savings of about ${formatINR(
        covered,
      )} ${covered >= needed ? 'cover it.' : 'do not cover it, so the EMI would be missed.'}`,
      survives: covered >= needed,
    });
  }

  return cases;
}
