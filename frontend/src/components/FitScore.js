import React from 'react';

// Score scale, 4.0 apply threshold and decision labels adapted from career-ops (MIT):
// https://github.com/career-ops-hq/career-ops
export const APPLY_THRESHOLD = 4.0;

const TONES = {
  Apply: { text: 'text-success', bg: 'bg-success/10', bar: '#4A7C59', icon: 'check_circle' },
  Consider: { text: 'text-yellow-600', bg: 'bg-yellow-500/10', bar: '#D97706', icon: 'help' },
  'Research first': { text: 'text-yellow-600', bg: 'bg-yellow-500/10', bar: '#D97706', icon: 'search' },
  Skip: { text: 'text-danger', bg: 'bg-danger/10', bar: '#DC2626', icon: 'do_not_disturb_on' },
};

const FitScore = ({ screening, fallbackPercent = 0 }) => {
  if (!screening || screening.score == null) {
    return (
      <div className="flex-1 bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col justify-center items-center text-center">
        <p className="text-4xl font-bold text-text-main">{Math.round(fallbackPercent)}%</p>
        <p className="text-xs text-text-muted mt-1">Keyword match (no AI score available)</p>
      </div>
    );
  }

  const { score, label, confidence, engine, score_range: range, unstable, fallback_reason: fallbackReason } = screening;
  const decision = screening.decision || (screening.verdict === 'apply' ? 'Apply' : 'Skip');
  const t = TONES[decision] || TONES.Skip;

  return (
    <div className="flex-1 bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col gap-3" data-testid="fit-score">
      <div className="flex items-baseline gap-1">
        <span className={`text-5xl font-bold ${t.text}`} data-testid="fit-score-value">{score.toFixed(1)}</span>
        <span className="text-lg font-semibold text-text-muted">/ 5</span>
      </div>

      <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(score / 5) * 100}%`, background: t.bar }} />
      </div>

      <div className={`inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-sm font-bold ${t.bg} ${t.text}`} data-testid="fit-verdict">
        <span className="material-symbols-outlined text-base">{t.icon}</span>
        {decision}
      </div>

      <p className="text-sm text-text-muted">{label}</p>
      {range && range[0] !== range[1] && (
        <p className="text-xs text-text-muted" data-testid="score-range">
          {unstable ? 'Two runs disagreed: ' : 'Across two runs: '}{range[0].toFixed(1)} to {range[1].toFixed(1)}
        </p>
      )}
      {fallbackReason && (
        <p className="text-xs text-amber-700" data-testid="fallback-reason">AI scoring was unavailable ({fallbackReason}).</p>
      )}
      <p className="text-xs text-text-muted/80">
        Evidence confidence: <span className="font-semibold capitalize">{confidence}</span>
        {engine === 'heuristic' && ' · keyword estimate only'}
        {' · '}Apply at {APPLY_THRESHOLD.toFixed(1)}+
      </p>
      <p className="text-[11px] text-text-muted/70 leading-snug border-t border-black/5 pt-2" data-testid="score-disclaimer">
        Technical fit only. Personal details are removed for privacy and never count against you.
        Compensation and company culture aren't assessed.
      </p>
    </div>
  );
};

export default FitScore;
