import { requireAdmin } from './auth.js';
import { getDocument, setDocument } from './firestore.js';

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_ARGUMENT';
  return error;
}

function requiredString(value, field, maxLength = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw invalid(`${field} is invalid.`);
  return value.trim();
}

function assertQuizOwner(quiz, user) {
  if (!quiz || (quiz.createdBy?.uid !== user.uid && !user.isSuperAdmin)) throw new Error('FORBIDDEN');
}

export async function saveMarks(request, env, user) {
  requireAdmin(user);
  const data = await request.json();
  const submissionId = requiredString(data.submissionId, 'Submission ID');
  const scores = data.essayScores;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) throw invalid('Essay scores are invalid.');
  const submissionDocument = await getDocument(env, `submissions/${submissionId}`);
  if (!submissionDocument) throw new Error('NOT_FOUND');
  const submission = submissionDocument.data;
  if (submission.isReleased) throw new Error('FAILED_PRECONDITION');
  const quizDocument = await getDocument(env, `quizzes/${submission.quizId}`);
  assertQuizOwner(quizDocument?.data, user);

  let essayScore = 0;
  let essayTotal = 0;
  const answers = (submission.answers || []).map((answer, index) => {
    if (answer.type !== 'essay') return answer;
    const maxPoints = Number(answer.maxPoints || 1);
    const rawValue = scores[index];
    const rawScore = rawValue === '' || rawValue === undefined || rawValue === null ? null : Number(rawValue);
    essayTotal += maxPoints;
    if (rawScore === null) return { ...answer, score: null };
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxPoints) {
      throw invalid(`Invalid score for essay question ${index + 1}.`);
    }
    essayScore += rawScore;
    return { ...answer, score: rawScore };
  });

  await setDocument(env, `submissions/${submissionId}`, {
    answers,
    essayScore,
    essayTotal,
    essayPercentage: essayTotal ? Math.round((essayScore / essayTotal) * 100) : null,
    updatedAt: new Date(),
  });
  return { ok: true };
}

export async function releaseResults(request, env, user) {
  requireAdmin(user);
  const data = await request.json();
  const submissionId = requiredString(data.submissionId, 'Submission ID');
  const submissionDocument = await getDocument(env, `submissions/${submissionId}`);
  if (!submissionDocument) throw new Error('NOT_FOUND');
  const submission = submissionDocument.data;
  if (submission.isReleased) return { ok: true };
  const quizDocument = await getDocument(env, `quizzes/${submission.quizId}`);
  assertQuizOwner(quizDocument?.data, user);
  if ((submission.answers || []).some((answer) => answer.type === 'essay' && (answer.score === null || answer.score === undefined))) {
    throw new Error('FAILED_PRECONDITION');
  }
  const keyDocument = await getDocument(env, `quizAnswerKeys/${submission.quizId}`);
  const questions = quizDocument.data.questions || [];
  const keys = new Map((keyDocument?.data.questions || questions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    correctAnswer: question.correctAnswer || null,
  }))).map((item) => [item.id, item]));
  const answers = (submission.answers || []).map((answer, index) => {
    if (answer.type !== 'mcq') return answer;
    const question = questions[index];
    return { ...answer, correctAnswer: keys.get(question?.id)?.correctAnswer || null };
  });
  await setDocument(env, `submissions/${submissionId}`, {
    answers,
    isReleased: true,
    releasedAt: new Date(),
  });
  return { ok: true };
}
