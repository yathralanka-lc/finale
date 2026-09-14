export function isValidQuizQuestion(question) {
  const text = String(question?.question || '').trim();
  const options = Array.isArray(question?.options) ? question.options : [];
  const correctIndex = Number(question?.correctIndex);
  return Boolean(text) && options.length === 4 && Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < options.length;
}

function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createQuizSessionQuestions(questions, count, random = Math.random) {
  const seen = new Set();
  const validQuestions = (Array.isArray(questions) ? questions : []).filter(question => {
    const key = String(question?.question || '').trim().toLowerCase();
    if (!isValidQuizQuestion(question) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (validQuestions.length < count) return [];
  return shuffled(validQuestions, random).slice(0, count).map(question => {
    const options = shuffled(question.options.map((text, index) => ({ text, isCorrect: index === question.correctIndex })), random);
    return { question: question.question, options: options.map(option => option.text), correctIndex: options.findIndex(option => option.isCorrect) };
  });
}

function quizKey(siteId) {
  return String(siteId || 'unknown').toLowerCase().trim();
}

export function createQuizAttemptStore({ storage, cooldownMs, maxAttempts, masteryPercent, now = () => Date.now() }) {
  const lockStatus = siteId => {
    const cleanId = quizKey(siteId);
    const lockUntil = parseInt(storage.getItem(`yathra_quiz_locked_until_${cleanId}`) || '0', 10);
    const currentTime = now();
    if (lockUntil > currentTime) return { isLocked: true, remainingMinutes: Math.ceil((lockUntil - currentTime) / 60000) };
    return { isLocked: false, remainingMinutes: 0 };
  };
  const recordResult = (siteId, scorePercent) => {
    const cleanId = quizKey(siteId);
    const attempts = parseInt(storage.getItem(`yathra_quiz_attempts_${cleanId}`) || '0', 10) + 1;
    storage.setItem(`yathra_quiz_attempts_${cleanId}`, String(attempts));
    if (scorePercent === masteryPercent || attempts >= maxAttempts) {
      storage.setItem(`yathra_quiz_locked_until_${cleanId}`, String(now() + cooldownMs));
      storage.removeItem(`yathra_quiz_attempts_${cleanId}`);
      return { attemptsUsed: attempts, attemptsRemaining: 0, isLocked: true };
    }
    return { attemptsUsed: attempts, attemptsRemaining: Math.max(0, maxAttempts - attempts), isLocked: false };
  };
  return { lockStatus, recordResult };
}
