import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const QUALITY_LABELS = [
  { q: 0, label: 'Blackout', color: '#ef4444' },
  { q: 2, label: 'Hard', color: '#f97316' },
  { q: 3, label: 'Good', color: '#3b82f6' },
  { q: 5, label: 'Easy', color: '#22c55e' },
];

export default function DeckReview({ userId, language, onClose }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getDeck(userId, language);
        setCards(data.cards);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, language]);

  const handleQuality = async (quality) => {
    const card = cards[currentIndex];
    try {
      await api.reviewCard(card.id, userId, quality);
      setReviewed((r) => r + 1);

      const next = currentIndex + 1;
      if (next >= cards.length) {
        setDone(true);
      } else {
        setCurrentIndex(next);
        setFlipped(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="deck-review-page">
        <div className="page-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="deck-review-page">
        <div className="deck-empty">
          <span className="deck-empty-icon">🎉</span>
          <h3>No cards due!</h3>
          <p>You're all caught up. Come back later.</p>
          <button className="btn btn-primary" onClick={onClose}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="deck-review-page">
        <div className="deck-empty">
          <span className="deck-empty-icon">✅</span>
          <h3>Session Complete!</h3>
          <p>Reviewed {reviewed} card{reviewed !== 1 ? 's' : ''}.</p>
          <button className="btn btn-primary" onClick={onClose}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="deck-review-page">
      <header className="deck-header">
        <button className="btn btn-ghost" onClick={onClose}>✕ Close</button>
        <span className="deck-progress-text">{currentIndex + 1} / {cards.length}</span>
      </header>

      <div className="progress-bar deck-progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="flashcard-container" onClick={() => setFlipped(!flipped)}>
        <div className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`}>
          <div className="flashcard-front">
            <p className="flashcard-item">{card.item}</p>
            <span className="flashcard-hint">Tap to reveal</span>
          </div>
          <div className="flashcard-back">
            <p className="flashcard-item">{card.item}</p>
            <p className="flashcard-translation">{card.translation}</p>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="quality-buttons">
          <p className="quality-label">How well did you know it?</p>
          <div className="quality-row">
            {QUALITY_LABELS.map(({ q, label, color }) => (
              <button
                key={q}
                className="quality-btn"
                style={{ borderColor: color, color }}
                onClick={() => handleQuality(q)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!flipped && (
        <div className="flip-hint">
          <button className="btn btn-secondary" onClick={() => setFlipped(true)}>
            Show Answer
          </button>
        </div>
      )}
    </div>
  );
}
