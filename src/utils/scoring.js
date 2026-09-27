export function parsePointValue(value) {
  const points = Number.parseFloat(value);
  return Number.isFinite(points) && points > 0 ? points : null;
}

export function normalizeEssayScore(value, maxPoints = 1) {
  const score = Number.parseFloat(value);
  const max = parsePointValue(maxPoints) ?? 1;
  if (!Number.isFinite(score)) return 0;
  return Math.min(max, Math.max(0, score));
}

export function getAnswerScore(answer) {
  if (!answer) return 0;
  if (answer.type === 'mcq') return answer.isCorrect ? 1 : 0;
  return normalizeEssayScore(answer.score, answer.maxPoints);
}

export function getSubmissionTotals(answers = []) {
  const mcqAnswers = answers.filter((answer) => answer?.type === 'mcq');
  const essayAnswers = answers.filter((answer) => answer?.type === 'essay');
  const mcqEarned = mcqAnswers.reduce((sum, answer) => sum + getAnswerScore(answer), 0);
  const essayEarned = essayAnswers.reduce((sum, answer) => sum + getAnswerScore(answer), 0);
  const essayTotal = essayAnswers.reduce(
    (sum, answer) => sum + (parsePointValue(answer.maxPoints) ?? 1),
    0
  );
  const mcqTotal = mcqAnswers.length;

  return {
    mcqEarned,
    mcqTotal,
    mcqPercentage: mcqTotal > 0 ? Math.round((mcqEarned / mcqTotal) * 100) : null,
    essayEarned,
    essayTotal,
    essayPercentage: essayTotal > 0 ? Math.round((essayEarned / essayTotal) * 100) : null,
  };
}

export function parseTimeLimit(value) {
  const minutes = Number.parseInt(value, 10);
  if (Number.isNaN(minutes) || minutes <= 0) return null;
  return minutes;
}

export function formatTimeLimit(minutes) {
  if (!minutes || minutes <= 0) return 'No limit';
  return `${minutes} min${minutes === 1 ? '' : 's'}`;
}

export function formatRemainingTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
