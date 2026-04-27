import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { api } from '../api.js';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import TTSToggle from '../components/TTSToggle.jsx';

export default function Lesson() {
  const { language } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();

  const [lessonId, setLessonId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);
  const [totalXp, setTotalXp] = useState(0);
  const [xpFlash, setXpFlash] = useState(null);
  const [drillState, setDrillState] = useState(null); // active drill
  const [drillAnswers, setDrillAnswers] = useState([]);
  const [langInfo, setLangInfo] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const langsData = await api.getLanguages();
        setLangInfo(langsData.languages.find((l) => l.code === language));

        const data = await api.startLesson(user.id, language);
        setLessonId(data.lessonId);

        const welcomeMsg = {
          role: 'assistant',
          content: data.message.message,
          drill: data.message.drill,
          vocab: data.message.vocab,
          xp: 0,
          id: Date.now(),
        };
        setMessages([welcomeMsg]);

        if (data.message.drill) {
          setDrillState({ drill: data.message.drill, messageId: welcomeMsg.id });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setStarting(false);
      }
    };
    load();
  }, [language, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading || !lessonId) return;

    const userMsg = { role: 'user', content: text, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await api.sendMessage(user.id, lessonId, language, text);

      const assistantMsg = {
        role: 'assistant',
        content: data.response.message,
        drill: data.response.drill,
        vocab: data.response.vocab,
        xp: data.response.xp,
        id: Date.now() + 1,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setTotalXp(data.totalXp);

      if (data.response.xp > 0) {
        setXpFlash(`+${data.response.xp} XP`);
        setTimeout(() => setXpFlash(null), 2000);
      }

      if (data.response.drill) {
        setDrillState({ drill: data.response.drill, messageId: assistantMsg.id });
        setDrillAnswers([]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Error reaching professor. Try again.', id: Date.now() + 2 },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleTranscript = (text) => {
    setInput(text);
    setTimeout(() => sendMessage(text), 100);
  };

  const handleDrillAnswer = (item, answer, itemIndex) => {
    const updated = [...drillAnswers];
    updated[itemIndex] = answer;
    setDrillAnswers(updated);

    const drill = drillState.drill;
    if (updated.length === drill.items.length && updated.every((a) => a !== undefined)) {
      // All drill items answered — send summary to teacher
      const summary = drill.items
        .map((item, i) => `Q: ${item.prompt} | A: ${updated[i]}`)
        .join('\n');
      setDrillState(null);
      sendMessage(`[Drill completed]\n${summary}`);
    }
  };

  if (starting) {
    return (
      <div className="page-center">
        <div className="spinner" />
        <p style={{ marginTop: '1rem' }}>Starting lesson…</p>
      </div>
    );
  }

  return (
    <div className="lesson-page">
      <header className="lesson-header">
        <button className="btn btn-ghost" onClick={() => navigate(`/dashboard/${language}`)}>
          ← Dashboard
        </button>
        <div className="lesson-header-center">
          <span>{langInfo?.flag} {langInfo?.name} Lesson</span>
        </div>
        <div className="lesson-header-right">
          <div className="xp-display">
            <span className="xp-total">{totalXp} XP</span>
            {xpFlash && <span className="xp-flash">{xpFlash}</span>}
          </div>
          <TTSToggle />
        </div>
      </header>

      <div className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-wrapper message-wrapper--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="message-avatar">👨‍🏫</div>
            )}
            <div className={`message-bubble message-bubble--${msg.role}`}>
              <p className="message-text">{msg.content}</p>

              {msg.role === 'assistant' && msg.content && (
                <AudioPlayer text={msg.content} language={language} />
              )}

              {msg.vocab && msg.vocab.length > 0 && (
                <div className="vocab-chips">
                  {msg.vocab.map((v, i) => (
                    <span key={i} className="vocab-chip">{v}</span>
                  ))}
                </div>
              )}

              {msg.xp > 0 && (
                <span className="msg-xp-badge">+{msg.xp} XP</span>
              )}

              {/* Inline drill */}
              {drillState && drillState.messageId === msg.id && (
                <DrillWidget
                  drill={drillState.drill}
                  answers={drillAnswers}
                  onAnswer={handleDrillAnswer}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-wrapper message-wrapper--assistant">
            <div className="message-avatar">👨‍🏫</div>
            <div className="message-bubble message-bubble--assistant typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="lesson-input-area">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer or use the mic…"
            disabled={loading}
          />
          <VoiceRecorder
            language={language}
            onTranscript={handleTranscript}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary send-btn"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function DrillWidget({ drill, answers, onAnswer }) {
  const [localAnswers, setLocalAnswers] = useState({});

  if (!drill || !drill.items) return null;

  const handleSelect = (itemIndex, value) => {
    const updated = { ...localAnswers, [itemIndex]: value };
    setLocalAnswers(updated);
    onAnswer(drill.items[itemIndex], value, itemIndex);
  };

  const handleFillInput = (itemIndex, value, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const updated = { ...localAnswers, [itemIndex]: value };
      setLocalAnswers(updated);
      onAnswer(drill.items[itemIndex], value, itemIndex);
    }
  };

  return (
    <div className="drill-widget">
      <div className="drill-header">
        <span className="drill-icon">💪</span>
        <span className="drill-title">{drill.context || 'Quick drill!'}</span>
      </div>
      {drill.items.map((item, i) => (
        <div key={i} className={`drill-item ${localAnswers[i] !== undefined ? 'drill-item--answered' : ''}`}>
          <p className="drill-prompt">{i + 1}. {item.prompt}</p>
          {drill.type === 'multiple_choice' && item.options ? (
            <div className="drill-options">
              {item.options.map((opt, j) => (
                <button
                  key={j}
                  className={`drill-opt ${localAnswers[i] === opt ? 'drill-opt--selected' : ''}`}
                  onClick={() => handleSelect(i, opt)}
                  disabled={localAnswers[i] !== undefined}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              className="drill-input"
              placeholder="Your answer…"
              disabled={localAnswers[i] !== undefined}
              onKeyDown={(e) => handleFillInput(i, e.target.value, e)}
            />
          )}
          {localAnswers[i] !== undefined && (
            <span className="drill-check">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}
