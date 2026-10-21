import { requireSuperAdmin } from './auth.js';
import { updateCustomClaims } from './auth.js';
import { commitWrites, getDocument, queryDocuments, fieldEquals } from './firestore.js';

function requiredUid(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    const error = new Error('User ID is invalid.');
    error.code = 'INVALID_ARGUMENT';
    throw error;
  }
  return value.trim();
}

export async function approveAdmin(request, env, user) {
  requireSuperAdmin(user);
  const data = await request.json();
  const uid = requiredUid(data.uid);
  const profile = await getDocument(env, `users/${uid}`);
  if (!profile || profile.data.role !== 'admin' || profile.data.status !== 'pending') throw new Error('NOT_FOUND');
  await updateCustomClaims(env, uid, { role: 'admin', isSuperAdmin: false });
  await commitWrites(env, [{ path: `users/${uid}`, data: { role: 'admin', status: 'approved', updatedAt: new Date() } }]);
  return { ok: true };
}

export async function rejectAdmin(request, env, user) {
  requireSuperAdmin(user);
  const data = await request.json();
  const uid = requiredUid(data.uid);
  await updateCustomClaims(env, uid, { role: 'student', isSuperAdmin: false });
  await commitWrites(env, [{ path: `users/${uid}`, data: { role: 'student', status: 'approved', updatedAt: new Date() } }]);
  return { ok: true };
}

export async function listAdmins(env, user) {
  requireSuperAdmin(user);
  const [pending, approved] = await Promise.all([
    queryDocuments(env, 'users', {
      compositeFilter: {
        op: 'AND',
        filters: [fieldEquals('role', 'admin'), fieldEquals('status', 'pending')],
      },
    }),
    queryDocuments(env, 'users', {
      compositeFilter: {
        op: 'AND',
        filters: [fieldEquals('role', 'admin'), fieldEquals('status', 'approved')],
      },
    }),
  ]);
  return { pendingAdmins: pending.map(({ id, data }) => ({ id, ...data })), approvedAdmins: approved.map(({ id, data }) => ({ id, ...data })) };
}
