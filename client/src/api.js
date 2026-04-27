const BASE = '/api';

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, options);

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (nickname) => request('POST', '/auth/login', { nickname }),

  // Languages
  getLanguages: () => request('GET', '/languages'),

  // Placement
  startPlacement: (userId, language) => request('POST', '/placement/start', { userId, language }),
  submitAnswer: (sessionId, answer) => request('POST', '/placement/submit', { sessionId, answer }),
  getPlacementResult: (userId, language) => request('GET', `/placement/result/${userId}/${language}`),

  // Lessons
  startLesson: (userId, language) => request('POST', '/lessons/start', { userId, language }),
  sendMessage: (userId, lessonId, language, message) =>
    request('POST', '/lessons/message', { userId, lessonId, language, message }),

  // Dashboard
  getDashboard: (userId, language) => request('GET', `/dashboard/${userId}/${language}`),

  // Deck
  getDeck: (userId, language) => request('GET', `/deck?userId=${userId}&language=${language}`),
  reviewCard: (cardId, userId, quality) => request('POST', '/deck/review', { cardId, userId, quality }),
  addCard: (userId, language, item, translation) =>
    request('POST', '/deck/add', { userId, language, item, translation }),

  // TTS - returns a blob URL
  getTTS: async (text, language, voice) => {
    const res = await fetch(`${BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, voice }),
    });
    if (!res.ok) throw new Error('TTS failed');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
