import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const googleAccessTokenCache = new Map();

function authError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function verifyFirebaseUser(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw authError('UNAUTHENTICATED', 'You must be signed in.');

  const { payload } = await jwtVerify(match[1], firebaseKeys, {
    audience: env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
  });

  return {
    uid: payload.user_id || payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    role: payload.role === 'admin' ? 'admin' : 'student',
    isSuperAdmin: payload.isSuperAdmin === true,
  };
}

export async function requireFirebaseUser(request, env) {
  const user = await verifyFirebaseUser(request, env);
  if (!user.uid) throw authError('UNAUTHENTICATED', 'You must be signed in.');
  return user;
}

export function requireAdmin(user) {
  if (user.role !== 'admin') throw authError('FORBIDDEN', 'Administrator access is required.');
  return user;
}

export function requireSuperAdmin(user) {
  if (!user.isSuperAdmin) throw authError('FORBIDDEN', 'Super administrator access is required.');
  return user;
}

async function serviceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.');
  return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

export async function googleAccessToken(env, scope = 'https://www.googleapis.com/auth/datastore') {
  const now = Math.floor(Date.now() / 1000);
  const cached = googleAccessTokenCache.get(scope);
  if (cached && cached.expiresAt > now + 60) {
    return cached.value;
  }

  const account = await serviceAccount(env);
  const privateKey = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error('Unable to obtain Google access token.');
  const token = await response.json();
  googleAccessTokenCache.set(scope, { value: token.access_token, expiresAt: now + Number(token.expires_in || 3600) });
  return token.access_token;
}

export async function updateCustomClaims(env, uid, claims) {
  const token = await googleAccessToken(env, 'https://www.googleapis.com/auth/identitytoolkit');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ localId: uid, customAttributes: JSON.stringify(claims) }),
  });
  if (!response.ok) throw new Error('Unable to update Firebase custom claims.');
}
