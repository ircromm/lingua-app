const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// SM-2 algorithm implementation
function sm2(card, quality) {
  // quality: 0-5 (0=blackout, 5=perfect)
  let { ease_factor, interval_days, repetitions } = card;

  if (quality < 3) {
    // Failed: reset
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;
  }

  // Clamp to our intervals: 1, 3, 7, 21
  if (interval_days <= 1) interval_days = 1;
  else if (interval_days <= 4) interval_days = 3;
  else if (interval_days <= 14) interval_days = 7;
  else interval_days = 21;

  return { ease_factor, interval_days, repetitions };
}

// GET /api/deck?userId=&language=
router.get('/', async (req, res) => {
  const { userId, language } = req.query;

  if (!userId || !language) {
    return res.status(400).json({ error: 'userId and language are required' });
  }

  try {
    // Get due cards
    const result = await pool.query(
      `SELECT * FROM vocab_deck
       WHERE user_id = $1 AND language = $2 AND next_review <= NOW()
       ORDER BY next_review ASC LIMIT 20`,
      [userId, language]
    );

    // Get total pending count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM vocab_deck
       WHERE user_id = $1 AND language = $2`,
      [userId, language]
    );

    const dueCountResult = await pool.query(
      `SELECT COUNT(*) as due FROM vocab_deck
       WHERE user_id = $1 AND language = $2 AND next_review <= NOW()`,
      [userId, language]
    );

    res.json({
      cards: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      due: parseInt(dueCountResult.rows[0].due, 10),
    });
  } catch (err) {
    console.error('Deck GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deck/review — submit a review result
router.post('/review', async (req, res) => {
  const { cardId, userId, quality } = req.body;

  if (!cardId || !userId || quality === undefined) {
    return res.status(400).json({ error: 'cardId, userId and quality are required' });
  }

  if (quality < 0 || quality > 5) {
    return res.status(400).json({ error: 'quality must be 0-5' });
  }

  try {
    const cardResult = await pool.query(
      'SELECT * FROM vocab_deck WHERE id = $1 AND user_id = $2',
      [cardId, userId]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResult.rows[0];
    const { ease_factor, interval_days, repetitions } = sm2(card, quality);

    await pool.query(
      `UPDATE vocab_deck
       SET ease_factor = $1, interval_days = $2, repetitions = $3,
           next_review = NOW() + (interval_days || ' days')::interval
       WHERE id = $4`,
      [ease_factor, interval_days, repetitions, cardId]
    );

    res.json({ success: true, nextInterval: interval_days });
  } catch (err) {
    console.error('Deck review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deck/add — manually add a card
router.post('/add', async (req, res) => {
  const { userId, language, item, translation } = req.body;

  if (!userId || !language || !item || !translation) {
    return res.status(400).json({ error: 'userId, language, item and translation are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO vocab_deck (user_id, language, item, translation)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [userId, language, item, translation]
    );

    res.json({ card: result.rows[0] || null });
  } catch (err) {
    console.error('Deck add error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
