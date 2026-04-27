const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/dashboard/:userId/:language
router.get('/:userId/:language', async (req, res) => {
  const { userId, language } = req.params;

  try {
    // Get language stats
    const langResult = await pool.query(
      'SELECT * FROM user_languages WHERE user_id = $1 AND language = $2',
      [userId, language]
    );

    if (langResult.rows.length === 0) {
      return res.status(404).json({ error: 'Language data not found' });
    }

    const langData = langResult.rows[0];

    // Get recent lessons (last 10)
    const lessonsResult = await pool.query(
      `SELECT id, xp_earned, created_at,
        jsonb_array_length(messages_json) as message_count
       FROM lessons
       WHERE user_id = $1 AND language = $2
       ORDER BY created_at DESC LIMIT 10`,
      [userId, language]
    );

    // Get placement results for axis breakdown
    const placementResult = await pool.query(
      `SELECT level_cefr, weak_areas_json, taken_at,
        answers_json
       FROM placement_results
       WHERE user_id = $1 AND language = $2
       ORDER BY taken_at DESC LIMIT 1`,
      [userId, language]
    );

    // Get due vocab items count
    const deckResult = await pool.query(
      `SELECT COUNT(*) as due_count
       FROM vocab_deck
       WHERE user_id = $1 AND language = $2 AND next_review <= NOW()`,
      [userId, language]
    );

    // Calculate axis progress from placement
    let axisLevels = { vocabulary: 'B1', grammar: 'B1', reading_comprehension: 'B1', written_production: 'B1' };
    let weakAreas = [];

    if (placementResult.rows.length > 0) {
      weakAreas = placementResult.rows[0].weak_areas_json || [];

      // Recalculate axis levels from answers
      const answers = placementResult.rows[0].answers_json || [];
      const axes = ['vocabulary', 'grammar', 'reading_comprehension', 'written_production'];
      const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const CEFR_SCORES = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

      for (const axis of axes) {
        const axisAnswers = answers.filter((a) => a.axis === axis);
        if (axisAnswers.length > 0) {
          const avgScore =
            axisAnswers.reduce((sum, a) => {
              const lvl = a.demonstrated_level || a.question_level || 'B1';
              return sum + (CEFR_SCORES[lvl] || 3) * (a.score || 0.5);
            }, 0) / axisAnswers.length;
          const rounded = Math.max(1, Math.min(6, Math.round(avgScore)));
          axisLevels[axis] = CEFR_LEVELS[rounded - 1];
        }
      }
    }

    // Compute XP to next level thresholds
    const XP_THRESHOLDS = { A1: 0, A2: 100, B1: 300, B2: 600, C1: 1000, C2: 1500 };
    const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentLevelIdx = CEFR_LEVELS.indexOf(langData.level_cefr);
    const nextLevel = CEFR_LEVELS[currentLevelIdx + 1] || null;
    const xpForNext = nextLevel ? XP_THRESHOLDS[nextLevel] : null;

    res.json({
      stats: {
        level: langData.level_cefr,
        xp: langData.xp,
        streak: langData.streak,
        lastSeen: langData.last_seen,
        xpForNext,
        nextLevel,
      },
      axisLevels,
      weakAreas,
      recentLessons: lessonsResult.rows,
      dueCards: parseInt(deckResult.rows[0].due_count, 10),
      hasPlacement: placementResult.rows.length > 0,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
