const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/auth/login
// Login by nickname — creates account if not exists
router.post('/login', async (req, res) => {
  const { nickname } = req.body;

  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'Nickname is required' });
  }

  const cleanNickname = nickname.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (cleanNickname.length < 2 || cleanNickname.length > 30) {
    return res
      .status(400)
      .json({ error: 'Nickname must be 2-30 characters (letters, numbers, _ -)' });
  }

  try {
    // Try to find existing user
    let result = await pool.query('SELECT * FROM users WHERE nickname = $1', [cleanNickname]);

    let user;
    let isNew = false;

    if (result.rows.length === 0) {
      // Create new user
      const insertResult = await pool.query(
        'INSERT INTO users (nickname) VALUES ($1) RETURNING *',
        [cleanNickname]
      );
      user = insertResult.rows[0];
      isNew = true;
    } else {
      user = result.rows[0];
    }

    // Get user's languages
    const langResult = await pool.query(
      'SELECT * FROM user_languages WHERE user_id = $1 ORDER BY last_seen DESC',
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        created_at: user.created_at,
      },
      languages: langResult.rows,
      isNew,
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
