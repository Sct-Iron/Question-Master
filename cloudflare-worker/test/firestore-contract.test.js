import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStructuredQuery,
  fieldEquals,
  fieldLessThanOrEqual,
  firestoreValue,
  fromFirestoreValue,
} from '../src/firestore.js';

test('Firestore values serialize dates as RFC3339 timestamps', () => {
  const value = firestoreValue(new Date('2026-10-22T12:00:00.000Z'));
  assert.deepEqual(value, { timestampValue: '2026-10-22T12:00:00.000Z' });
});

test('Firestore values round-trip timestamps without losing milliseconds', () => {
  const value = fromFirestoreValue({ timestampValue: '2026-10-22T12:00:00.123Z' });
  assert.deepEqual(value, { seconds: 1792670400, nanoseconds: 123000000 });
});

test('expiry query uses a valid collection and composite filter shape', () => {
  const query = buildStructuredQuery('attempts', {
    compositeFilter: {
      op: 'AND',
      filters: [
        fieldEquals('status', 'in_progress'),
        fieldLessThanOrEqual('deadlineAt', new Date('2026-10-22T12:00:00.000Z')),
      ],
    },
  });

  assert.deepEqual(query.from, [{ collectionId: 'attempts' }]);
  assert.equal(query.where.compositeFilter.op, 'AND');
  assert.equal(query.where.compositeFilter.filters[0].fieldFilter.field.fieldPath, 'status');
  assert.equal(query.where.compositeFilter.filters[1].fieldFilter.field.fieldPath, 'deadlineAt');
  assert.equal(query.where.compositeFilter.filters[1].fieldFilter.op, 'LESS_THAN_OR_EQUAL');
  assert.deepEqual(query.where.compositeFilter.filters[1].fieldFilter.value, {
    timestampValue: '2026-10-22T12:00:00.000Z',
  });
});
