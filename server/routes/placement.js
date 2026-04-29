const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const {
  generateQuestion,
  evaluateOpenAnswer,
  evaluateMultipleChoice,
  calculateFinalLevel,
  selectNextAxis,
  adaptLevel,
} = require('../claude/placement');

// In-memory sessions (in production, use Redis or DB)
const sessions = new Map();

// POST /api/placement/start
router.post('/start', async (req, res) => {
  const { userId, language } = req.body;

  if (!userId || !language) {
    return res.status(400).json({ error: 'userId and language are required' });
  }

  const sessionId = `${userId}-${language}-${Date.now()}`;

  const session = {
    userId,
    language,
    currentLevel: 'B1', // Start at B1 per spec
    answers: [],
    questions: [],
    status: 'in_progress',
    createdAt: Date.now(),
  };

  sessions.set(sessionId, session);

  // Generate first question
  try {
    const axis = selectNextAxis([], 0);
    const question = await generateQuestion(language, 'B1', axis, []);

    session.questions.push(question);

    res.json({
      sessionId,
      question: {
        id: 0,
        axis: question.axis,
        level: question.level,
        question: question.question,
        question_type: question.question_type,
        options: question.options,
      },
      progress: { current: 1, total: 12 },
    });
  } catch (err) {
    console.error('Placement start error:', err);
    sessions.delete(sessionId);
    res.status(500).json({ error: 'Failed to generate question' });
  }
});

// POST /api/placement/submit
router.post('/submit', async (req, res) => {
  const { sessionId, answer } = req.body;

  if (!sessionId || answer === undefined) {
    return res.status(400).json({ error: 'sessionId and answer are required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const questionIndex = session.answers.length;
  const question = session.questions[questionIndex];

  if (!question) {
    return res.status(400).json({ error: 'No question to answer' });
  }

  try {
    let evaluation;

    if (question.question_type === 'multiple_choice' || question.question_type === 'fill_blank') {
      evaluation = evaluateMultipleChoice(question, answer);
      if (!evaluation.feedback) {
        evaluation.feedback = evaluation.correct
          ? 'Correct! ✅'
          : `Not quite. The correct answer was: ${question.correct_answer}`;
      }
    } else {
      evaluation = await evaluateOpenAnswer(
        session.language,
        question,
        answer,
        question.level,
        question.axis
      );
    }

    session.answers.push({
      axis: question.axis,
      question_level: question.level,
      question: question.question,
      user_answer: answer,
      correct: evaluation.correct,
      partial: evaluation.partial,
      score: evaluation.score,
      demonstrated_level: evaluation.demonstrated_level || question.level,
    });

    // Adapt level based on recent performance
    const newLevel = adaptLevel(session.currentLevel, session.answers);
    session.currentLevel = newLevel;

    const totalQuestions = 12;
    const isDone = session.answers.length >= totalQuestions;

    if (isDone) {
      // Calculate final results
      const results = calculateFinalLevel(session.answers);

      // Save to DB
      await pool.query(
        `INSERT INTO placement_results (user_id, language, answers_json, level_cefr, weak_areas_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.userId,
          session.language,
          JSON.stringify(session.answers),
          results.overallLevel,
          JSON.stringify(results.weakAreas),
        ]
      );

      // Upsert user_languages
      await pool.query(
        `INSERT INTO user_languages (user_id, language, level_cefr, xp, streak, last_seen)
         VALUES ($1, $2, $3, 0, 0, NOW())
         ON CONFLICT (user_id, language) DO UPDATE
         SET level_cefr = $3, last_seen = NOW()`,
        [session.userId, session.language, results.overallLevel]
      );

      session.status = 'complete';
      session.results = results;

      return res.json({
        done: true,
        feedback: evaluation.feedback,
        results: {
          level: results.overallLevel,
          axisLevels: results.axisLevels,
          weakAreas: results.weakAreas,
        },
      });
    }

    // Generate next question
    const nextAxis = selectNextAxis(session.answers, session.answers.length);
    const nextQuestion = await generateQuestion(
      session.language,
      session.currentLevel,
      nextAxis,
      session.questions
    );

    session.questions.push(nextQuestion);

    res.json({
      done: false,
      feedback: evaluation.feedback,
      correct: evaluation.correct,
      question: {
        id: session.answers.length,
        axis: nextQuestion.axis,
        level: nextQuestion.level,
        question: nextQuestion.question,
        question_type: nextQuestion.question_type,
        options: nextQuestion.options,
      },
      progress: {
        current: session.answers.length + 1,
        total: totalQuestions,
      },
    });
  } catch (err) {
    console.error('Placement submit error:', err);
    res.status(500).json({ error: 'Failed to evaluate answer' });
  }
});

// GET /api/placement/result/:userId/:language
router.get('/result/:userId/:language', async (req, res) => {
  const { userId, language } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM placement_results
       WHERE user_id = $1 AND language = $2
       ORDER BY taken_at DESC LIMIT 1`,
      [userId, language]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No placement result found' });
    }

    const row = result.rows[0];
    res.json({
      level: row.level_cefr,
      weakAreas: row.weak_areas_json,
      takenAt: row.taken_at,
    });
  } catch (err) {
    console.error('Placement result error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
