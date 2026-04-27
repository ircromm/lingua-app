import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';

const AXIS_LABELS = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading_comprehension: 'Reading',
  written_production: 'Writing',
};

const CEFR_DESCRIPTIONS = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Mastery',
};

export default function Placement() {
  const { language } = useParams();
  const { user, selectLanguage } = useApp();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('intro'); // intro | testing | done
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState({ current: 1, total: 12 });
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [langInfo, setLangInfo] = useState(null);

  useEffect(() => {
    const load = async () => {
      const data = await api.getLanguages();
      const lang = data.languages.find((l) => l.code === language);
      setLangInfo(lang);
    };
    load();
  }, [language]);

  const startTest = async () => {
    setLoading(true);
    try {
      const data = await api.startPlacement(user.id, language);
      setSessionId(data.sessionId);
      setQuestion(data.question);
      setProgress(data.progress);
      setPhase('testing');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    setFeedback(null);

    try {
      const data = await api.submitAnswer(sessionId, answer);

      if (data.done) {
        setResults(data.results);
        setPhase('done');
        selectLanguage(language);
      } else {
        setFeedback({ text: data.feedback, correct: data.correct });
        setQuestion(data.question);
        setProgress(data.progress);
        setAnswer('');

        // Show feedback briefly then clear
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  if (phase === 'intro') {
    return (
      <div className="placement-page">
        <div className="placement-intro-card">
          <div className="placement-lang-header">
            <span className="placement-flag">{langInfo?.flag || '🌍'}</span>
            <h2>Placement Test — {langInfo?.name || language}</h2>
          </div>
          <p>
            Before your first lesson, let's find your level. The test adapts to your answers.
          </p>
          <ul className="placement-info-list">
            <li>📝 12 questions across vocabulary, grammar, reading & writing</li>
            <li>⏱️ Takes about 5-10 minutes</li>
            <li>🎯 Starts at B1 (intermediate) and adapts up or down</li>
            <li>📊 Result: CEFR level (A1–C2) + your strengths & weaknesses</li>
          </ul>
          <button
            className="btn btn-primary btn-full"
            onClick={startTest}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Test'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' && results) {
    return (
      <div className="placement-page">
        <div className="placement-results-card">
          <div className="result-header">
            <span className="result-flag">{langInfo?.flag || '🌍'}</span>
            <h2>Your Level: <strong>{results.level}</strong></h2>
            <p className="result-desc">{CEFR_DESCRIPTIONS[results.level]}</p>
          </div>

          <div className="axis-results">
            <h3>Results by skill</h3>
            {Object.entries(results.axisLevels || {}).map(([axis, lvl]) => (
              <div key={axis} className="axis-result-row">
                <span className="axis-name">{AXIS_LABELS[axis]}</span>
                <div className="axis-bar-container">
                  <div
                    className="axis-bar"
                    style={{ width: `${(['A1','A2','B1','B2','C1','C2'].indexOf(lvl) + 1) * 16.66}%` }}
                  />
                </div>
                <span className="axis-level">{lvl}</span>
              </div>
            ))}
          </div>

          {results.weakAreas && results.weakAreas.length > 0 && (
            <div className="weak-areas">
              <h3>Areas to focus on</h3>
              <div className="weak-tags">
                {results.weakAreas.map((area) => (
                  <span key={area} className="weak-tag">{AXIS_LABELS[area] || area}</span>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={() => navigate(`/dashboard/${language}`)}
          >
            Start Learning →
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'testing' && question) {
    const progressPct = ((progress.current - 1) / progress.total) * 100;

    return (
      <div className="placement-page">
        <div className="placement-test-card">
          <div className="test-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-text">
              Question {progress.current} of {progress.total}
            </span>
            <span className="axis-chip">{AXIS_LABELS[question.axis]}</span>
          </div>

          {feedback && (
            <div className={`feedback-banner ${feedback.correct ? 'feedback-correct' : 'feedback-wrong'}`}>
              {feedback.correct ? '✓ ' : '✗ '}
              {feedback.text}
            </div>
          )}

          <div className="question-body">
            <p className="question-text">{question.question}</p>

            {question.question_type === 'multiple_choice' && question.options ? (
              <div className="options-grid">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`option-btn ${answer === opt ? 'option-btn--selected' : ''}`}
                    onClick={() => setAnswer(opt)}
                    disabled={loading}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className="answer-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here…"
                rows={question.question_type === 'open_ended' ? 4 : 2}
                disabled={loading}
                autoFocus
              />
            )}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={submitAnswer}
            disabled={loading || !answer.trim()}
          >
            {loading ? 'Checking...' : progress.current === progress.total ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="spinner" />
    </div>
  );
}
