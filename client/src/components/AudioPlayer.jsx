import React, { useRef, useState } from 'react';
import { api } from '../api.js';

const LANGUAGE_BCP47 = {
  en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE',
  it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA',
  ru: 'ru-RU', hi: 'hi-IN', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR',
};

function getVoiceForLanguage(language) {
  const voices = window.speechSynthesis.getVoices();
  const bcp = LANGUAGE_BCP47[language] || 'en-US';
  const langCode = bcp.split('-')[0];

  return (
    voices.find((v) => v.lang === bcp) ||
    voices.find((v) => v.lang.startsWith(langCode)) ||
    null
  );
}

export default function AudioPlayer({ text, language }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const getTTSMode = () => localStorage.getItem('lingua_tts_mode') || 'openai';

  const playOpenAI = async () => {
    try {
      setLoading(true);
      const url = await api.getTTS(text, language);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => { setPlaying(true); setLoading(false); };
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlaying(false); setLoading(false); };

      await audio.play();
    } catch (err) {
      console.error('OpenAI TTS error:', err);
      setLoading(false);
      // Fallback to browser TTS
      playBrowser();
    }
  };

  const playBrowser = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoiceForLanguage(language);
    if (voice) utterance.voice = voice;

    const bcp = LANGUAGE_BCP47[language] || 'en-US';
    utterance.lang = bcp;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setLoading(false);
  };

  const handleClick = () => {
    if (playing) {
      stop();
      return;
    }
    const mode = getTTSMode();
    if (mode === 'openai') {
      playOpenAI();
    } else {
      playBrowser();
    }
  };

  return (
    <button
      type="button"
      className={`audio-btn ${playing ? 'audio-btn--playing' : ''}`}
      onClick={handleClick}
      title={playing ? 'Stop audio' : 'Play audio'}
      aria-label={playing ? 'Stop audio' : 'Play audio'}
    >
      {loading ? '⏳' : playing ? '⏹' : '🔊'}
    </button>
  );
}
