/**
 * Confidence.
 *
 * Rule 2 of the brief: confidence widens with silence. A band is an honesty
 * device, not decoration, so the only way to get a narrow band here is to have
 * actually told us something. Nothing in this file ever narrows a range on the
 * strength of a default.
 */

import { CONFIDENCE_THRESHOLDS, RATE_BAND_HALF_WIDTH, AMOUNT_BAND_WIDTH_PCT } from './constants';
import { answeredStats } from './questions';
import type { Answers, Confidence } from './types';

export interface ConfidenceProfile {
  level: Confidence;
  share: number;
  answered: number;
  relevant: number;
  rateHalfWidthPp: number;
  amountWidthPct: number;
  /** Plain-language sentence the UI shows next to every band. */
  statement: string;
}

export function assessConfidence(a: Answers): ConfidenceProfile {
  const { answered, relevant, share } = answeredStats(a);

  // Linear interpolation between "musts only" and "everything answered".
  let halfWidth =
    RATE_BAND_HALF_WIDTH.mustsOnly -
    (RATE_BAND_HALF_WIDTH.mustsOnly - RATE_BAND_HALF_WIDTH.fullyAnswered) * share;

  const scoreUnknown =
    a.creditScoreBand === 'unknown' || a.creditScoreBand === 'no_history' || !a.creditScoreBand;
  if (scoreUnknown) halfWidth += RATE_BAND_HALF_WIDTH.unknownScorePenalty;

  const variableIncome = a.incomeType === 'self_employed' || a.incomeType === 'informal';
  if (variableIncome && a.worstMonthIncome === undefined) {
    halfWidth += RATE_BAND_HALF_WIDTH.unknownWorstMonthPenalty;
  }

  const amountWidthPct =
    AMOUNT_BAND_WIDTH_PCT.mustsOnly -
    (AMOUNT_BAND_WIDTH_PCT.mustsOnly - AMOUNT_BAND_WIDTH_PCT.fullyAnswered) * share;

  let level: Confidence = 'low';
  if (share >= CONFIDENCE_THRESHOLDS.high && !scoreUnknown) level = 'high';
  else if (share >= CONFIDENCE_THRESHOLDS.medium) level = 'medium';

  const bits: string[] = [
    `You answered ${answered} of the ${relevant} questions that apply to you.`,
  ];
  if (scoreUnknown) {
    bits.push('Because your credit score is unknown we widened the rate band by a full point rather than guessing it.');
  }
  if (variableIncome && a.worstMonthIncome === undefined) {
    bits.push('Because your income varies and we do not know your worst month, the safe amount is deliberately cautious.');
  }
  if (level === 'high') {
    bits.push('That is enough to give you a tight range you can negotiate against.');
  } else if (level === 'medium') {
    bits.push('Answering the remaining questions would narrow these ranges noticeably.');
  } else {
    bits.push('These ranges are wide on purpose. We will not pretend to precision we have not earned.');
  }

  return {
    level,
    share,
    answered,
    relevant,
    rateHalfWidthPp: halfWidth,
    amountWidthPct,
    statement: bits.join(' '),
  };
}
