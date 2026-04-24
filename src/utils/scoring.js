export function normalizeEssayScore(value) {
  return Number(value) >= 1 ? 1 : 0;
}

export function getAnswerScore(answer) {
  if (!answer) return 0;
  if (answer.type === 'mcq') return answer.isCorrect ? 1 : 0;
  return normalizeEssayScore(answer.score);
}

export function getSubmissionTotals(answers = [], totalQuestionsOverride) {
  const totalQuestions = totalQuestionsOverride ?? answers.length ?? 0;
  const earned = answers.reduce((sum, answer) => sum + getAnswerScore(answer), 0);
  const percentage = totalQuestions > 0
    ? Math.round((earned / totalQuestions) * 100)
    : 0;

  return {
    earned,
    totalQuestions,
    percentage,
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
