import { requireAdmin } from './auth.js';
import {
  commitWrites,
  fieldEquals,
  getDocument,
  queryDocuments,
} from './firestore.js';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function bad(message) {
  const error = new Error(message);
  error.code = 'INVALID_ARGUMENT';
  return error;
}

function requiredString(value, field, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw bad(`${field} is invalid.`);
  return value.trim();
}

function positiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw bad(`${field} must be greater than zero.`);
  return number;
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
    throw bad('A quiz must contain between 1 and 200 questions.');
  }
  return questions.map((question, index) => {
    const text = requiredString(question?.text, `Question ${index + 1}`, 5000);
    const id = typeof question?.id === 'string' && question.id ? question.id : `q-${index + 1}`;
    if (question?.type === 'mcq') {
      const options = Object.fromEntries(OPTION_KEYS.map((key) => [
        key,
        requiredString(question?.options?.[key], `Option ${key}`, 1000),
      ]));
      if (!OPTION_KEYS.includes(question?.correctAnswer)) throw bad(`Question ${index + 1} has an invalid correct answer.`);
      return { id, type: 'mcq', text, options, correctAnswer: question.correctAnswer };
    }
    if (question?.type === 'essay') {
      return {
        id,
        type: 'essay',
        text,
        hint: typeof question.hint === 'string' ? question.hint.trim().slice(0, 5000) : '',
        maxPoints: positiveNumber(question.maxPoints ?? 1, `Question ${index + 1} points`),
      };
    }
    throw bad(`Question ${index + 1} has an invalid type.`);
  });
}

function publicQuestions(questions = []) {
  return questions.map((question, index) => {
    const { correctAnswer: _correctAnswer, ...safeQuestion } = question;
    return { id: question.id || `q-${index + 1}`, ...safeQuestion };
  });
}

function splitQuestions(questions) {
  return {
    publicQuestions: publicQuestions(questions),
    answerKeys: questions.map((question) => ({
      id: question.id,
      type: question.type,
      correctAnswer: question.correctAnswer ?? null,
      maxPoints: question.maxPoints ?? 1,
    })),
  };
}

function assertOwner(resource, user) {
  if (resource?.createdBy?.uid !== user.uid && !user.isSuperAdmin) throw new Error('FORBIDDEN');
}

function quizPayload(data, questions, user, existing) {
  const timeLimitMinutes = data.timeLimitMinutes === null || data.timeLimitMinutes === ''
    ? null
    : Math.floor(positiveNumber(data.timeLimitMinutes, 'Time limit'));
  return {
    title: requiredString(data.title, 'Quiz title', 200),
    questionCount: questions.length,
    questions,
    isPublished: data.isPublished !== false,
    timeLimitMinutes,
    updatedAt: new Date(),
    updatedBy: user.uid,
    ...(existing ? {} : {
      createdAt: new Date(),
      createdBy: {
        uid: user.uid,
        name: typeof data.createdBy?.name === 'string' ? data.createdBy.name.slice(0, 200) : '',
        email: user.email,
      },
    }),
  };
}

export async function saveQuiz(request, env, user) {
  requireAdmin(user);
  const data = await request.json();
  const quizId = typeof data.quizId === 'string' ? data.quizId.trim() : '';
  const questions = validateQuestions(data.questions);
  const { publicQuestions: safeQuestions, answerKeys } = splitQuestions(questions);
  const id = quizId || crypto.randomUUID();
  const existing = await getDocument(env, `quizzes/${id}`);
  if (existing) assertOwner(existing.data, user);
  const payload = quizPayload(data, safeQuestions.map((question) => ({
    ...question,
    ...(questions.find((item) => item.id === question.id)?.type === 'essay'
      ? { maxPoints: questions.find((item) => item.id === question.id).maxPoints }
      : {}),
  })), user, existing);
  await commitWrites(env, [
    { path: `quizzes/${id}`, data: payload },
    { path: `quizAnswerKeys/${id}`, data: { quizId: id, questions: answerKeys, updatedAt: new Date() } },
  ]);
  return { quizId: id };
}

export async function getQuizEditor(request, env, user) {
  requireAdmin(user);
  const data = await request.json();
  const quizId = requiredString(data.quizId, 'Quiz ID', 200);
  const quiz = await getDocument(env, `quizzes/${quizId}`);
  if (!quiz) throw new Error('NOT_FOUND');
  assertOwner(quiz.data, user);
  const keys = await getDocument(env, `quizAnswerKeys/${quizId}`);
  const answerMap = new Map((keys?.data.questions || []).map((item) => [item.id, item]));
  return {
    quiz: {
      id: quizId,
      ...quiz.data,
      questions: (quiz.data.questions || []).map((question) => ({ ...question, ...(answerMap.get(question.id) || {}) })),
    },
  };
}

export async function listPublishedQuizzes(env) {
  const quizzes = await queryDocuments(env, 'quizzes', fieldEquals('isPublished', true));
  return { quizzes: quizzes.map(({ id, data }) => ({ id, ...data, questions: publicQuestions(data.questions) })) };
}

export async function deleteQuiz(request, env, user) {
  requireAdmin(user);
  const data = await request.json();
  const quizId = requiredString(data.quizId, 'Quiz ID', 200);
  const quiz = await getDocument(env, `quizzes/${quizId}`);
  if (!quiz) return { ok: true };
  assertOwner(quiz.data, user);
  await commitWrites(env, [{ path: `quizzes/${quizId}`, delete: true }, { path: `quizAnswerKeys/${quizId}`, delete: true }]);
  return { ok: true };
}
