/** Quick sanity run: prints the headline numbers for each persona. */
import { assess } from '../src/rules/engine';
import { PERSONAS, PRIYA_MUSTS_ONLY } from '../src/personas';
import { formatINR, formatINRShort } from '../src/rules/finance';

for (const p of [...PERSONAS, PRIYA_MUSTS_ONLY]) {
  const r = assess(p.answers);
  console.log('='.repeat(72));
  console.log(`${p.name}  ->  ${r.product.name}  [${r.confidence} confidence, ${r.answeredCount}/${r.relevantCount}]`);
  console.log(`O1  ${r.o1.verdict}: ${r.o1.headline}`);
  if (r.o1.hardStops.length) r.o1.hardStops.forEach((h) => console.log(`    STOP ${h.ruleId}: ${h.text.slice(0, 110)}...`));
  console.log(`O2  lender ${formatINRShort(r.o2.lenderWillLikelySanction)} | safe ${formatINRShort(r.o2.borrowerCanSafelyCarry)} | use ${formatINRShort(r.o2.useThisNumber)}`);
  console.log(`O3  fair ${r.o3.fairBand.low.toFixed(2)}-${r.o3.fairBand.high.toFixed(2)}%  |  APR ${r.o3.allInAprBand.low.toFixed(2)}-${r.o3.allInAprBand.high.toFixed(2)}%`);
  console.log(`O4  ceiling ${formatINR(r.o4.ceilingEmi)} | recommended EMI ${formatINR(r.o4.recommendedEmi)} over ${r.product.tenureMonths}mo`);
  console.log(`    income: lender ${formatINR(r.income.lenderMonthly)} | borrower ${formatINR(r.income.borrowerMonthly)} | household ${formatINR(r.income.householdMonthly)}`);
  console.log(`    FOIR ${r.affordability.foirPct}% | surplus ${formatINR(r.affordability.surplus)} | safeEMI ${formatINR(r.affordability.safeMaxEmi)} | lenderEMI ${formatINR(r.affordability.lenderMaxEmi)}`);
  r.o4.stressCases.forEach((s) => console.log(`    stress ${s.survives ? 'OK  ' : 'FAIL'} ${s.label}`));
  if (r.routingNote) console.log(`    ROUTING: ${r.routingNote.slice(0, 150)}...`);
  if (r.pathToYes) console.log(`    PATH TO YES: ${r.pathToYes.steps.length} steps, ${r.pathToYes.timelineMonths}mo, unlocks ${formatINRShort(r.pathToYes.unlocksAmount)}`);
  console.log(`    alternatives: ${r.alternatives.map((x) => `${x.code}${x.eligible ? '' : '(x)'}`).join(', ')}`);
}
