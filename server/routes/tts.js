const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGUAGE_VOICE_MAP = {
  en: 'nova',
  es: 'nova',
  pt: 'nova',
  fr: 'nova',
  de: 'nova',
  it: 'nova',
  ja: 'nova',
  ko: 'nova',
  zh: 'nova',
  ar: 'nova',
  ru: 'nova',
  hi: 'nova',
  nl: 'nova',
  pl: 'nova',
  tr: 'nova',
};

// POST /api/tts
router.post('/', async (req, res) => {
  const { text, voice, language } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  if (text.length > 4096) {
    return res.status(400).json({ error: 'text too long (max 4096 chars)' });
  }

  const selectedVoice = voice || LANGUAGE_VOICE_MAP[language] || 'nova';

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.send(buffer);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

module.exports = router;
