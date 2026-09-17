import { solveChallenge } from './turnstileService';

/**
 * The newsletter list. Public routes, no account: the only gate is a
 * Turnstile challenge, verified server-side, and the confirmation email.
 */

const API_ENDPOINT = (process.env.REACT_APP_API_ENDPOINT || '').replace(/\/+$/, '');

async function request(path, options = {}) {
  if (!API_ENDPOINT) {
    throw new Error('Sign-ups are not available right now.');
  }
  const response = await fetch(`${API_ENDPOINT}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(detail.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return detail;
}

/** Ask to join. Resolves once the confirmation email has been sent. */
export async function subscribe(email, source) {
  const token = await solveChallenge('subscribe');
  return request('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, source, turnstile_token: token }),
  });
}

/** Follow the link in the confirmation email. */
export function confirm(token) {
  return request(`/subscribe/confirm?token=${encodeURIComponent(token)}`);
}

/** Follow the link at the foot of any newsletter. */
export function unsubscribe(token) {
  return request(`/subscribe/unsubscribe?token=${encodeURIComponent(token)}`);
}
