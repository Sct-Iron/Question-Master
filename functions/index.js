import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();

const db = getFirestore();
const auth = getAuth();
const superAdminEmail = defineString('SUPER_ADMIN_EMAIL', { default: '' });
const superAdminUid = defineString('SUPER_ADMIN_UID', { default: '' });

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  return request.auth;
}

function isAdmin(authContext) {
  return authContext.token?.role === 'admin';
}

function requireAdmin(request) {
  const authContext = requireAuth(request);
  if (!isAdmin(authContext)) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
  return authContext;
}

function requireSuperAdmin(request) {
  const authContext = requireAuth(request);
  if (authContext.token?.isSuperAdmin !== true) {
    throw new HttpsError('permission-denied', 'Super administrator access is required.');
  }
  return authContext;
}

function asNonEmptyString(value, fieldName, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpsError('invalid-argument', `${fieldName} is invalid.`);
  }
  return value.trim();
}

function parsePositiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new HttpsError('invalid-argument', `${fieldName} must be greater than zero.`);
  }
  return number;
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
    throw new HttpsError('invalid-argument', 'A quiz must contain between 1 and 200 questions.');
  }

  return questions.map((question, index) => {
    const text = asNonEmptyString(question?.text, `Question ${index + 1}`, 5000);
    const type = question?.type;

    if (type === 'mcq') {
      const options = {};
      for (const key of OPTION_KEYS) {
        options[key] = asNonEmptyString(question?.options?.[key], `Option ${key}`, 1000);
      }
      if (!OPTION_KEYS.includes(question?.correctAnswer)) {
        throw new HttpsError('invalid-argument', `Question ${index + 1} has an invalid correct answer.`);
      }
      return {
        id: typeof question.id === 'string' && question.id ? question.id : `q-${index + 1}`,
        type,
        text,
        options,
        correctAnswer: question.correctAnswer,
      };
    }

    if (type === 'essay') {
      return {
        id: typeof question.id === 'string' && question.id ? question.id : `q-${index + 1}`,
        type,
        text,
        hint: typeof question.hint === 'string' ? question.hint.trim().slice(0, 5000) : '',
        maxPoints: parsePositiveNumber(question.maxPoints ?? 1, `Question ${index + 1} points`),
      };
    }

    throw new HttpsError('invalid-argument', `Question ${index + 1} has an invalid type.`);
  });
}

function splitQuestions(questions) {
  const publicQuestions = questions.map((question) => {
    const { correctAnswer: _correctAnswer, ...publicQuestion } = question;
    return publicQuestion;
  });
  const answerKeys = questions.map((question) => ({
    id: question.id,
    type: question.type,
    correctAnswer: question.correctAnswer ?? null,
    maxPoints: question.maxPoints ?? 1,
  }));
  return { publicQuestions, answerKeys };
}

function publicQuestions(questions = []) {
  return questions.map((question, index) => {
    const { correctAnswer: _correctAnswer, ...safeQuestion } = question;
    return { id: question.id || `q-${index + 1}`, ...safeQuestion };
  });
}

function normalizedQuizPayload(data, questions, actor) {
  const timeLimitMinutes = data.timeLimitMinutes === null || data.timeLimitMinutes === ''
    ? null
    : Math.floor(parsePositiveNumber(data.timeLimitMinutes, 'Time limit'));
  return {
    title: asNonEmptyString(data.title, 'Quiz title', 200),
    questionCount: questions.length,
    questions,
    isPublished: data.isPublished !== false,
    timeLimitMinutes,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  };
}

export const bootstrapSuperAdmin = onCall(async (request) => {
  const authContext = requireAuth(request);
  const configuredEmail = superAdminEmail.value().trim().toLowerCase();
  const configuredUid = superAdminUid.value().trim();
  const userEmail = (authContext.token.email || '').trim().toLowerCase();
  if (!configuredEmail || !configuredUid || authContext.uid !== configuredUid || userEmail !== configuredEmail) {
    throw new HttpsError('permission-denied', 'This account is not configured as the super administrator.');
  }

  const lockRef = db.doc('system/security');
  const lockSnap = await lockRef.get();
  if (lockSnap.exists) {
    if (lockSnap.data()?.superAdminUid !== authContext.uid) {
      throw new HttpsError('failed-precondition', 'Super administrator bootstrap has already been completed.');
    }
    const currentUser = await auth.getUser(authContext.uid);
    if (currentUser.customClaims?.isSuperAdmin === true && currentUser.customClaims?.role === 'admin') {
      return { ok: true, alreadyInitialized: true };
    }
    throw new HttpsError('failed-precondition', 'Super administrator bootstrap is locked.');
  }

  await db.runTransaction(async (transaction) => {
    const currentLock = await transaction.get(lockRef);
    if (currentLock.exists) {
      throw new HttpsError('failed-precondition', 'Super administrator bootstrap has already been completed.');
    }
    transaction.create(lockRef, {
      superAdminUid: authContext.uid,
      initializedAt: FieldValue.serverTimestamp(),
    });
  });
  await auth.setCustomUserClaims(authContext.uid, { role: 'admin', isSuperAdmin: true });
  await db.doc(`users/${authContext.uid}`).set({
    role: 'admin',
    status: 'approved',
    email: userEmail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const saveQuiz = onCall(async (request) => {
  const actor = requireAdmin(request);
  const quizId = typeof request.data?.quizId === 'string' ? request.data.quizId.trim() : '';
  const questions = validateQuestions(request.data?.questions);
  const { publicQuestions, answerKeys } = splitQuestions(questions);
  const quizRef = quizId ? db.doc(`quizzes/${quizId}`) : db.collection('quizzes').doc();
  const existing = await quizRef.get();

  if (existing.exists && existing.data()?.createdBy?.uid !== actor.uid && actor.token?.isSuperAdmin !== true) {
    throw new HttpsError('permission-denied', 'You do not own this quiz.');
  }

  const payload = normalizedQuizPayload(request.data, publicQuestions, actor);
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
    payload.createdBy = {
      uid: actor.uid,
      name: typeof request.data.createdBy?.name === 'string' ? request.data.createdBy.name.slice(0, 200) : '',
      email: actor.token.email || '',
    };
  }

  const batch = db.batch();
  batch.set(quizRef, payload, { merge: true });
  batch.set(db.doc(`quizAnswerKeys/${quizRef.id}`), {
    quizId: quizRef.id,
    questions: answerKeys,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { quizId: quizRef.id };
});

export const getQuizEditor = onCall(async (request) => {
  const actor = requireAdmin(request);
  const quizId = asNonEmptyString(request.data?.quizId, 'Quiz ID', 200);
  const quizSnap = await db.doc(`quizzes/${quizId}`).get();
  if (!quizSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const quiz = quizSnap.data();
  if (quiz.createdBy?.uid !== actor.uid && actor.token?.isSuperAdmin !== true) {
    throw new HttpsError('permission-denied', 'You do not own this quiz.');
  }
  const keySnap = await db.doc(`quizAnswerKeys/${quizId}`).get();
  const keys = new Map((keySnap.data()?.questions || []).map((item) => [item.id, item]));
  const questions = (quiz.questions || []).map((question) => ({
    ...question,
    ...(keys.get(question.id) || {}),
  }));
  return { quiz: { id: quizId, ...quiz, questions } };
});

export const listPublishedQuizzes = onCall(async (request) => {
  requireAuth(request);
  const snap = await db.collection('quizzes').where('isPublished', '==', true).get();
  return {
    quizzes: snap.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        questions: publicQuestions(data.questions),
      };
    }),
  };
});

export const deleteQuiz = onCall(async (request) => {
  const actor = requireAdmin(request);
  const quizId = asNonEmptyString(request.data?.quizId, 'Quiz ID', 200);
  const quizRef = db.doc(`quizzes/${quizId}`);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists) return { ok: true };
  const quiz = quizSnap.data();
  if (quiz.createdBy?.uid !== actor.uid && actor.token?.isSuperAdmin !== true) {
    throw new HttpsError('permission-denied', 'You do not own this quiz.');
  }
  const batch = db.batch();
  batch.delete(quizRef);
  batch.delete(db.doc(`quizAnswerKeys/${quizId}`));
  await batch.commit();
  return { ok: true };
});

export const startQuiz = onCall(async (request) => {
  const authContext = requireAuth(request);
  const quizId = asNonEmptyString(request.data?.quizId, 'Quiz ID', 200);
  const quizSnap = await db.doc(`quizzes/${quizId}`).get();
  if (!quizSnap.exists || quizSnap.data()?.isPublished !== true) {
    throw new HttpsError('not-found', 'Published quiz not found.');
  }

  const attemptRef = db.doc(`attempts/${authContext.uid}_${quizId}`);
  const attempt = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(attemptRef);
    if (existing.exists) {
      if (existing.data()?.status !== 'in_progress') {
        throw new HttpsError('already-exists', 'You have already submitted this quiz.');
      }
      return existing.data();
    }
    const startedAt = Timestamp.now();
    const minutes = Number(quizSnap.data().timeLimitMinutes);
    const deadlineAt = Number.isFinite(minutes) && minutes > 0
      ? Timestamp.fromMillis(startedAt.toMillis() + minutes * 60 * 1000)
      : null;
    const data = {
      studentId: authContext.uid,
      studentEmail: authContext.token.email || '',
      quizId,
      status: 'in_progress',
      startedAt,
      deadlineAt,
      createdAt: FieldValue.serverTimestamp(),
    };
    transaction.create(attemptRef, data);
    return data;
  });

  return {
    attemptId: attemptRef.id,
    quiz: { id: quizId, ...quizSnap.data(), questions: publicQuestions(quizSnap.data().questions) },
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
  };
});

export const submitQuiz = onCall(async (request) => {
  const authContext = requireAuth(request);
  const attemptId = asNonEmptyString(request.data?.attemptId, 'Attempt ID', 300);
  const submittedAnswers = request.data?.answers;
  if (!submittedAnswers || typeof submittedAnswers !== 'object' || Array.isArray(submittedAnswers)) {
    throw new HttpsError('invalid-argument', 'Answers are invalid.');
  }

  const attemptRef = db.doc(`attempts/${attemptId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists || attemptSnap.data()?.studentId !== authContext.uid) {
    throw new HttpsError('not-found', 'Quiz attempt not found.');
  }
  const attempt = attemptSnap.data();
  if (attempt.status !== 'in_progress') {
    throw new HttpsError('already-exists', 'This quiz has already been submitted.');
  }

  const [quizSnap, keySnap] = await Promise.all([
    db.doc(`quizzes/${attempt.quizId}`).get(),
    db.doc(`quizAnswerKeys/${attempt.quizId}`).get(),
  ]);
  if (!quizSnap.exists) throw new HttpsError('failed-precondition', 'Quiz configuration is incomplete.');

  const now = Timestamp.now();
  const expired = attempt.deadlineAt && now.toMillis() > attempt.deadlineAt.toMillis();
  const legacyQuestions = quizSnap.data().questions || [];
  const storedKeys = keySnap.exists
    ? keySnap.data().questions || []
    : legacyQuestions.map((question, index) => ({
      id: question.id || `q-${index + 1}`,
      correctAnswer: question.correctAnswer || null,
      maxPoints: question.maxPoints || 1,
    }));
  const answerMap = new Map(storedKeys.map((item) => [item.id, item]));
  const questions = legacyQuestions.map((question, index) => ({
    ...question,
    id: question.id || `q-${index + 1}`,
  }));
  let mcqScore = 0;
  let mcqTotal = 0;
  let essayTotal = 0;
  const answers = questions.map((question) => {
    const answerValue = typeof submittedAnswers[question.id] === 'string'
      ? submittedAnswers[question.id].trim()
      : '';
    const key = answerMap.get(question.id);
    if (question.type === 'mcq') {
      mcqTotal += 1;
      const isCorrect = answerValue === key?.correctAnswer;
      if (isCorrect) mcqScore += 1;
      return {
        questionIndex: questions.indexOf(question),
        questionText: question.text,
        type: 'mcq',
        answer: answerValue,
        answerText: question.options?.[answerValue] || '',
        isCorrect,
      };
    }
    const maxPoints = Number(key?.maxPoints || question.maxPoints || 1);
    essayTotal += maxPoints;
    return {
      questionIndex: questions.indexOf(question),
      questionText: question.text,
      type: 'essay',
      answer: answerValue,
      maxPoints,
      score: null,
    };
  });

  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(attemptRef);
    if (!current.exists || current.data().status !== 'in_progress') {
      throw new HttpsError('already-exists', 'This quiz has already been submitted.');
    }
    transaction.update(attemptRef, {
      status: 'submitted',
      submittedAt: now,
      timeExpired: Boolean(expired),
    });
    transaction.create(db.collection('submissions').doc(), {
      attemptId,
      quizId: attempt.quizId,
      quizTitle: quizSnap.data().title,
      studentId: authContext.uid,
      studentEmail: authContext.token.email || '',
      answers,
      mcqScore,
      mcqTotal,
      essayScore: null,
      essayTotal,
      totalQuestions: questions.length,
      isReleased: false,
      timeLimitMinutes: quizSnap.data().timeLimitMinutes || null,
      timeExpired: Boolean(expired),
      submittedAt: now,
      releasedAt: null,
    });
  });

  return { ok: true, timeExpired: Boolean(expired) };
});

async function expireAttempt(attemptId) {
  const attemptRef = db.doc(`attempts/${attemptId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) return false;
  const attempt = attemptSnap.data();
  if (attempt.status !== 'in_progress' || !attempt.deadlineAt || attempt.deadlineAt.toMillis() > Date.now()) {
    return false;
  }

  const [quizSnap, keySnap] = await Promise.all([
    db.doc(`quizzes/${attempt.quizId}`).get(),
    db.doc(`quizAnswerKeys/${attempt.quizId}`).get(),
  ]);
  if (!quizSnap.exists) return false;
  const quizQuestions = quizSnap.data().questions || [];
  const storedKeys = keySnap.exists
    ? keySnap.data().questions || []
    : quizQuestions.map((question, index) => ({
      id: question.id || `q-${index + 1}`,
      correctAnswer: question.correctAnswer || null,
      maxPoints: question.maxPoints || 1,
    }));
  const answerMap = new Map(storedKeys.map((item) => [item.id, item]));
  const answers = quizQuestions.map((question, index) => {
    const id = question.id || `q-${index + 1}`;
    const key = answerMap.get(id);
    if (question.type === 'mcq') {
      return {
        questionIndex: index,
        questionText: question.text,
        type: 'mcq',
        answer: '',
        answerText: '',
        isCorrect: false,
      };
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
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(attemptRef);
    if (!current.exists || current.data().status !== 'in_progress') return;
    transaction.update(attemptRef, {
      status: 'expired',
      submittedAt: now,
      timeExpired: true,
    });
    transaction.create(db.collection('submissions').doc(), {
      attemptId,
      quizId: attempt.quizId,
      quizTitle: quizSnap.data().title,
      studentId: attempt.studentId,
      studentEmail: attempt.studentEmail || '',
      answers,
      mcqScore: 0,
      mcqTotal: answers.filter((answer) => answer.type === 'mcq').length,
      essayScore: null,
      essayTotal: answers
        .filter((answer) => answer.type === 'essay')
        .reduce((sum, answer) => sum + answer.maxPoints, 0),
      totalQuestions: answers.length,
      isReleased: false,
      timeLimitMinutes: quizSnap.data().timeLimitMinutes || null,
      timeExpired: true,
      submittedAt: now,
      releasedAt: null,
    });
  });
  return true;
}

export const expireQuizAttempts = onSchedule('every 5 minutes', async () => {
  const expired = await db.collection('attempts')
    .where('status', '==', 'in_progress')
    .where('deadlineAt', '<=', Timestamp.now())
    .limit(100)
    .get();
  for (const attempt of expired.docs) {
    await expireAttempt(attempt.id);
  }
});

export const saveMarks = onCall(async (request) => {
  const authContext = requireAdmin(request);
  const submissionId = asNonEmptyString(request.data?.submissionId, 'Submission ID', 300);
  const scores = request.data?.essayScores;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    throw new HttpsError('invalid-argument', 'Essay scores are invalid.');
  }
  const submissionRef = db.doc(`submissions/${submissionId}`);
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) throw new HttpsError('not-found', 'Submission not found.');
  const submission = submissionSnap.data();
  if (submission.isReleased) throw new HttpsError('failed-precondition', 'Released results cannot be changed.');
  const quizSnap = await db.doc(`quizzes/${submission.quizId}`).get();
  if (!quizSnap.exists || (quizSnap.data().createdBy?.uid !== authContext.uid && authContext.token?.isSuperAdmin !== true)) {
    throw new HttpsError('permission-denied', 'You do not own this quiz.');
  }

  let essayScore = 0;
  let essayTotal = 0;
  const answers = (submission.answers || []).map((answer, index) => {
    if (answer.type !== 'essay') return answer;
    const maxPoints = Number(answer.maxPoints || 1);
    const rawScore = scores[index] === '' || scores[index] === undefined ? null : Number(scores[index]);
    essayTotal += maxPoints;
    if (rawScore === null) {
      return { ...answer, score: null };
    }
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxPoints) {
      throw new HttpsError('invalid-argument', `Invalid score for essay question ${index + 1}.`);
    }
    essayScore += rawScore;
    return { ...answer, score: rawScore };
  });

  await submissionRef.update({
    answers,
    essayScore,
    essayTotal,
    essayPercentage: essayTotal ? Math.round((essayScore / essayTotal) * 100) : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const releaseResults = onCall(async (request) => {
  const authContext = requireAdmin(request);
  const submissionId = asNonEmptyString(request.data?.submissionId, 'Submission ID', 300);
  const submissionRef = db.doc(`submissions/${submissionId}`);
  const submissionSnap = await submissionRef.get();
  if (!submissionSnap.exists) throw new HttpsError('not-found', 'Submission not found.');
  const submission = submissionSnap.data();
  if (submission.isReleased) return { ok: true };
  const quizSnap = await db.doc(`quizzes/${submission.quizId}`).get();
  if (!quizSnap.exists || (quizSnap.data().createdBy?.uid !== authContext.uid && authContext.token?.isSuperAdmin !== true)) {
    throw new HttpsError('permission-denied', 'You do not own this quiz.');
  }
  const unmarked = (submission.answers || []).some((answer) => answer.type === 'essay' && (answer.score === null || answer.score === undefined));
  if (unmarked) throw new HttpsError('failed-precondition', 'All essay questions must be marked first.');
  const keySnap = await db.doc(`quizAnswerKeys/${submission.quizId}`).get();
  const quizQuestions = quizSnap.data().questions || [];
  const answerKeys = new Map((keySnap.data()?.questions || quizQuestions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    correctAnswer: question.correctAnswer || null,
  }))).map((item) => [item.id, item]));
  const releasedAnswers = (submission.answers || []).map((answer, index) => {
    if (answer.type !== 'mcq') return answer;
    const question = quizQuestions[index];
    return { ...answer, correctAnswer: answerKeys.get(question?.id)?.correctAnswer || null };
  });
  await submissionRef.update({
    answers: releasedAnswers,
    isReleased: true,
    releasedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const approveAdmin = onCall(async (request) => {
  requireSuperAdmin(request);
  const uid = asNonEmptyString(request.data?.uid, 'User ID', 200);
  const userRecord = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { role: 'admin', isSuperAdmin: false });
  await db.doc(`users/${uid}`).set({
    role: 'admin',
    status: 'approved',
    email: userRecord.email || '',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const rejectAdmin = onCall(async (request) => {
  requireSuperAdmin(request);
  const uid = asNonEmptyString(request.data?.uid, 'User ID', 200);
  await auth.setCustomUserClaims(uid, { role: 'student', isSuperAdmin: false });
  await db.doc(`users/${uid}`).set({ role: 'student', status: 'approved', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});
