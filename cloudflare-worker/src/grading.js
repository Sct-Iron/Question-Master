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

function hydrateCorrectAnswers(answers, quiz, keyDocument) {
  const questions = quiz.questions || [];
  // Prefer the private key snapshot; older quizzes may still keep keys on their question data.
  const answerKeys = new Map((keyDocument?.data?.questions || questions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    correctAnswer: question.correctAnswer || null,
  }))).map((item) => [item.id, item]));

  return answers.map((answer, index) => {
    if (answer.type !== 'mcq') return answer;
    const questionIndex = Number.isInteger(answer.questionIndex) ? answer.questionIndex : index;
    const question = questions[questionIndex];
    const questionId = question?.id || `q-${questionIndex + 1}`;
    const correctAnswer = answer.correctAnswer || answerKeys.get(questionId)?.correctAnswer || null;
    const correctAnswerText = answer.correctAnswerText || question?.options?.[correctAnswer] || '';
    if (correctAnswer === answer.correctAnswer && correctAnswerText === answer.correctAnswerText) return answer;
    return { ...answer, correctAnswer, correctAnswerText };
  });
}

export async function hydrateReleasedSubmission(request, env, user) {
  const data = await request.json();
  const submissionId = requiredString(data.submissionId, 'Submission ID');
  const submissionDocument = await getDocument(env, `submissions/${submissionId}`);
  if (!submissionDocument || submissionDocument.data.studentId !== user.uid || submissionDocument.data.isReleased !== true) {
    throw new Error('NOT_FOUND');
  }
  const submission = submissionDocument.data;
  const answers = submission.answers || [];
  if (!submission.quizId || !answers.some(
    (answer) => answer.type === 'mcq' && (!answer.correctAnswer || !answer.correctAnswerText)
  )) {
    return { answers };
  }

  // Only the owning student may recover missing answer details for an already released result.
  const [quizDocument, keyDocument] = await Promise.all([
    getDocument(env, `quizzes/${submission.quizId}`),
    getDocument(env, `quizAnswerKeys/${submission.quizId}`),
  ]);
  if (!quizDocument) return { answers };
  const hydratedAnswers = hydrateCorrectAnswers(answers, quizDocument.data, keyDocument);
  if (hydratedAnswers.some((answer, index) => answer !== answers[index])) {
    await setDocument(env, `submissions/${submissionId}`, { answers: hydratedAnswers });
  }
  return { answers: hydratedAnswers };
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
  const answers = submission.answers || [];
  const hasMissingCorrectAnswers = answers.some(
    (answer) => answer.type === 'mcq' && (!answer.correctAnswer || !answer.correctAnswerText)
  );
  // Idempotent release calls also repair legacy submissions without changing their release state.
  if (submission.isReleased && !hasMissingCorrectAnswers) return { ok: true };
  const quizDocument = await getDocument(env, `quizzes/${submission.quizId}`);
  assertQuizOwner(quizDocument?.data, user);
  if (!submission.isReleased && answers.some(
    (answer) => answer.type === 'essay' && (answer.score === null || answer.score === undefined)
  )) {
    throw new Error('FAILED_PRECONDITION');
  }
  const keyDocument = await getDocument(env, `quizAnswerKeys/${submission.quizId}`);
  const releasedAnswers = hydrateCorrectAnswers(answers, quizDocument.data, keyDocument);
  const updates = {};
  if (releasedAnswers.some((answer, index) => answer !== answers[index])) updates.answers = releasedAnswers;
  if (!submission.isReleased) {
    updates.isReleased = true;
    updates.releasedAt = new Date();
  }
  if (Object.keys(updates).length > 0) {
    await setDocument(env, `submissions/${submissionId}`, updates);
  }
  return { ok: true };
}
