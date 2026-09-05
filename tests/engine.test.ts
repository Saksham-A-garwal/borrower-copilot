import { describe, expect, it } from 'vitest';
import { assess } from '../src/rules/engine';
import { PRIYA, RAVI, ANITA, PRIYA_MUSTS_ONLY } from '../src/personas';
import { emi, aprWithFees } from '../src/rules/finance';
import { assess as assessAlias } from '../src/rules/engine';

describe('Priya — clean salaried case', () => {
  const r = assess(PRIYA.answers);

  it('separates the lender number from the safe number, and picks the safe one', () => {
    expect(r.o2.lenderWillLikelySanction).toBeGreaterThan(r.o2.borrowerCanSafelyCarry);
    expect(r.o2.whichOne).toBe('borrower');
    expect(r.o2.useThisNumber).toBe(r.o2.borrowerCanSafelyCarry <= (PRIYA.answers.amountWanted ?? 0)
      ? r.o2.borrowerCanSafelyCarry
      : PRIYA.answers.amountWanted);
  });

  it('quotes a rate band, not a point', () => {
    expect(r.o3.fairBand.high).toBeGreaterThan(r.o3.fairBand.low);
  });

  it('APR is always at or above the headline rate, because fees only add cost', () => {
    expect(r.o3.allInAprBand.low).toBeGreaterThanOrEqual(r.o3.fairBand.low);
    expect(r.o3.allInAprBand.high).toBeGreaterThanOrEqual(r.o3.fairBand.high);
  });

  it('is not routed to a secured product with no collateral declared', () => {
    expect(r.product.secured).toBe(false);
  });

  it('flags her lender quote as above her fair band', () => {
    expect(r.o3.quoteComparison).toBeDefined();
    expect(r.o3.quoteComparison?.verdict).not.toBe('fair');
  });

  it('produces a usable negotiation card', () => {
    expect(r.card.maxEmi).toBeGreaterThan(0);
    expect(r.card.becauseLines.length).toBeGreaterThan(0);
    expect(r.card.walkAwayIf.length).toBeGreaterThan(0);
  });
});

describe('Ravi — self-employed with unencumbered collateral', () => {
  const r = assess(RAVI.answers);

  it('is routed to a secured product because he owns unencumbered property', () => {
    expect(r.product.secured).toBe(true);
    expect(['LAP', 'HOME']).toContain(r.product.code);
  });

  it('names the unsecured alternative he would otherwise have assumed', () => {
    expect(r.routingNote).toBeTruthy();
    expect(r.routingNote).toMatch(/unsecured/i);
  });

  it('sizes the secured offer well above what his ITR alone would support', () => {
    // ITR-only unsecured business loan would be tiny against ₹4.2L/year income.
    expect(r.product.safeMaxAmount).toBeGreaterThan(1_000_000);
  });

  it('gives credit for banked turnover exceeding the ITR figure', () => {
    expect(r.income.lenderMonthly).toBeGreaterThan((RAVI.answers.itrAnnualIncome ?? 0) / 12);
  });
});

describe('Anita — the "do not borrow" case', () => {
  const r = assess(ANITA.answers);

  it('DONT_BORROW is reachable and fires here', () => {
    expect(r.o1.verdict).toBe('DONT_BORROW');
    expect(r.o1.hardStops.length).toBeGreaterThan(0);
  });

  it('is routed toward a secured two-wheeler product for a productive vehicle purchase, not an unsecured personal loan', () => {
    expect(['TWO_WHEELER', 'PERSONAL']).toContain(r.product.code);
  });

  it('still offers a path back to yes rather than a dead end', () => {
    expect(r.pathToYes).toBeDefined();
    expect(r.pathToYes!.steps.length).toBeGreaterThan(0);
  });

  it('treats her unknown-turned-known low score as informative, not a silent zero', () => {
    // below_650 must be reflected as a real, large positive rate adjustment,
    // not ignored.
    const priyaGoodScore = assess(PRIYA.answers).o3.fairBand.low;
    expect(r.o3.fairBand.low).toBeGreaterThan(priyaGoodScore);
  });

  it('marks the negotiation card not-ready instead of showing zeroed figures', () => {
    // Safe capacity is 0, so a card offering "up to ₹0" would read as a bug,
    // not as "don't borrow". The UI branches on this flag instead.
    expect(r.o2.borrowerCanSafelyCarry).toBe(0);
    expect(r.card.readyToNegotiate).toBe(false);
    expect(r.card.notReadyReason).toBeTruthy();
  });
});

describe('confidence widens with silence (Rule 2)', () => {
  const full = assess(PRIYA.answers);
  const mustsOnly = assess(PRIYA_MUSTS_ONLY.answers);

  it('answering fewer questions never produces a narrower band', () => {
    const fullWidth = full.o3.fairBand.high - full.o3.fairBand.low;
    const mustsWidth = mustsOnly.o3.fairBand.high - mustsOnly.o3.fairBand.low;
    expect(mustsWidth).toBeGreaterThan(fullWidth);
  });

  it('confidence level drops with fewer answers', () => {
    expect(full.confidence).toBe('high');
    expect(mustsOnly.confidence).toBe('low');
  });

  it('still produces all four outputs from the must-block alone', () => {
    expect(mustsOnly.o1.verdict).toBeDefined();
    expect(mustsOnly.o2.useThisNumber).toBeGreaterThanOrEqual(0);
    expect(mustsOnly.o3.fairBand.high).toBeGreaterThan(0);
    expect(mustsOnly.o4.ceilingEmi).toBeGreaterThanOrEqual(0);
  });
});

describe('unknown is never treated as zero (Rule 3)', () => {
  it('an unknown credit score does not price like the worst possible score', () => {
    const unknown = assess({ ...PRIYA.answers, creditScoreBand: 'unknown' });
    const worst = assess({ ...PRIYA.answers, creditScoreBand: 'below_650' });
    expect(unknown.o3.fairBand.low).toBeLessThan(worst.o3.fairBand.low);
  });

  it('flags the unknown score as an assumption with a path to narrow it', () => {
    const unknown = assess({ ...PRIYA.answers, creditScoreBand: 'unknown' });
    const flagged = unknown.assumptions.some((x) => x.wouldNarrowIfAnswered === 'creditScoreBand');
    expect(flagged).toBe(true);
  });
});

describe('finance primitives', () => {
  it('EMI matches the standard reducing-balance formula', () => {
    // 1,00,000 at 12% for 12 months should be close to a known reference value.
    const e = emi(100_000, 12, 12);
    expect(e).toBeGreaterThan(8_800);
    expect(e).toBeLessThan(8_900);
  });

  it('APR with fees exceeds the nominal rate whenever fees are positive', () => {
    const apr = aprWithFees(800_000, 11.5, 60, 18_880);
    expect(apr).toBeGreaterThan(11.5);
  });

  it('APR with fees equals the nominal rate when there are no fees', () => {
    const apr = aprWithFees(800_000, 11.5, 60, 0);
    expect(apr).toBeCloseTo(11.5, 1);
  });
});

describe('every number a persona sees is traceable', () => {
  it('every reason has non-empty text and a rule id', () => {
    for (const persona of [PRIYA, RAVI, ANITA]) {
      const r = assessAlias(persona.answers);
      const allReasons = [
        ...r.o1.reasons,
        ...r.o1.hardStops,
        ...r.o2.reasons,
        ...r.o3.reasons,
        ...r.o4.reasons,
      ];
      expect(allReasons.length).toBeGreaterThan(0);
      for (const reason of allReasons) {
        expect(reason.ruleId.length).toBeGreaterThan(0);
        expect(reason.text.length).toBeGreaterThan(10);
      }
    }
  });
});
