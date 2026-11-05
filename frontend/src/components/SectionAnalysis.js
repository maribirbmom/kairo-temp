import React from 'react';

const SectionAnalysis = ({ sections }) => {
  const defaultSections = {
    hard_skills: 0,
    experience_duration: 0,
    education: 0,
    soft_skills: 0,
  };

  const data = { ...defaultSections, ...sections };

  const getBarColor = (value) => {
    if (value >= 80) return 'bg-success';
    if (value >= 60) return 'bg-primary';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatLabel = (key) => {
    const labels = {
      hard_skills: 'Hard Skills',
      experience_duration: 'Experience Duration',
      education: 'Education',
      soft_skills: 'Soft Skills',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm">
      <h5 className="font-bold text-text-main mb-4 flex items-center justify-between">
        <span>Section Analysis</span>
        <span className="text-xs font-medium text-text-muted bg-page-bg px-2 py-1 rounded">Weighted</span>
      </h5>
      <div className="space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-xs font-bold text-text-muted mb-1.5">
              <span>{formatLabel(key)}</span>
              <span className="text-text-main">{value}%</span>
            </div>
            <div className="w-full bg-ui-element rounded-full h-2">
              <div
                className={`${getBarColor(value)} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionAnalysis;
