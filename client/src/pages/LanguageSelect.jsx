import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';

export default function LanguageSelect() {
  const [languages, setLanguages] = useState([]);
  const [userLanguages, setUserLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, selectLanguage, logout, darkMode, setDarkMode } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getLanguages();
        setLanguages(data.languages);
        // Re-login to get updated user languages
        const userData = await api.login(user.nickname);
        setUserLanguages(userData.languages || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelect = async (lang) => {
    selectLanguage(lang.code);

    // Check if this user already has data for this language
    const existing = userLanguages.find((ul) => ul.language === lang.code);

    if (existing) {
      // Go to dashboard
      navigate(`/dashboard/${lang.code}`);
    } else {
      // New language — do placement test
      navigate(`/placement/${lang.code}`);
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="language-select-page">
      <header className="app-header">
        <div className="header-left">
          <span className="logo-sm">🌍 LinguaApp</span>
        </div>
        <div className="header-right">
          <span className="user-badge">{user.nickname}</span>
          <button className="btn btn-ghost" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="language-select-main">
        <h2>Choose a language to learn</h2>
        <p className="subtitle">
          {userLanguages.length > 0
            ? 'Continue learning or start a new language'
            : 'Select a language to take your placement test'}
        </p>

        <div className="language-grid">
          {languages.map((lang) => {
            const progress = userLanguages.find((ul) => ul.language === lang.code);
            return (
              <button
                key={lang.code}
                className={`language-card ${progress ? 'language-card--active' : ''}`}
                onClick={() => handleSelect(lang)}
              >
                <span className="lang-flag">{lang.flag}</span>
                <span className="lang-name">{lang.name}</span>
                <span className="lang-native">{lang.nativeName}</span>
                {progress && (
                  <span className="lang-level-badge">{progress.level_cefr}</span>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
