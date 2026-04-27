import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import ProgressCard from '../components/ProgressCard.jsx';
import DeckReview from '../components/DeckReview.jsx';

const AXIS_LABELS = {
  vocabulary: '📚 Vocabulary',
  grammar: '📐 Grammar',
  reading_comprehension: '📖 Reading',
  written_production: '✍️ Writing',
};

const CEFR_COLORS = {
  A1: '#94a3b8', A2: '#64748b', B1: '#3b82f6',
  B2: '#6366f1', C1: '#8b5cf6', C2: '#ec4899',
};

export default function Dashboard() {
  const { language } = useParams();
  const { user, logout, darkMode, setDarkMode } = useApp();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [langInfo, setLangInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeck, setShowDeck] = useState(false);

  const load = async () => {
    try {
      const [dashData, langsData] = await Promise.all([
        api.getDashboard(user.id, language),
        api.getLanguages(),
      ]);
      setData(dashData);
      setLangInfo(langsData.languages.find((l) => l.code === language));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [language]);

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-center">
        <p>Failed to load dashboard. <button className="btn btn-ghost" onClick={load}>Retry</button></p>
      </div>
    );
  }

  const { stats, axisLevels, weakAreas, recentLessons, dueCards } = data;
  const xpProgress = stats.xpForNext
    ? Math.min(100, (stats.xp / stats.xpForNext) * 100)
    : 100;

  if (showDeck) {
    return (
      <DeckReview
        userId={user.id}
        language={language}
        onClose={() => { setShowDeck(false); load(); }}
      />
    );
  }

  return (
    <div className="dashboard-page">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate('/languages')}>
          ← Languages
        </button>
        <div className="header-center">
          <span>{langInfo?.flag} {langInfo?.name}</span>
        </div>
        <div className="header-right">
          <span className="user-badge">{user.nickname}</span>
          <button className="btn btn-ghost" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value" style={{ color: CEFR_COLORS[stats.level] }}>
              {stats.level}
            </span>
            <span className="stat-label">Level</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.xp.toLocaleString()}</span>
            <span className="stat-label">XP</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">🔥 {stats.streak}</span>
            <span className="stat-label">Day Streak</span>
          </div>
          {dueCards > 0 && (
            <div className="stat-card stat-card--alert" onClick={() => setShowDeck(true)}>
              <span className="stat-value">{dueCards}</span>
              <span className="stat-label">Cards Due</span>
            </div>
          )}
        </div>

        {/* XP Progress */}
        {stats.nextLevel && (
          <div className="xp-progress-section">
            <div className="xp-progress-header">
              <span>Progress to {stats.nextLevel}</span>
              <span>{stats.xp} / {stats.xpForNext} XP</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        )}

        {/* Skill Breakdown */}
        <div className="section-card">
          <h3>Skill Breakdown</h3>
          {Object.entries(axisLevels).map(([axis, lvl]) => (
            <ProgressCard
              key={axis}
              label={AXIS_LABELS[axis]}
              level={lvl}
              isWeak={weakAreas.includes(axis)}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="btn btn-primary btn-large"
            onClick={() => navigate(`/lesson/${language}`)}
          >
            🎓 Start Lesson
          </button>

          {dueCards > 0 && (
            <button
              className="btn btn-secondary btn-large"
              onClick={() => setShowDeck(true)}
            >
              🃏 Review Cards ({dueCards} due)
            </button>
          )}

          {!data.hasPlacement && (
            <button
              className="btn btn-ghost"
              onClick={() => navigate(`/placement/${language}`)}
            >
              Take Placement Test
            </button>
          )}
        </div>

        {/* Recent Lessons */}
        {recentLessons.length > 0 && (
          <div className="section-card">
            <h3>Recent Lessons</h3>
            <div className="lessons-list">
              {recentLessons.map((lesson) => (
                <div key={lesson.id} className="lesson-item">
                  <div className="lesson-meta">
                    <span>{new Date(lesson.created_at).toLocaleDateString()}</span>
                    <span>{lesson.message_count} messages</span>
                  </div>
                  <span className="lesson-xp">+{lesson.xp_earned} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
