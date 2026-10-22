import test, { after, before, beforeEach } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'node:fs';

const projectId = 'questionmaster-rules-test';
let testEnv;

const student = { uid: 'student-1' };
const admin = { uid: 'admin-1', role: 'admin' };
const superAdmin = { uid: 'super-1', role: 'admin', isSuperAdmin: true };

function db(auth) {
  return testEnv.authenticatedContext(auth.uid, auth).firestore();
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test('users can read their own profile but not another student profile', async () => {
  await seed('users/student-1', { role: 'student', status: 'approved' });
  await seed('users/student-2', { role: 'student', status: 'approved' });

  await assertSucceeds(getDoc(doc(db(student), 'users/student-1')));
  await assertFails(getDoc(doc(db(student), 'users/student-2')));
});

test('super admins can read and update user profiles', async () => {
  await seed('users/student-1', { role: 'student', status: 'approved' });
  const superDb = db(superAdmin);

  await assertSucceeds(getDoc(doc(superDb, 'users/student-1')));
  await assertSucceeds(setDoc(doc(superDb, 'users/student-1'), {
    role: 'student',
    status: 'approved',
  }));
});

test('profile creation only permits approved students or pending admins', async () => {
  const studentDb = db(student);
  const adminDb = db(admin);

  await assertSucceeds(setDoc(doc(studentDb, 'users/student-1'), {
    role: 'student',
    status: 'approved',
  }));
  await assertSucceeds(setDoc(doc(adminDb, 'users/admin-1'), {
    role: 'admin',
    status: 'pending',
  }));
  await assertFails(setDoc(doc(studentDb, 'users/student-2'), {
    role: 'admin',
    status: 'approved',
  }));
});

test('admins can read quizzes but students cannot', async () => {
  await seed('quizzes/quiz-1', { title: 'Test quiz' });

  await assertSucceeds(getDoc(doc(db(admin), 'quizzes/quiz-1')));
  await assertFails(getDoc(doc(db(student), 'quizzes/quiz-1')));
});

test('answer keys are never directly readable or writable', async () => {
  await seed('quizAnswerKeys/quiz-1', { answers: ['A'] });
  const adminDb = db(admin);

  await assertFails(getDoc(doc(adminDb, 'quizAnswerKeys/quiz-1')));
  await assertFails(setDoc(doc(adminDb, 'quizAnswerKeys/quiz-2'), { answers: ['B'] }));
});

test('students can only read released submissions belonging to them', async () => {
  await seed('submissions/submission-1', { studentId: 'student-1', isReleased: true });
  await seed('submissions/submission-2', { studentId: 'student-1', isReleased: false });
  await seed('submissions/submission-3', { studentId: 'student-2', isReleased: true });
  const studentDb = db(student);

  await assertSucceeds(getDoc(doc(studentDb, 'submissions/submission-1')));
  await assertFails(getDoc(doc(studentDb, 'submissions/submission-2')));
  await assertFails(getDoc(doc(studentDb, 'submissions/submission-3')));
});

test('attempts are readable only by their owner and are never client-writable', async () => {
  await seed('attempts/attempt-1', { studentId: 'student-1' });
  const studentDb = db(student);

  await assertSucceeds(getDoc(doc(studentDb, 'attempts/attempt-1')));
  await assertFails(setDoc(doc(studentDb, 'attempts/attempt-2'), { studentId: 'student-1' }));
});
