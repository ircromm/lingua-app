import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import LanguageSelect from './pages/LanguageSelect.jsx';
import Placement from './pages/Placement.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Lesson from './pages/Lesson.jsx';

// App-wide context
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lingua_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('lingua_language') || null;
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('lingua_dark') === 'true';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('lingua_dark', darkMode);
  }, [darkMode]);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('lingua_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setSelectedLanguage(null);
    localStorage.removeItem('lingua_user');
    localStorage.removeItem('lingua_language');
  };

  const selectLanguage = (lang) => {
    setSelectedLanguage(lang);
    localStorage.setItem('lingua_language', lang);
  };

  return (
    <AppContext.Provider value={{ user, login, logout, selectedLanguage, selectLanguage, darkMode, setDarkMode }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/languages" /> : <Login />} />
          <Route
            path="/languages"
            element={user ? <LanguageSelect /> : <Navigate to="/" />}
          />
          <Route
            path="/placement/:language"
            element={user ? <Placement /> : <Navigate to="/" />}
          />
          <Route
            path="/dashboard/:language"
            element={user && selectedLanguage ? <Dashboard /> : <Navigate to="/languages" />}
          />
          <Route
            path="/lesson/:language"
            element={user && selectedLanguage ? <Lesson /> : <Navigate to="/languages" />}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
