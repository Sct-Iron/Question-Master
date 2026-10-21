import { requireFirebaseUser } from './auth.js';
import { commitWrites, fieldEquals, fieldLessThanOrEqual, getDocument, queryDocuments } from './firestore.js';

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_ARGUMENT';
  return error;
}

function requiredString(value, field, maxLength = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw invalid(`${field} is invalid.`);
  return value.trim();
}

function publicQuestions(questions = []) {
  return questions.map((question, index) => {
    const { correctAnswer: _correctAnswer, ...safeQuestion } = question;
    return { id: question.id || `q-${index + 1}`, ...safeQuestion };
  });
}

function answerKeys(quiz, keyDocument) {
  const stored = keyDocument?.data?.questions;
  return stored || (quiz.questions || []).map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    correctAnswer: question.correctAnswer || null,
    maxPoints: question.maxPoints || 1,
  }));
}

export async function startQuiz(request, env) {
  const user = await requireFirebaseUser(request, env);
  const data = await request.json();
  const quizId = requiredString(data.quizId, 'Quiz ID');
  const quizDocument = await getDocument(env, `quizzes/${quizId}`);
  if (!quizDocument || quizDocument.data.isPublished !== true) throw new Error('NOT_FOUND');

  const attemptId = `${user.uid}_${quizId}`;
  const existing = await getDocument(env, `attempts/${attemptId}`);
  if (existing) {
    if (existing.data.status !== 'in_progress') throw new Error('ALREADY_EXISTS');
    return {
      attemptId,
      quiz: { id: quizId, ...quizDocument.data, questions: publicQuestions(quizDocument.data.questions) },
      startedAt: existing.data.startedAt,
      deadlineAt: existing.data.deadlineAt || null,
    };
  }

  const startedAt = new Date();
  const minutes = Number(quizDocument.data.timeLimitMinutes);
  const deadlineAt = Number.isFinite(minutes) && minutes > 0
    ? new Date(startedAt.getTime() + minutes * 60 * 1000)
    : null;
  const attempt = {
    studentId: user.uid,
    studentEmail: user.email,
    quizId,
    status: 'in_progress',
    startedAt,
    deadlineAt,
    createdAt: startedAt,
  };
  await commitWrites(env, [{ path: `attempts/${attemptId}`, data: attempt, precondition: { exists: false } }]);
  return {
    attemptId,
    quiz: { id: quizId, ...quizDocument.data, questions: publicQuestions(quizDocument.data.questions) },
    startedAt,
    deadlineAt,
  };
}

export async function submitQuiz(request, env) {
  const user = await requireFirebaseUser(request, env);
  const data = await request.json();
  const attemptId = requiredString(data.attemptId, 'Attempt ID');
  const submittedAnswers = data.answers;
  if (!submittedAnswers || typeof submittedAnswers !== 'object' || Array.isArray(submittedAnswers)) throw invalid('Answers are invalid.');

  const attemptDocument = await getDocument(env, `attempts/${attemptId}`);
  if (!attemptDocument || attemptDocument.data.studentId !== user.uid) throw new Error('NOT_FOUND');
  const attempt = attemptDocument.data;
  if (attempt.status !== 'in_progress') throw new Error('ALREADY_EXISTS');

  const [quizDocument, keyDocument] = await Promise.all([
    getDocument(env, `quizzes/${attempt.quizId}`),
    getDocument(env, `quizAnswerKeys/${attempt.quizId}`),
  ]);
  if (!quizDocument) throw new Error('FAILED_PRECONDITION');
  const quiz = quizDocument.data;
  const questions = quiz.questions || [];
  const keys = new Map(answerKeys(quiz, keyDocument).map((item) => [item.id, item]));
  const now = new Date();
  const expired = attempt.deadlineAt && now.getTime() > (attempt.deadlineAt.seconds * 1000 + attempt.deadlineAt.nanoseconds / 1000000);
  let mcqScore = 0;
  let mcqTotal = 0;
  let essayTotal = 0;
  const answers = questions.map((question, index) => {
    const id = question.id || `q-${index + 1}`;
    const answerValue = typeof submittedAnswers[id] === 'string' ? submittedAnswers[id].trim() : '';
    const key = keys.get(id);
    if (question.type === 'mcq') {
      mcqTotal += 1;
      const isCorrect = answerValue === key?.correctAnswer;
      if (isCorrect) mcqScore += 1;
      return {
        questionIndex: index,
        questionText: question.text,
        type: 'mcq',
        answer: answerValue,
        answerText: question.options?.[answerValue] || '',
        isCorrect,
      };
    }
    const maxPoints = Number(key?.maxPoints || question.maxPoints || 1);
    essayTotal += maxPoints;
    return { questionIndex: index, questionText: question.text, type: 'essay', answer: answerValue, maxPoints, score: null };
  });

  const submissionId = crypto.randomUUID();
  const submission = {
    attemptId,
    quizId: attempt.quizId,
    quizTitle: quiz.title,
    studentId: user.uid,
    studentEmail: user.email,
    answers,
    mcqScore,
    mcqTotal,
    essayScore: null,
    essayTotal,
    totalQuestions: questions.length,
    isReleased: false,
    timeLimitMinutes: quiz.timeLimitMinutes || null,
    timeExpired: Boolean(expired),
    submittedAt: now,
    releasedAt: null,
  };
  await commitWrites(env, [
    { path: `attempts/${attemptId}`, data: { status: 'submitted', submittedAt: now, timeExpired: Boolean(expired) }, precondition: { updateTime: attemptDocument.updateTime } },
    { path: `submissions/${submissionId}`, data: submission, precondition: { exists: false } },
  ]);
  return { ok: true, timeExpired: Boolean(expired) };
}

export async function expireQuizAttempts(env) {
  const expiredAttempts = await queryDocuments(env, 'attempts', {
    compositeFilter: {
      op: 'AND',
      filters: [fieldEquals('status', 'in_progress'), fieldLessThanOrEqual('deadlineAt', new Date())],
    },
  });

  for (const attemptDocument of expiredAttempts.slice(0, 100)) {
    const attempt = attemptDocument.data;
    const [quizDocument, keyDocument] = await Promise.all([
      getDocument(env, `quizzes/${attempt.quizId}`),
      getDocument(env, `quizAnswerKeys/${attempt.quizId}`),
    ]);
    if (!quizDocument) continue;
    const questions = quizDocument.data.questions || [];
    const keys = new Map(answerKeys(quizDocument.data, keyDocument).map((item) => [item.id, item]));
    const answers = questions.map((question, index) => {
      const id = question.id || `q-${index + 1}`;
      const key = keys.get(id);
      if (question.type === 'mcq') {
        return { questionIndex: index, questionText: question.text, type: 'mcq', answer: '', answerText: '', isCorrect: false };
      }
      return {
        questionIndex: index,
        questionText: question.text,
        type: 'essay',
        answer: '',
        maxPoints: Number(key?.maxPoints || question.maxPoints || 1),
        score: null,
      };
    });
    const now = new Date();
    await commitWrites(env, [
      {
        path: `attempts/${attemptDocument.id}`,
        data: { status: 'expired', submittedAt: now, timeExpired: true },
        precondition: { updateTime: attemptDocument.updateTime },
      },
      {
        path: `submissions/${crypto.randomUUID()}`,
        data: {
          attemptId: attemptDocument.id,
          quizId: attempt.quizId,
          quizTitle: quizDocument.data.title,
          studentId: attempt.studentId,
          studentEmail: attempt.studentEmail || '',
          answers,
          mcqScore: 0,
          mcqTotal: answers.filter((answer) => answer.type === 'mcq').length,
          essayScore: null,
          essayTotal: answers.filter((answer) => answer.type === 'essay').reduce((sum, answer) => sum + answer.maxPoints, 0),
          totalQuestions: answers.length,
          isReleased: false,
          timeLimitMinutes: quizDocument.data.timeLimitMinutes || null,
          timeExpired: true,
          submittedAt: now,
          releasedAt: null,
        },
        precondition: { exists: false },
      },
    ]);
  }
}
