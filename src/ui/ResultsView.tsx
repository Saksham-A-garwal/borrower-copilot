import type { Assessment } from '../rules/types';
import { formatINR, formatINRShort, formatPct } from '../rules/finance';

const VERDICT_LABEL: Record<Assessment['o1']['verdict'], string> = {
  BORROW: 'Borrow',
  BORROW_LESS: 'Borrow less',
  DONT_BORROW: "Don't borrow",
};

const CONFIDENCE_ICON: Record<Assessment['confidence'], string> = {
  low: '●',
  medium: '●',
  high: '●',
};

const CONFIDENCE_STATEMENT: Record<Assessment['confidence'], string> = {
  low: 'Wide ranges — only the required questions were answered.',
  medium: 'Moderate confidence — some optional questions were skipped.',
  high: 'Tight ranges — most relevant questions were answered.',
};

export function ResultsView({
  assessment: r,
  answeredCount,
  relevantCount,
  onEditAnswers,
}: {
  assessment: Assessment;
  answeredCount: number;
  relevantCount: number;
  onEditAnswers: () => void;
}) {
  const bandSpanFloor = Math.min(r.product.rate.point - 6, r.o3.fairBand.low - 1);
  const bandSpanCeil = Math.max(r.product.rate.point + 8, r.o3.fairBand.high + 1);
  const bandTotal = bandSpanCeil - bandSpanFloor;
  const leftPct = ((r.o3.fairBand.low - bandSpanFloor) / bandTotal) * 100;
  const widthPct = ((r.o3.fairBand.high - r.o3.fairBand.low) / bandTotal) * 100;

  return (
    <div>
      <div className={`confidence-banner ${r.confidence}`}>
        <span className={`dot ${r.confidence}`} />
        <span>
          <b>{answeredCount}/{relevantCount} questions answered.</b> {CONFIDENCE_STATEMENT[r.confidence]}
        </span>
      </div>

      <div className="summary-bar">
        <div className="summary-pill">
          Product: <b>{r.product.name}</b> {r.product.secured ? '(secured)' : '(unsecured)'}
        </div>
        <div className="summary-pill">
          Tenure: <b>{r.product.tenureMonths} months</b>
        </div>
        {r.affordability.foirPct > 0 && (
          <div className="summary-pill">
            Lender FOIR: <b>{r.affordability.foirPct}%</b>
          </div>
        )}
      </div>

      {r.routingNote && (
        <div className="card" style={{ borderColor: 'rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.06)' }}>
          <div className="section-title">🧭 Why this product</div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)' }}>{r.routingNote}</p>
        </div>
      )}

      {/* O1 */}
      <div className={`verdict-hero ${r.o1.verdict}`}>
        <span className={`verdict-badge ${r.o1.verdict}`}>{VERDICT_LABEL[r.o1.verdict]}</span>
        <div className="verdict-headline">{r.o1.headline}</div>
        {r.o1.hardStops.length > 0 && (
          <ul className="reason-list">
            {r.o1.hardStops.map((h, i) => (
              <li key={i} className="stop">{h.text}</li>
            ))}
          </ul>
        )}
        {r.o1.reasons.length > 0 && (
          <ul className="reason-list">
            {r.o1.reasons.map((h, i) => (
              <li key={i} className={h.ruleId.startsWith('ADVICE') ? 'advice' : ''}>{h.text}</li>
            ))}
          </ul>
        )}
      </div>

      {r.pathToYes && (
        <div className="card">
          <div className="section-title">🛤️ Your path to yes <span className="otag">~{r.pathToYes.timelineMonths} months</span></div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 0.4rem' }}>
            Following these steps could raise what you can safely borrow to about <b style={{ color: 'var(--accent)' }}>{formatINRShort(r.pathToYes.unlocksAmount)}</b>.
          </p>
          <ol className="path-steps">
            {r.pathToYes.steps.map((s, i) => (
              <li key={i}>
                <div className="action">{s.action}</div>
                <div className="effect">{s.effect}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* O2 */}
      <div className="card">
        <div className="section-title">💰 How much <span className="otag">O2</span></div>
        <div className="amount-grid">
          <div className="amount-box">
            <div className="lbl">A lender will likely sanction</div>
            <div className="val">{formatINRShort(r.o2.lenderWillLikelySanction)}</div>
            <div className="sub">Based on income vs EMI rules alone</div>
          </div>
          <div className="amount-box use">
            <div className="lbl">You can safely carry — use this</div>
            <div className="val">{formatINRShort(r.o2.borrowerCanSafelyCarry)}</div>
            <div className="sub">Based on your real cash flow</div>
          </div>
        </div>
        <ul className="reason-list">
          {r.o2.reasons.slice(-1).map((h, i) => (
            <li key={i}>{h.text}</li>
          ))}
        </ul>
      </div>

      {/* O3 */}
      <div className="card">
        <div className="section-title">📊 Fair rate <span className="otag">O3</span></div>
        <div className="rate-band-visual">
          <div className="rate-band-fill" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%` }} />
        </div>
        <div className="rate-band-labels">
          <span>{formatPct(bandSpanFloor)}</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
            Fair: {formatPct(r.o3.fairBand.low, 2)} – {formatPct(r.o3.fairBand.high, 2)}
          </span>
          <span>{formatPct(bandSpanCeil)}</span>
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.88rem' }}>
          <b>All-in APR (with fees): {formatPct(r.o3.allInAprBand.low, 2)} – {formatPct(r.o3.allInAprBand.high, 2)}</b>
        </div>
        <ul className="fee-list">
          {r.o3.feeBreakdown.map((f, i) => (
            <li key={i}>
              <span>{f.label}</span>
              <span>{formatINR(f.amount)}</span>
            </li>
          ))}
          <li>
            <span>Total upfront cost</span>
            <span>{formatINR(r.o3.feeBreakdown.reduce((s, f) => s + f.amount, 0))}</span>
          </li>
        </ul>

        {r.o3.quoteComparison && (
          <div className={`quote-box ${r.o3.quoteComparison.verdict}`}>
            {r.o3.reasons.find((x) => x.ruleId === 'O3.quote')?.text}
          </div>
        )}
      </div>

      {/* O4 */}
      <div className="card">
        <div className="section-title">🧮 EMI ceiling <span className="otag">O4</span></div>
        <div className="amount-grid">
          <div className="amount-box use">
            <div className="lbl">Never agree above</div>
            <div className="val">{formatINR(r.o4.ceilingEmi)}/mo</div>
          </div>
          <div className="amount-box">
            <div className="lbl">Recommended EMI at this amount</div>
            <div className="val">{formatINR(r.o4.recommendedEmi)}/mo</div>
          </div>
        </div>
        <ul className="reason-list">
          {r.o4.reasons.map((h, i) => (
            <li key={i}>{h.text}</li>
          ))}
        </ul>

        <table className="tenure-table">
          <thead>
            <tr><th>Tenure</th><th>EMI</th><th>Total interest</th></tr>
          </thead>
          <tbody>
            {r.o4.tenureOptions.map((t) => (
              <tr
                key={t.months}
                className={t.months === r.product.tenureMonths ? 'recommended' : t.withinCeiling ? '' : 'over'}
              >
                <td>{t.months} mo</td>
                <td>{formatINR(t.emi)}</td>
                <td>{formatINR(t.totalInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="stress-list">
          {r.o4.stressCases.map((s, i) => (
            <div key={i} className={`stress-item ${s.survives ? '' : 'fail'}`}>
              <span className="stress-icon">{s.survives ? '✅' : '⚠️'}</span>
              <div>
                <div className="lbl">{s.label}</div>
                <div>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {r.alternatives.length > 0 && (
        <div className="card">
          <div className="section-title">🔀 Other products considered</div>
          {r.alternatives.map((alt) => (
            <div className="alt-row" key={alt.code}>
              <div>
                <div className="name">{alt.name}</div>
                <div className="why">
                  {alt.eligible
                    ? `Up to ${formatINRShort(alt.safeMaxAmount)} at ~${alt.rate.point.toFixed(1)}%`
                    : alt.ineligibleReason}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {r.assumptions.length > 0 && (
        <div className="card">
          <div className="section-title">🔍 What we assumed</div>
          <ul className="assumption-list">
            {r.assumptions.map((a, i) => (
              <li key={i}>{a.text}</li>
            ))}
          </ul>
        </div>
      )}

      <NegotiationCardView r={r} />

      <div className="nav-row">
        <button className="btn btn-ghost" onClick={onEditAnswers}>
          ← Answer more questions to narrow this
        </button>
      </div>
    </div>
  );
}

export function NegotiationCardView({ r }: { r: Assessment }) {
  if (!r.card.readyToNegotiate) {
    return (
      <div className="card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="section-title">🗂️ Negotiation card</div>
        <div className="negotiation-card" id="negotiation-card">
          <h2>Not ready to negotiate yet</h2>
          <div className="sub">{r.card.borrowerLabel}</div>
          <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{r.card.notReadyReason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
      <div className="section-title">🗂️ Negotiation card — screenshot this</div>
      <div className="negotiation-card" id="negotiation-card">
        <h2>{r.card.productName}</h2>
        <div className="sub">{r.card.borrowerLabel}</div>

        <div className="nc-grid">
          <div className="nc-item">
            <div className="lbl">Amount to ask for</div>
            <div className="val">{formatINRShort(r.card.recommendedAmount)}</div>
          </div>
          <div className="nc-item">
            <div className="lbl">Tenure</div>
            <div className="val">{r.card.tenureMonths} months</div>
          </div>
          <div className="nc-item">
            <div className="lbl">Fair rate for me</div>
            <div className="val">{formatPct(r.card.fairRateBand.low, 1)}–{formatPct(r.card.fairRateBand.high, 1)}</div>
          </div>
          <div className="nc-item">
            <div className="lbl">Max all-in APR I accept</div>
            <div className="val">{formatPct(r.card.maxAprAccepted, 2)}</div>
          </div>
          <div className="nc-item">
            <div className="lbl">Max EMI I will sign</div>
            <div className="val">{formatINR(r.card.maxEmi)}</div>
          </div>
          <div className="nc-item">
            <div className="lbl">Max processing fee</div>
            <div className="val">{formatINR(r.card.maxProcessingFee)} + GST</div>
          </div>
        </div>

        <div className="nc-because">
          <h4>Why</h4>
          <ul>
            {r.card.becauseLines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="nc-walk">
          <h4>Walk away if</h4>
          <ul>
            {r.card.walkAwayIf.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
