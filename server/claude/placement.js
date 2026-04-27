const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_SCORES = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

const AXES = ['vocabulary', 'grammar', 'reading_comprehension', 'written_production'];

async function generateQuestion(language, currentLevel, axis, previousQuestions) {
  const previousTopics = previousQuestions.map((q) => q.topic).join(', ');

  const prompt = `Generate a single placement test question for ${language} at CEFR level ${currentLevel}, testing the "${axis}" axis.

Requirements:
- The question must clearly test ${axis}
- Difficulty must match ${currentLevel} exactly
- Must be different from these previous topics: ${previousTopics || 'none'}
- For vocabulary: test word knowledge in context
- For grammar: test a key grammar structure for this level
- For reading_comprehension: provide a short passage (2-4 sentences) with a comprehension question
- For written_production: ask the student to write 1-2 sentences about a specific situation

Respond with ONLY valid JSON:
{
  "axis": "${axis}",
  "level": "${currentLevel}",
  "topic": "brief topic name",
  "question": "the full question text",
  "question_type": "multiple_choice" | "open_ended" | "fill_blank",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."] or null if open_ended,
  "correct_answer": "the correct answer or null for open_ended",
  "evaluation_criteria": "for open_ended: what to look for in a correct answer"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0].text.trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
  return JSON.parse(jsonMatch[1] || rawText);
}

async function evaluateOpenAnswer(language, question, userAnswer, level, axis) {
  const prompt = `You are evaluating a ${language} placement test answer.

Level being tested: ${level}
Axis: ${axis}
Question: ${question.question}
Evaluation criteria: ${question.evaluation_criteria}
Student's answer: "${userAnswer}"

Evaluate the answer strictly for ${level} level. Be honest and precise.

Respond with ONLY valid JSON:
{
  "correct": true | false,
  "partial": true | false,
  "score": 0.0 to 1.0,
  "feedback": "brief, encouraging feedback in English",
  "demonstrated_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0].text.trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
  return JSON.parse(jsonMatch[1] || rawText);
}

function evaluateMultipleChoice(question, userAnswer) {
  const correct = userAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
  return {
    correct,
    partial: false,
    score: correct ? 1.0 : 0.0,
    demonstrated_level: correct ? question.level : getPreviousLevel(question.level),
  };
}

function getPreviousLevel(level) {
  const idx = CEFR_LEVELS.indexOf(level);
  return idx > 0 ? CEFR_LEVELS[idx - 1] : 'A1';
}

function getNextLevel(level) {
  const idx = CEFR_LEVELS.indexOf(level);
  return idx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[idx + 1] : 'C2';
}

function calculateFinalLevel(answers) {
  // Group by axis
  const byAxis = {};
  for (const axis of AXES) {
    byAxis[axis] = answers.filter((a) => a.axis === axis);
  }

  const axisLevels = {};
  for (const axis of AXES) {
    const axisAnswers = byAxis[axis];
    if (axisAnswers.length === 0) {
      axisLevels[axis] = 'B1';
      continue;
    }

    // Weighted average of demonstrated levels
    const avgScore =
      axisAnswers.reduce((sum, a) => {
        const lvl = a.demonstrated_level || a.question_level;
        return sum + CEFR_SCORES[lvl] * a.score;
      }, 0) / axisAnswers.length;

    // Find closest CEFR level
    const rounded = Math.max(1, Math.min(6, Math.round(avgScore)));
    axisLevels[axis] = CEFR_LEVELS[rounded - 1];
  }

  // Overall level: weighted average across axes
  const overallScore =
    Object.values(axisLevels).reduce((sum, lvl) => sum + CEFR_SCORES[lvl], 0) / AXES.length;
  const overallRounded = Math.max(1, Math.min(6, Math.round(overallScore)));
  const overallLevel = CEFR_LEVELS[overallRounded - 1];

  // Weak areas: axes where level is below overall
  const weakAreas = AXES.filter(
    (axis) => CEFR_SCORES[axisLevels[axis]] < CEFR_SCORES[overallLevel]
  );

  return {
    overallLevel,
    axisLevels,
    weakAreas,
  };
}

function selectNextAxis(answers, questionCount) {
  // Rotate through axes, prioritizing ones with fewer questions
  const axisCounts = {};
  for (const axis of AXES) {
    axisCounts[axis] = answers.filter((a) => a.axis === axis).length;
  }

  const minCount = Math.min(...Object.values(axisCounts));
  const underrepresented = AXES.filter((a) => axisCounts[a] === minCount);
  return underrepresented[questionCount % underrepresented.length];
}

function adaptLevel(currentLevel, recentAnswers) {
  if (recentAnswers.length < 2) return currentLevel;

  const recentScores = recentAnswers.slice(-3);
  const avgScore = recentScores.reduce((s, a) => s + a.score, 0) / recentScores.length;

  if (avgScore >= 0.85 && currentLevel !== 'C2') {
    return getNextLevel(currentLevel);
  } else if (avgScore <= 0.35 && currentLevel !== 'A1') {
    return getPreviousLevel(currentLevel);
  }
  return currentLevel;
}

module.exports = {
  generateQuestion,
  evaluateOpenAnswer,
  evaluateMultipleChoice,
  calculateFinalLevel,
  selectNextAxis,
  adaptLevel,
};
