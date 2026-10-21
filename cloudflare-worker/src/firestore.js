import { googleAccessToken } from './auth.js';

function databaseUrl(env, suffix = '') {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents${suffix}`;
}

function firestoreDocumentName(env, path) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, item] of Object.entries(value)) fields[key] = firestoreValue(item);
    return { mapValue: { fields } };
  }
  throw new Error('Unsupported Firestore value.');
}

function fromFirestoreValue(value) {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) {
    const milliseconds = Date.parse(value.timestampValue);
    return { seconds: Math.floor(milliseconds / 1000), nanoseconds: (milliseconds % 1000) * 1000000 };
  }
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

function documentPath(path) {
  return `/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function firestoreFetch(env, path, options = {}) {
  const response = await fetch(databaseUrl(env, path), {
    ...options,
    headers: {
      authorization: `Bearer ${await googleAccessToken(env)}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore request failed with status ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

export async function getDocument(env, path) {
  const document = await firestoreFetch(env, documentPath(path));
  return document ? {
    id: path.split('/').pop(),
    data: fromFirestoreFields(document.fields || {}),
    updateTime: document.updateTime,
  } : null;
}

export async function setDocument(env, path, data) {
  const document = await firestoreFetch(env, documentPath(path), {
    method: 'PATCH',
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])),
    }),
    headers: {
      'x-goog-request-params': `document.name=${encodeURIComponent(firestoreDocumentName(env, path))}`,
    },
  });
  return document ? { id: path.split('/').pop(), data: fromFirestoreFields(document.fields || {}) } : null;
}

export async function deleteDocument(env, path) {
  await firestoreFetch(env, documentPath(path), { method: 'DELETE' });
}

export async function commitWrites(env, writes) {
  const response = await fetch(databaseUrl(env, ':commit'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await googleAccessToken(env)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      writes: writes.map((write) => {
        const name = firestoreDocumentName(env, write.path);
        if (write.delete) return {
          delete: name,
          ...(write.precondition ? { currentDocument: write.precondition } : {}),
        };
        return {
          update: {
            name,
            fields: Object.fromEntries(Object.entries(write.data).map(([key, value]) => [key, firestoreValue(value)])),
          },
          updateMask: { fieldPaths: Object.keys(write.data) },
          ...(write.precondition ? { currentDocument: write.precondition } : {}),
        };
      }),
    }),
  });
  if (!response.ok) throw new Error(`Firestore commit failed with status ${response.status}.`);
  return response.json();
}

export async function queryDocuments(env, collectionId, where) {
  const response = await fetch(databaseUrl(env, ':runQuery'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await googleAccessToken(env)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        ...(where ? { where } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore query failed with status ${response.status}.`);
  const rows = await response.json();
  return rows.filter((row) => row.document).map((row) => ({
    id: row.document.name.split('/').pop(),
    data: fromFirestoreFields(row.document.fields || {}),
    updateTime: row.document.updateTime,
  }));
}

export function fieldEquals(fieldPath, value) {
  return { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: firestoreValue(value) } };
}

export function fieldLessThanOrEqual(fieldPath, value) {
  return { fieldFilter: { field: { fieldPath }, op: 'LESS_THAN_OR_EQUAL', value: firestoreValue(value) } };
}

export function nowTimestamp() {
  return new Date();
}
