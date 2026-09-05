/**
 * Income assessment.
 *
 * This module produces two different numbers on purpose:
 *
 *   lenderMonthly   - what an underwriter will credit after verification rules.
 *                     Driven by documents: payslips, ITR, bank statements.
 *   borrowerMonthly - what the household can actually rely on in a bad month.
 *                     Driven by reality: the worst month, not the average one.
 *
 * For a salaried borrower these are nearly the same. For a kirana owner the
 * lender's number is often HALF the truth (the ITR understates cash income),
 * and for a gig worker it is often DOUBLE the truth (the average month
 * overstates the bad one). Getting that asymmetry right is the whole point.
 */

import { INCOME_RULES } from './constants';
import type { Answers, Assumption, IncomeAssessment, Reason } from './types';
import { formatINR } from './finance';

export function assessIncome(a: Answers, secured: boolean): IncomeAssessment {
  const reasons: Reason[] = [];
  const assumptions: Assumption[] = [];
  const declared = a.netMonthlyIncome ?? 0;
  const incomeType = a.incomeType ?? 'salaried';

  let lenderMonthly = 0;
  let borrowerMonthly = 0;

  if (incomeType === 'salaried') {
    const variableShare = (a.variableIncomeSharePct ?? 0) / 100;
    const fixed = declared * (1 - variableShare);
    const variable = declared * variableShare;

    lenderMonthly = fixed + variable * INCOME_RULES.variablePayCreditLender;
    borrowerMonthly = fixed + variable * INCOME_RULES.variablePayCreditBorrower;

    if (variableShare > 0) {
      reasons.push({
        ruleId: 'INCOME.variablePay',
        text: `Of your ${formatINR(declared)} take-home, ${formatINR(variable)} is variable pay. A lender counts half of it (${formatINR(
          variable * INCOME_RULES.variablePayCreditLender,
        )}); we count a quarter (${formatINR(variable * INCOME_RULES.variablePayCreditBorrower)}) because a bad year cuts the bonus before it cuts the salary.`,
      });
    } else {
      reasons.push({
        ruleId: 'INCOME.salaried',
        text: `Your salary of ${formatINR(declared)} is verifiable from payslips and bank credits, so the lender's view and your own view of income are the same.`,
      });
      if (a.variableIncomeSharePct === undefined) {
        assumptions.push({
          ruleId: 'INCOME.variablePay',
          text: 'We assumed your pay is entirely fixed. If a large share is bonus or incentive, your safe number is lower than shown.',
          wouldNarrowIfAnswered: 'variableIncomeSharePct',
        });
      }
    }
  }

  if (incomeType === 'self_employed') {
    const documented = a.itrAnnualIncome ? a.itrAnnualIncome / 12 : declared;
    const surrogate = a.avgMonthlyBankCredits
      ? a.avgMonthlyBankCredits * INCOME_RULES.bankingSurrogateMargin
      : 0;

    // Unsecured underwriting reads the ITR. Secured/LAP programmes may size
    // income off banked turnover instead, which is usually kinder.
    lenderMonthly = secured && surrogate > 0 ? Math.max(documented, surrogate) : documented;

    borrowerMonthly =
      a.worstMonthIncome ?? Math.max(documented, declared * INCOME_RULES.borrowerCashHaircut);

    if (a.itrAnnualIncome && declared > documented * 1.2) {
      reasons.push({
        ruleId: 'INCOME.itrGap',
        text: `You earn about ${formatINR(declared)} a month but your ITR shows ${formatINR(
          documented,
        )}. An unsecured lender can only lend against the ITR figure, which is why an unsecured loan will look far too small for your real business.`,
      });
    }
    if (secured && surrogate > documented) {
      reasons.push({
        ruleId: 'INCOME.surrogate',
        text: `Because this loan is backed by property, the lender can size your income from banked turnover instead of your ITR: ${formatINR(
          a.avgMonthlyBankCredits ?? 0,
        )} of monthly credits at a ${(INCOME_RULES.bankingSurrogateMargin * 100).toFixed(
          0,
        )}% margin gives ${formatINR(surrogate)}.`,
      });
    }
    if (a.worstMonthIncome === undefined) {
      assumptions.push({
        ruleId: 'INCOME.worstMonth',
        text: `We assumed your worst month is about ${formatINR(
          borrowerMonthly,
        )}. Telling us the actual lowest month in the last year will tighten your safe amount.`,
        wouldNarrowIfAnswered: 'worstMonthIncome',
      });
    }
    if (!a.avgMonthlyBankCredits) {
      assumptions.push({
        ruleId: 'INCOME.surrogate',
        text: 'We had no bank-credit figure, so we sized the lender view from your ITR alone. Average monthly credits into your business account could raise the amount a secured lender offers.',
        wouldNarrowIfAnswered: 'avgMonthlyBankCredits',
      });
    }
  }

  if (incomeType === 'informal') {
    const bankedShare = (a.bankedIncomeSharePct ?? 0) / 100;
    // Fully cash income gets the floor credit; fully banked income gets full
    // credit, scaling linearly in between.
    const verificationCredit =
      INCOME_RULES.informalUnverifiedFloor +
      (1 - INCOME_RULES.informalUnverifiedFloor) * bankedShare;

    lenderMonthly = declared * verificationCredit;
    borrowerMonthly = a.worstMonthIncome ?? declared * INCOME_RULES.borrowerCashHaircut;

    reasons.push({
      ruleId: 'INCOME.informalHaircut',
      text: `Because ${(bankedShare * 100).toFixed(
        0,
      )}% of your income reaches a bank account, a lender will only credit you with ${formatINR(
        lenderMonthly,
      )} of your ${formatINR(declared)}. Taking more payments into the account directly raises this number.`,
    });

    if (a.worstMonthIncome === undefined) {
      assumptions.push({
        ruleId: 'INCOME.worstMonth',
        text: `We assumed a bad month is about ${formatINR(
          borrowerMonthly,
        )}. Your actual worst month in the last year would make this precise.`,
        wouldNarrowIfAnswered: 'worstMonthIncome',
      });
    }
    if (a.bankedIncomeSharePct === undefined) {
      assumptions.push({
        ruleId: 'INCOME.informalHaircut',
        text: 'We assumed none of your income is banked, which is the most conservative case. If you are paid into an account, say so: it raises what a lender will sanction.',
        wouldNarrowIfAnswered: 'bankedIncomeSharePct',
      });
    }
  }

  // Co-applicant: allowed on secured products, generally not on unsecured ones.
  const coApplicant = a.coApplicantIncome ?? 0;
  const coApplicantCredit = secured
    ? INCOME_RULES.coApplicantCreditSecured
    : INCOME_RULES.coApplicantCreditUnsecured;

  if (coApplicant > 0) {
    lenderMonthly += coApplicant * coApplicantCredit;
    if (secured) {
      reasons.push({
        ruleId: 'INCOME.coApplicant',
        text: `Your co-applicant's ${formatINR(
          coApplicant,
        )} counts in full because this is a secured loan, raising the income the lender assesses to ${formatINR(
          lenderMonthly,
        )}.`,
      });
    } else {
      reasons.push({
        ruleId: 'INCOME.coApplicant',
        text: `Your co-applicant's ${formatINR(
          coApplicant,
        )} does not count here: most unsecured personal-loan programmes in India do not accept a co-applicant. It still counts towards what your household can safely repay.`,
      });
    }
  }

  // The household view always counts every earner, because the household also
  // pays every expense.
  const householdMonthly = borrowerMonthly + coApplicant;

  return {
    lenderMonthly: Math.max(0, lenderMonthly),
    borrowerMonthly: Math.max(0, borrowerMonthly),
    householdMonthly: Math.max(0, householdMonthly),
    reasons,
    assumptions,
  };
}
