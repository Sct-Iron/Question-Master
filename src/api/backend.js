import { auth } from '../firebase';

const backendUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function callBackend(name, data = {}) {
  if (!backendUrl) throw new Error('The backend API URL is not configured.');
  const user = auth.currentUser;
  if (!user) {
    const error = new Error('You must be signed in.');
    error.code = 'unauthenticated';
    throw error;
  }
  const token = await user.getIdToken();
  const response = await fetch(`${backendUrl}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Backend request failed.');
    error.code = response.status === 401 ? 'unauthenticated'
      : response.status === 403 ? 'permission-denied'
        : response.status === 404 ? 'not-found'
          : response.status === 409 ? 'already-exists'
            : 'internal';
    throw error;
  }
  return { data: body };
}
