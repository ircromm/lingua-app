import React, { useState } from 'react';

export default function TTSToggle() {
  const [mode, setMode] = useState(() => localStorage.getItem('lingua_tts_mode') || 'openai');

  const toggle = () => {
    const next = mode === 'openai' ? 'browser' : 'openai';
    setMode(next);
    localStorage.setItem('lingua_tts_mode', next);
  };

  return (
    <div className="tts-toggle" title="Toggle TTS voice">
      <button
        type="button"
        className={`tts-opt ${mode === 'openai' ? 'tts-opt--active' : ''}`}
        onClick={() => { setMode('openai'); localStorage.setItem('lingua_tts_mode', 'openai'); }}
      >
        AI
      </button>
      <button
        type="button"
        className={`tts-opt ${mode === 'browser' ? 'tts-opt--active' : ''}`}
        onClick={() => { setMode('browser'); localStorage.setItem('lingua_tts_mode', 'browser'); }}
      >
        Browser
      </button>
    </div>
  );
}
