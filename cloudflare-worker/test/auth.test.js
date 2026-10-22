import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin, requireFirebaseUser, requireSuperAdmin } from '../src/auth.js';

test('admin authorization accepts admins and rejects students', () => {
  const admin = { uid: 'admin-1', role: 'admin' };
  assert.equal(requireAdmin(admin), admin);
  assert.throws(() => requireAdmin({ uid: 'student-1', role: 'student' }), {
    code: 'FORBIDDEN',
  });
});

test('super-admin authorization requires the explicit claim', () => {
  const superAdmin = { uid: 'admin-1', role: 'admin', isSuperAdmin: true };
  assert.equal(requireSuperAdmin(superAdmin), superAdmin);
  assert.throws(() => requireSuperAdmin({ uid: 'admin-2', role: 'admin', isSuperAdmin: false }), {
    code: 'FORBIDDEN',
  });
});

test('missing bearer tokens are unauthenticated', async () => {
  const request = new Request('https://example.test/protected');
  await assert.rejects(
    requireFirebaseUser(request, { FIREBASE_PROJECT_ID: 'questionmaster-c4fab' }),
    { code: 'UNAUTHENTICATED' },
  );
});
