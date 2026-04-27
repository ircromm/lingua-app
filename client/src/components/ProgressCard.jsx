import React from 'react';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_COLORS = {
  A1: '#94a3b8', A2: '#64748b', B1: '#3b82f6',
  B2: '#6366f1', C1: '#8b5cf6', C2: '#ec4899',
};

export default function ProgressCard({ label, level, isWeak }) {
  const idx = CEFR_LEVELS.indexOf(level);
  const pct = ((idx + 1) / CEFR_LEVELS.length) * 100;
  const color = CEFR_COLORS[level] || '#3b82f6';

  return (
    <div className={`progress-card ${isWeak ? 'progress-card--weak' : ''}`}>
      <div className="progress-card-header">
        <span className="progress-card-label">{label}</span>
        <span className="progress-card-level" style={{ color }}>
          {level}
          {isWeak && <span className="weak-indicator" title="Focus area"> ⚠️</span>}
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
