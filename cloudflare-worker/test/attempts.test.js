import test from 'node:test';
import assert from 'node:assert/strict';
import { isAttemptExpired } from '../src/attempts.js';

const now = new Date('2026-10-22T12:00:00.000Z');

test('attempts without deadlines do not expire', () => {
  assert.equal(isAttemptExpired(null, now), false);
});

test('attempt deadline comparison handles Firestore timestamps', () => {
  assert.equal(isAttemptExpired({ seconds: 1792670401, nanoseconds: 0 }, now), false);
});

test('attempt expires at the deadline, not one second later', () => {
  assert.equal(isAttemptExpired({ seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 }, now), true);
  assert.equal(isAttemptExpired(new Date(now.getTime() + 1000), now), false);
});
