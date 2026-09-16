import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from './Alert';
import FormInput from './FormInput';
import ChatBackdrop from './ChatBackdrop';
import * as cognito from '../services/cognitoService';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Sign in, sign up, email confirmation and password reset.
 *
 * One component with a `mode`, rather than four routes: the flows hand off to
 * each other constantly (sign-up leads into confirmation, an unconfirmed
 * sign-in leads to the same place) and keeping the email in state across those
 * hops means nobody retypes it.
 *
 * It floats over a blurred still of the chat, so the app is visibly right
 * there behind the door rather than replaced by a form.
 */

const MIN_PASSWORD_LENGTH = 12;

const MODES = {
  signIn: {
    title: 'Welcome back',
    subtitle: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
  },
  signUp: {
    title: 'Create an account',
    subtitle: 'Your journal is private to you, and stays that way.',
    submit: 'Create account',
  },
  confirm: {
    title: 'Check your email',
    subtitle: 'We sent you a six-digit code.',
    submit: 'Confirm',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: "We'll email you a code to set a new one.",
    submit: 'Send code',
  },
  reset: {
    title: 'Choose a new password',
    subtitle: 'Enter the code we emailed you, and a new password.',
    submit: 'Save password',
  },
};

export default function AuthPage({ onAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  // "Create an account" on the front page opens straight onto sign-up.
  const [mode, setMode] = useState(location.state?.mode === 'signUp' ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(() => {
    // Set by the idle timer just before it signed the person out.
    try {
      if (sessionStorage.getItem(STORAGE_KEYS.idleSignedOut)) {
        sessionStorage.removeItem(STORAGE_KEYS.idleSignedOut);
        return 'You were signed out after a period of inactivity. Sign in to continue.';
      }
    } catch {
      /* nothing to explain */
    }
    return null;
  });

  const copy = MODES[mode];

  const go = useCallback((next, message = null) => {
    setMode(next);
    setError(null);
    setNotice(message);
    setCode('');
  }, []);

  const passwordProblem = useMemo(() => {
    if (mode !== 'signUp' && mode !== 'reset') return null;
    if (!password) return null;
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `At least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return 'Needs an uppercase letter, a lowercase letter and a number.';
    }
    return null;
  }, [mode, password]);

  // Back to wherever the guard sent them from; otherwise the front page, so
  // a first sign-in lands on who we are rather than straight into the chat.
  const finish = useCallback(() => {
    onAuthenticated();
    navigate(location.state?.from || '/', { replace: true });
  }, [onAuthenticated, navigate, location.state]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (busy) return;

      setError(null);
      setNotice(null);
      setBusy(true);

      try {
        if (mode === 'signIn') {
          await cognito.signIn(email, password);
          finish();
        } else if (mode === 'signUp') {
          if (passwordProblem) throw new Error(passwordProblem);
          const { confirmed } = await cognito.signUp(email, password);
          if (confirmed) {
            await cognito.signIn(email, password);
            finish();
          } else {
            go('confirm', `We sent a confirmation code to ${email}.`);
          }
        } else if (mode === 'confirm') {
          await cognito.confirmSignUp(email, code);
          // Sign in straight away rather than bouncing back to a form the
          // person has already filled in once.
          await cognito.signIn(email, password);
          finish();
        } else if (mode === 'forgot') {
          await cognito.forgotPassword(email);
          // Worded so it does not confirm whether the account exists.
          go('reset', `If an account exists for ${email}, a code is on its way.`);
        } else if (mode === 'reset') {
          if (passwordProblem) throw new Error(passwordProblem);
          await cognito.confirmNewPassword(email, code, password);
          await cognito.signIn(email, password);
          finish();
        }
      } catch (err) {
        if (err.needsConfirmation) {
          go('confirm', 'This account still needs confirming. Enter the code we emailed you.');
        } else {
          setError(err.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, mode, email, password, code, passwordProblem, finish, go]
  );

  const resend = useCallback(async () => {
    setError(null);
    try {
      await cognito.resendConfirmationCode(email);
      setNotice('Sent another code.');
    } catch (err) {
      setError(err.message);
    }
  }, [email]);

  const needsPassword = mode !== 'confirm' && mode !== 'forgot';
  const needsCode = mode === 'confirm' || mode === 'reset';

  return (
    <div className="auth-scene">
      <ChatBackdrop />

      <div className="auth-overlay">
        <div className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <div className="auth-card">
            <div className="auth-brand">
              <img src="/saheeh-favicon/favicon.svg" alt="" width="36" height="36" />
              <span>Saheeh AI</span>
            </div>

            <h1 id="auth-title" className="auth-title">
              {copy.title}
            </h1>
            <p className="auth-subtitle">{copy.subtitle}</p>

            {error && <Alert kind="error">{error}</Alert>}
            {notice && !error && <Alert kind="success">{notice}</Alert>}

            <form onSubmit={handleSubmit}>
              <FormInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={busy || mode === 'confirm' || mode === 'reset'}
              />

              {needsCode && (
                <FormInput
                  label="Code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  required
                  disabled={busy}
                />
              )}

              {needsPassword && (
                <FormInput
                  label={mode === 'reset' ? 'New password' : 'Password'}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  disabled={busy}
                />
              )}

              {passwordProblem && <p className="auth-hint">{passwordProblem}</p>}

              <button type="submit" disabled={busy} className="auth-submit">
                {busy ? 'One moment…' : copy.submit}
              </button>
            </form>

            <div className="auth-links">
              {mode === 'signIn' && (
                <>
                  <button type="button" className="auth-link" onClick={() => go('signUp')}>
                    Create an account
                  </button>
                  <button type="button" className="auth-link" onClick={() => go('forgot')}>
                    Forgot password?
                  </button>
                </>
              )}

              {mode === 'signUp' && (
                <button type="button" className="auth-link" onClick={() => go('signIn')}>
                  I already have an account
                </button>
              )}

              {mode === 'confirm' && (
                <>
                  <button type="button" className="auth-link" onClick={resend}>
                    Send another code
                  </button>
                  <button type="button" className="auth-link" onClick={() => go('signIn')}>
                    Back to sign in
                  </button>
                </>
              )}

              {(mode === 'forgot' || mode === 'reset') && (
                <button type="button" className="auth-link" onClick={() => go('signIn')}>
                  Back to sign in
                </button>
              )}
            </div>
          </div>

          <p className="auth-footnote">
            Saheeh AI is a wellness companion, not a therapist or medical professional. If you
            are in crisis, please contact your local emergency services or a crisis line.
            <br />
            <Link to="/" className="auth-footnote__link">
              About Saheeh AI
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
