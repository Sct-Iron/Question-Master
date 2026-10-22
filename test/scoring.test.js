import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnswerScore,
  getSubmissionTotals,
  normalizeEssayScore,
  parsePointValue,
  parseTimeLimit,
} from '../src/utils/scoring.js';

test('point values accept positive numbers and reject invalid values', () => {
  assert.equal(parsePointValue('10'), 10);
  assert.equal(parsePointValue('0'), null);
  assert.equal(parsePointValue('-2'), null);
  assert.equal(parsePointValue('abc'), null);
});

test('essay scores are clamped to the attainable maximum', () => {
  assert.equal(normalizeEssayScore(7, 5), 5);
  assert.equal(normalizeEssayScore(-1, 5), 0);
  assert.equal(normalizeEssayScore('3.5', 5), 3.5);
  assert.equal(normalizeEssayScore('invalid', 5), 0);
});

test('answer scores handle objective and essay answers', () => {
  assert.equal(getAnswerScore({ type: 'mcq', isCorrect: true }), 1);
  assert.equal(getAnswerScore({ type: 'mcq', isCorrect: false }), 0);
  assert.equal(getAnswerScore({ type: 'essay', score: 4, maxPoints: 5 }), 4);
});

test('mixed submission totals use attainable essay points', () => {
  const totals = getSubmissionTotals([
    { type: 'mcq', isCorrect: true },
    { type: 'mcq', isCorrect: false },
    { type: 'essay', score: 7, maxPoints: 10 },
    { type: 'essay', score: 2, maxPoints: 5 },
  ]);

  assert.deepEqual(totals, {
    mcqEarned: 1,
    mcqTotal: 2,
    mcqPercentage: 50,
    essayEarned: 9,
    essayTotal: 15,
    essayPercentage: 60,
  });
});

test('time limits accept positive whole minutes only', () => {
  assert.equal(parseTimeLimit('30'), 30);
  assert.equal(parseTimeLimit('0'), null);
  assert.equal(parseTimeLimit('-1'), null);
  assert.equal(parseTimeLimit('abc'), null);
});
