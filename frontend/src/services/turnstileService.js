/**
 * Cloudflare Turnstile challenge.
 *
 * Used at sign-up and on the newsletter form. Account creation goes from the
 * browser straight to Cognito, and a PreSignUp trigger verifies this token
 * server-side before letting the account exist — without it, accounts could
 * be minted in bulk and the per-account quota would mean nothing. The
 * newsletter route verifies its own token the same way.
 *
 * The widget stays hidden unless Cloudflare actually wants the visitor to do
 * something. A "Verify you are human" box parked in the corner of every page
 * is noise for the large majority who are cleared silently.
 *
 * Each attempt renders its own widget and removes it once a token has been
 * handed back. A widget left alive keeps working after the token is consumed:
 * Cloudflare re-runs the challenge whenever the token expires (every few
 * minutes), and any re-run that wants interaction pops the overlay over
 * whatever page the person is on. Tokens are single-use and short-lived, so
 * there is nothing to keep around anyway.
 */

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

// Echoed back by siteverify and checked server-side, so a token minted for
// one surface cannot be replayed against another.
const DEFAULT_ACTION = 'signup';

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
export function solveChallenge(action = DEFAULT_ACTION) {
  if (!SITE_KEY) {
    return Promise.reject(
      new Error('REACT_APP_TURNSTILE_SITE_KEY is not set. Sign-up cannot be verified.')
    );
  }

  return loadScript().then(
    (turnstile) =>
      new Promise((resolve, reject) => {
        // Only one attempt at a time. A second call while the first is still
        // running would otherwise render over the top of it.
        if (widgetId !== null) {
          try {
            turnstile.remove(widgetId);
          } catch {
            /* widget already gone */
          }
          widgetId = null;
        }

        const settle = (fn) => (value) => {
          hide();
          try {
            turnstile.remove(widgetId);
          } catch {
            /* widget already gone */
          }
          widgetId = null;
          fn(value);
        };

        try {
          widgetId = turnstile.render(container(), {
            sitekey: SITE_KEY,
            action,
            appearance: 'interaction-only',
            // Run only when asked, and never again on our behalf. The token
            // is consumed the moment it arrives, so a refreshed one would
            // have nobody to go to and would only surface as a stray prompt.
            execution: 'execute',
            'refresh-expired': 'never',
            'refresh-timeout': 'never',
            // Reveal the overlay only for a challenge that genuinely needs
            // the visitor; a silent pass should never be visible.
            'before-interactive-callback': show,
            'after-interactive-callback': hide,
            callback: (token) => settle(resolve)(token),
            'error-callback': () => settle(reject)(new Error('Verification failed')),
            'expired-callback': () => settle(reject)(new Error('Verification expired')),
            'timeout-callback': () => settle(reject)(new Error('Verification timed out')),
          });
          turnstile.execute(widgetId);
        } catch (err) {
          settle(reject)(err);
        }
      })
  );
}
