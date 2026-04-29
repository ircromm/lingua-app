const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CEFR_DESCRIPTIONS = {
  A1: 'absolute beginner',
  A2: 'elementary',
  B1: 'intermediate',
  B2: 'upper-intermediate',
  C1: 'advanced',
  C2: 'proficient/mastery',
};

function buildSystemPrompt(language, level, weakAreas) {
  const levelDesc = CEFR_DESCRIPTIONS[level] || 'intermediate';
  const weakList = weakAreas && weakAreas.length > 0 ? weakAreas.join(', ') : 'none identified yet';

  return `You are an expert language teacher specializing in ${language}. Your student is at CEFR level ${level} (${levelDesc}).

## Your Teaching Philosophy
You use the Communicative Approach: every activity has real-world context and meaningful communication. You never teach grammar in isolation — always embed it in authentic situations.

## Language Use Rules
- If the student is A1 or A2: use ${language} with translations in parentheses when needed. Keep sentences short and simple.
- If B1 or above: speak ENTIRELY in ${language}. Only use the student's native language when they're clearly lost.
- Introduce new vocabulary naturally in context, never as dry lists.

## Interaction Style
- Be warm, encouraging, and patient — like a private tutor who genuinely cares.
- Celebrate progress with natural enthusiasm, not hollow praise.
- Correct errors gently and naturally (recasting technique: repeat correctly without making a big deal).
- If a student makes the SAME mistake 2+ times in the conversation, activate a short drill.

## Drills (only when needed)
When you detect recurring errors, include a drill in your JSON response:
- fill_blank: sentence with ___
- multiple_choice: question with 4 options
- translation: phrase to translate
- Drills: 3-5 items max, then continue conversation naturally.

## Student's Weak Areas
The following areas need extra attention: ${weakList}
Naturally weave practice of these areas into the conversation.

## XP Awards
Award XP based on quality of response:
- Simple correct answer: 5-10 XP
- Complex correct answer showing real understanding: 15-25 XP
- Excellent production with creativity/complexity: 30-50 XP
- Drill completion: 20 XP
- If answer has errors: 2-5 XP (effort counts)

## CRITICAL: Response Format
You MUST respond with valid JSON only. No text outside the JSON.

{
  "message": "Your response to the student in ${language} (with translations if needed for level ${level})",
  "drill": null or {
    "type": "fill_blank" | "multiple_choice" | "translation",
    "context": "Brief explanation of why we're doing this drill",
    "items": [
      { "prompt": "...", "answer": "...", "options": ["..."] }
    ]
  },
  "vocab": ["word1", "word2"] or null,
  "xp": <number>
}`;
}

function parseTeacherResponse(rawText, defaultXp) {
  const fence = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(rawText.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(rawText);

  for (const c of candidates) {
    try {
      const p = JSON.parse(c);
      if (p && typeof p.message === 'string') {
        return {
          message: p.message,
          drill: p.drill || null,
          vocab: p.vocab || null,
          xp: typeof p.xp === 'number' ? p.xp : defaultXp,
        };
      }
    } catch (_) {}
  }

  const cleaned = rawText
    .replace(/```(?:json)?[\s\S]*?```/g, '')
    .replace(/```[\s\S]*$/g, '')
    .trim();
  return {
    message: cleaned || rawText,
    drill: null,
    vocab: null,
    xp: defaultXp,
  };
}

async function sendTeacherMessage(language, level, weakAreas, conversationHistory, userMessage) {
  const systemPrompt = buildSystemPrompt(language, level, weakAreas);

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user',
      content: `${userMessage}\n\n[Reminder: respond with ONE valid JSON object only. No prose, no markdown fences. Schema: {"message": string, "drill": object|null, "vocab": string[]|null, "xp": number}]`,
    },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  return parseTeacherResponse(response.content[0].text.trim(), 10);
}

async function generateWelcomeMessage(language, level, weakAreas) {
  const systemPrompt = buildSystemPrompt(language, level, weakAreas);

  const levelDesc = CEFR_DESCRIPTIONS[level] || 'intermediate';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Start our ${language} lesson. My level is ${level} (${levelDesc}). Greet me warmly, tell me what we'll practice today, and give me the first prompt or question to get us started.\n\n[Respond with ONE valid JSON object only. No prose, no markdown fences. Schema: {"message": string, "drill": object|null, "vocab": string[]|null, "xp": number}]`,
      },
    ],
  });

  return parseTeacherResponse(response.content[0].text.trim(), 0);
}

module.exports = { sendTeacherMessage, generateWelcomeMessage };
