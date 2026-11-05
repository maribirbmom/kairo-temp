import React from 'react';

const MatchScoreCircle = ({ score, size = 'large' }) => {
  const radius = size === 'large' ? 40 : 15.9155;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getScoreColor = () => {
    if (score >= 80) return '#4A7C59'; // success
    if (score >= 60) return '#E06F4F'; // primary/orange
    if (score >= 40) return '#D97706'; // warning
    return '#DC2626'; // danger
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 70) return 'Strong Potential';
    if (score >= 50) return 'Good Match';
    if (score >= 30) return 'Partial Match';
    return 'Low Match';
  };

  if (size === 'small') {
    return (
      <div className="relative size-14 bg-gray-800 rounded-full flex items-center justify-center">
        <svg className="size-full -rotate-90 p-1" viewBox="0 0 36 36">
          <path
            className="text-gray-600"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            style={{ color: '#facc15' }}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xs font-bold text-white">{score}%</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-black/5 flex items-center justify-between relative overflow-hidden">
      <div className="absolute right-0 top-0 w-32 h-32 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div>
        <p className="text-sm font-semibold text-text-muted mb-1">Match Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl md:text-5xl font-extrabold text-text-main">{Math.round(score)}</span>
          <span className="text-lg text-text-muted font-medium">/ 100</span>
        </div>
        <div 
          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
          style={{
            backgroundColor: `${getScoreColor()}15`,
            color: getScoreColor(),
            borderColor: `${getScoreColor()}30`
          }}
        >
          <span 
            className="size-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: getScoreColor() }}
          ></span>
          {getScoreLabel()}
        </div>
      </div>
      <div className="relative size-20 md:size-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#E5E0DC"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={getScoreColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <span className="material-symbols-outlined absolute text-3xl" style={{ color: getScoreColor() }}>star</span>
      </div>
    </div>
  );
};

export default MatchScoreCircle;
