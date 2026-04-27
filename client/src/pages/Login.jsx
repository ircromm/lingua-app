import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';

export default function Login() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await api.login(nickname.trim());
      login(data.user);
      navigate('/languages');
    } catch (err) {
      setError(err.message || 'Failed to login. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">🌍</span>
          <h1>LinguaApp</h1>
          <p>Learn languages with an AI professor</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="nickname">Your nickname</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. learner42"
              maxLength={30}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <small>No password needed. Just pick a nickname.</small>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading || !nickname.trim()}>
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>

        <div className="login-features">
          <div className="feature">
            <span>🤖</span>
            <span>AI professor adapts to you</span>
          </div>
          <div className="feature">
            <span>🎯</span>
            <span>15 languages available</span>
          </div>
          <div className="feature">
            <span>🎤</span>
            <span>Speak & listen practice</span>
          </div>
        </div>
      </div>
    </div>
  );
}
