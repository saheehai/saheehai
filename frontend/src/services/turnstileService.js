/**
 * Cloudflare Turnstile challenge.
 *
 * Used only at sign-up. Account creation goes from the browser straight to
 * Cognito, and a PreSignUp trigger verifies this token server-side before
 * letting the account exist — without it, accounts could be minted in bulk
 * and the per-account quota would mean nothing.
 *
 * The widget stays hidden unless Cloudflare actually wants the visitor to do
 * something. A "Verify you are human" box parked in the corner of every page
 * is noise for the large majority who are cleared silently.
 */

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

// Echoed back by siteverify and checked server-side, so a token minted for
// another surface cannot be replayed at sign-up.
const ACTION = 'signup';

let scriptPromise = null;
let widgetId = null;

export const isConfigured = () => Boolean(SITE_KEY);

function loadScript() {
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

function container() {
  let el = document.getElementById('turnstile-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'turnstile-container';
    el.setAttribute('aria-live', 'polite');
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.3)',
    });
    document.body.appendChild(el);
  }
  return el;
}

const show = () => {
  container().style.display = 'flex';
};
const hide = () => {
  container().style.display = 'none';
};

/** Solve a challenge and resolve with the token. */
export function solveChallenge() {
  if (!SITE_KEY) {
    return Promise.reject(
      new Error('REACT_APP_TURNSTILE_SITE_KEY is not set. Sign-up cannot be verified.')
    );
  }

  return loadScript().then(
    (turnstile) =>
      new Promise((resolve, reject) => {
        const settle = (fn) => (value) => {
          hide();
          try {
            turnstile.reset(widgetId);
          } catch {
            /* widget already gone */
          }
          fn(value);
        };

        if (widgetId === null) {
          widgetId = turnstile.render(container(), {
            sitekey: SITE_KEY,
            action: ACTION,
            appearance: 'interaction-only',
            // Reveal the overlay only for a challenge that genuinely needs
            // the visitor; a silent pass should never be visible.
            'before-interactive-callback': show,
            'after-interactive-callback': hide,
            callback: (token) => settle(resolve)(token),
            'error-callback': () => settle(reject)(new Error('Verification failed')),
            'timeout-callback': () => settle(reject)(new Error('Verification timed out')),
          });
        } else {
          turnstile.reset(widgetId);
        }

        try {
          turnstile.execute(widgetId, { sitekey: SITE_KEY, action: ACTION });
        } catch (err) {
          hide();
          reject(err);
        }
      })
  );
}
