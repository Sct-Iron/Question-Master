import { requireFirebaseUser } from './auth.js';
import { deleteQuiz, getQuizEditor, listPublishedQuizzes, saveQuiz } from './handlers.js';
import { expireQuizAttempts, startQuiz, submitQuiz } from './attempts.js';
import { releaseResults, saveMarks } from './grading.js';
import { approveAdmin, listAdmins, rejectAdmin } from './admin.js';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const configuredOrigins = String(env.APP_ORIGINS || env.APP_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigin = origin && configuredOrigins.includes(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function routeKey(request) {
  const url = new URL(request.url);
  return `${request.method.toUpperCase()} ${url.pathname}`;
}

function apiRoute(request) {
  return new URL(request.url).pathname.replace(/^\/api\/?/, '');
}

function errorResponse(error, headers) {
  const statusByCode = {
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ALREADY_EXISTS: 409,
    INVALID_ARGUMENT: 400,
  };
  const status = statusByCode[error.code] || 500;
  return json({ error: status === 500 ? 'Internal server error.' : error.message }, status, headers);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if (routeKey(request) === 'GET /health') {
      return json({ ok: true, service: 'question-master-api' }, 200, headers);
    }

    try {
      const route = apiRoute(request);
      if (request.method === 'POST' && route === 'listPublishedQuizzes') {
        await requireFirebaseUser(request, env);
        return json(await listPublishedQuizzes(env), 200, headers);
      }

      const user = await requireFirebaseUser(request, env);
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);
      if (route === 'startQuiz') return json(await startQuiz(request, env), 200, headers);
      if (route === 'submitQuiz') return json(await submitQuiz(request, env), 200, headers);
      if (route === 'saveMarks') return json(await saveMarks(request, env, user), 200, headers);
      if (route === 'releaseResults') return json(await releaseResults(request, env, user), 200, headers);
      if (route === 'listAdmins') return json(await listAdmins(env, user), 200, headers);
      if (route === 'approveAdmin') return json(await approveAdmin(request, env, user), 200, headers);
      if (route === 'rejectAdmin') return json(await rejectAdmin(request, env, user), 200, headers);
      if (route === 'saveQuiz') return json(await saveQuiz(request, env, user), 200, headers);
      if (route === 'getQuizEditor') return json(await getQuizEditor(request, env, user), 200, headers);
      if (route === 'deleteQuiz') return json(await deleteQuiz(request, env, user), 200, headers);
      return json({ error: 'Not found.' }, 404, headers);
    } catch (error) {
      return errorResponse(error, headers);
    }
  },

  async scheduled(_controller, env) {
    await expireQuizAttempts(env);
  },
};
