const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { sendTeacherMessage, generateWelcomeMessage } = require('../claude/teacher');

// POST /api/lessons/start
router.post('/start', async (req, res) => {
  const { userId, language } = req.body;

  if (!userId || !language) {
    return res.status(400).json({ error: 'userId and language are required' });
  }

  try {
    // Get user's language data
    const langResult = await pool.query(
      'SELECT * FROM user_languages WHERE user_id = $1 AND language = $2',
      [userId, language]
    );

    let level = 'B1';
    let weakAreas = [];

    if (langResult.rows.length > 0) {
      level = langResult.rows[0].level_cefr;
    }

    // Get most recent placement result for weak areas
    const placementResult = await pool.query(
      `SELECT weak_areas_json FROM placement_results
       WHERE user_id = $1 AND language = $2
       ORDER BY taken_at DESC LIMIT 1`,
      [userId, language]
    );

    if (placementResult.rows.length > 0) {
      weakAreas = placementResult.rows[0].weak_areas_json || [];
    }

    // Generate welcome message
    const welcome = await generateWelcomeMessage(language, level, weakAreas);

    // Create lesson record
    const lessonResult = await pool.query(
      `INSERT INTO lessons (user_id, language, messages_json, xp_earned)
       VALUES ($1, $2, $3, 0)
       RETURNING id`,
      [
        userId,
        language,
        JSON.stringify([{ role: 'assistant', content: welcome.message, vocab: welcome.vocab }]),
      ]
    );

    res.json({
      lessonId: lessonResult.rows[0].id,
      level,
      weakAreas,
      message: welcome,
    });
  } catch (err) {
    console.error('Lesson start error:', err);
    res.status(500).json({ error: 'Failed to start lesson' });
  }
});

// POST /api/lessons/message
router.post('/message', async (req, res) => {
  const { userId, lessonId, language, message } = req.body;

  if (!userId || !lessonId || !language || !message) {
    return res.status(400).json({ error: 'userId, lessonId, language and message are required' });
  }

  try {
    // Get lesson with conversation history
    const lessonResult = await pool.query(
      'SELECT * FROM lessons WHERE id = $1 AND user_id = $2',
      [lessonId, userId]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lesson = lessonResult.rows[0];
    const messages = lesson.messages_json || [];

    // Get user level and weak areas
    const langResult = await pool.query(
      'SELECT level_cefr FROM user_languages WHERE user_id = $1 AND language = $2',
      [userId, language]
    );

    const level = langResult.rows[0]?.level_cefr || 'B1';

    const placementResult = await pool.query(
      `SELECT weak_areas_json FROM placement_results
       WHERE user_id = $1 AND language = $2
       ORDER BY taken_at DESC LIMIT 1`,
      [userId, language]
    );

    const weakAreas = placementResult.rows[0]?.weak_areas_json || [];

    // Build conversation history (last 20 messages to stay within context)
    const history = messages.slice(-20).map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    // Get teacher response
    const teacherResponse = await sendTeacherMessage(language, level, weakAreas, history, message);

    // Append user message and teacher response to history
    const updatedMessages = [
      ...messages,
      { role: 'user', content: message, timestamp: Date.now() },
      {
        role: 'assistant',
        content: teacherResponse.message,
        drill: teacherResponse.drill,
        vocab: teacherResponse.vocab,
        xp: teacherResponse.xp,
        timestamp: Date.now(),
      },
    ];

    const newXpEarned = (lesson.xp_earned || 0) + (teacherResponse.xp || 0);

    // Update lesson
    await pool.query(
      'UPDATE lessons SET messages_json = $1, xp_earned = $2 WHERE id = $3',
      [JSON.stringify(updatedMessages), newXpEarned, lessonId]
    );

    // Update user XP and last_seen
    await pool.query(
      `UPDATE user_languages
       SET xp = xp + $1, last_seen = NOW()
       WHERE user_id = $2 AND language = $3`,
      [teacherResponse.xp || 0, userId, language]
    );

    // Save new vocab to deck if provided
    if (teacherResponse.vocab && teacherResponse.vocab.length > 0) {
      for (const vocabItem of teacherResponse.vocab) {
        if (typeof vocabItem === 'string' && vocabItem.includes(':')) {
          const [item, translation] = vocabItem.split(':').map((s) => s.trim());
          await pool.query(
            `INSERT INTO vocab_deck (user_id, language, item, translation, next_review)
             VALUES ($1, $2, $3, $4, NOW() + interval '1 day')
             ON CONFLICT DO NOTHING`,
            [userId, language, item, translation]
          );
        }
      }
    }

    // Update streak
    await updateStreak(userId, language);

    res.json({
      response: teacherResponse,
      totalXp: newXpEarned,
    });
  } catch (err) {
    console.error('Lesson message error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

async function updateStreak(userId, language) {
  try {
    const result = await pool.query(
      'SELECT last_seen, streak FROM user_languages WHERE user_id = $1 AND language = $2',
      [userId, language]
    );

    if (result.rows.length === 0) return;

    const { last_seen, streak } = result.rows[0];
    const lastSeen = new Date(last_seen);
    const now = new Date();
    const diffDays = Math.floor((now - lastSeen) / (1000 * 60 * 60 * 24));

    let newStreak = streak;
    if (diffDays === 1) {
      newStreak = streak + 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }

    await pool.query(
      'UPDATE user_languages SET streak = $1, last_seen = NOW() WHERE user_id = $2 AND language = $3',
      [newStreak, userId, language]
    );
  } catch (err) {
    console.error('Streak update error:', err);
  }
}

module.exports = router;
