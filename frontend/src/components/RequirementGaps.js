import React from 'react';

// Requirement rows in the career-ops style: importance band + evidence tier,
// the verbatim JD quote when stated, and an interview-risk + mitigation for gaps.
const MATCH = {
  missing: { icon: 'cancel', color: 'text-danger', label: 'Missing' },
  partial: { icon: 'error', color: 'text-yellow-600', label: 'Partial' },
  met: { icon: 'check_circle', color: 'text-success', label: 'Strong' },
};
const BAND = { critical: 'Critical', high: 'High', meaningful: 'Meaningful', preferred: 'Preferred', low_signal: 'Low signal' };

const RequirementGaps = ({ requirements = [], limit, showMet = false }) => {
  const rows = requirements.filter((r) => showMet || r.status === 'missing' || r.status === 'partial');
  const shown = limit ? rows.slice(0, limit) : rows;

  if (shown.length === 0) {
    return <p className="text-sm text-text-muted">No gaps found for this role.</p>;
  }

  return (
    <ul className="space-y-2" data-testid="requirement-gaps">
      {shown.map((r, idx) => {
        const s = MATCH[r.status] || MATCH.partial;
        return (
          <li key={idx} className="bg-white p-3 rounded-xl border border-black/5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined text-base mt-0.5 ${s.color}`}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-main">{r.text}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
                  {s.label} · {BAND[r.importance] || r.importance} ({r.evidence_tier})
                </p>
                {r.jd_signal && r.evidence_tier === 'stated' && (
                  <p className="text-xs text-text-muted/80 italic mt-1">JD: “{r.jd_signal}”</p>
                )}
                {showMet && r.status === 'met' && r.evidence && (
                  <p className="text-xs text-text-muted mt-1"><span className="font-bold text-text-main">Your CV: </span>{r.evidence}</p>
                )}
                {r.status !== 'met' && r.interview_risk && (
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    <span className="font-bold text-text-main">Interview risk: </span>{r.interview_risk}
                  </p>
                )}
                {r.status !== 'met' && r.fix && (
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    <span className="font-bold text-text-main">How to close it: </span>{r.fix}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default RequirementGaps;
