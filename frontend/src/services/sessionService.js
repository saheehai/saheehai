/**
 * Device session.
 *
 * The app used to send `user_id: 'anonymous'` with every request, so every
 * visitor shared one identity and anyone could read anyone's journal. Identity
 * is now issued by the server: the browser solves a Cloudflare Turnstile
 * challenge, exchanges it for a signed token, and sends that token onward.
 *
 * The token is opaque here. It is signed server-side, so nothing in this file
 * can forge or alter the identity it carries.
 */

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

const STORAGE_KEY = 'saheehAI_deviceToken';
// Renew a little early rather than letting a request fail on a just-expired token.
const RENEW_MARGIN_SECONDS = 300;

let scriptPromise = null;
let widgetId = null;
let inFlight = null;

function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Could not load the verification challenge'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Container for the widget. Kept in the DOM so Turnstile can show a prompt
 *  if it decides the visitor needs one. */
function challengeContainer() {
  let el = document.getElementById('turnstile-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'turnstile-container';
    el.style.position = 'fixed';
    el.style.bottom = '16px';
    el.style.right = '16px';
    el.style.zIndex = '2147483647';
    document.body.appendChild(el);
  }
  return el;
}

async function solveChallenge() {
  const turnstile = await loadTurnstileScript();

  return new Promise((resolve, reject) => {
    const settle = (fn) => (value) => {
      try {
        turnstile.reset(widgetId);
      } catch {
        /* widget already gone */
      }
      fn(value);
    };

    if (widgetId === null) {
      widgetId = turnstile.render(challengeContainer(), {
        sitekey: SITE_KEY,
        // Stays out of the way unless the visitor actually looks suspicious.
        appearance: 'interaction-only',
        callback: (token) => settle(resolve)(token),
        'error-callback': () => settle(reject)(new Error('Verification failed')),
        'timeout-callback': () => settle(reject)(new Error('Verification timed out')),
      });
    } else {
      turnstile.reset(widgetId);
    }

    try {
      turnstile.execute(widgetId, { sitekey: SITE_KEY });
    } catch (err) {
      reject(err);
    }
  });
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode; the token simply will not persist across reloads */
  }
}

function isFresh(session) {
  return (
    session &&
    typeof session.token === 'string' &&
    typeof session.expires_at === 'number' &&
    session.expires_at - RENEW_MARGIN_SECONDS > Date.now() / 1000
  );
}

class SessionService {
  constructor(sessionEndpointResolver) {
    this._resolveEndpoint = sessionEndpointResolver;
  }

  get configured() {
    return Boolean(SITE_KEY);
  }

  /** Current token, minting or renewing one if needed. */
  async getToken() {
    const stored = readStored();
    if (isFresh(stored)) return stored.token;

    // Collapse concurrent callers onto a single challenge; solving twice in
    // parallel would burn a challenge and can trip Turnstile's own limits.
    if (!inFlight) {
      inFlight = this._mint(stored?.token).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  async _mint(previousToken) {
    if (!SITE_KEY) {
      throw new Error(
        'REACT_APP_TURNSTILE_SITE_KEY is not set. The app cannot verify this browser.'
      );
    }

    const turnstileToken = await solveChallenge();

    const headers = { 'Content-Type': 'application/json' };
    // Present the old token so the server can carry the identity forward
    // instead of orphaning this visitor's journal on renewal.
    if (previousToken) headers.Authorization = `Bearer ${previousToken}`;

    const response = await fetch(this._resolveEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ turnstile_token: turnstileToken }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || 'Could not verify this browser');
    }

    const session = await response.json();
    writeStored(session);
    return session.token;
  }

  /** Drop the stored token so the next request re-challenges. */
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  }

  get userId() {
    return readStored()?.user_id ?? null;
  }
}

export default SessionService;
