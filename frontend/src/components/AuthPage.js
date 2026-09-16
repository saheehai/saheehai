import React, { useCallback, useMemo, useState } from 'react';
import Alert from './Alert';
import FormInput from './FormInput';
import { COLORS, COMMON_STYLES } from '../utils/constants';
import * as cognito from '../services/cognitoService';

/**
 * Sign in, sign up, email confirmation and password reset.
 *
 * One component with a `mode`, rather than four routes: the flows hand off to
 * each other constantly (sign-up leads into confirmation, an unconfirmed
 * sign-in leads to the same place) and keeping the email in state across those
 * hops means nobody retypes it.
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
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

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
          onAuthenticated();
        } else if (mode === 'signUp') {
          if (passwordProblem) throw new Error(passwordProblem);
          const { confirmed } = await cognito.signUp(email, password);
          if (confirmed) {
            await cognito.signIn(email, password);
            onAuthenticated();
          } else {
            go('confirm', `We sent a confirmation code to ${email}.`);
          }
        } else if (mode === 'confirm') {
          await cognito.confirmSignUp(email, code);
          // Sign in straight away rather than bouncing back to a form the
          // person has already filled in once.
          await cognito.signIn(email, password);
          onAuthenticated();
        } else if (mode === 'forgot') {
          await cognito.forgotPassword(email);
          // Worded so it does not confirm whether the account exists.
          go('reset', `If an account exists for ${email}, a code is on its way.`);
        } else if (mode === 'reset') {
          if (passwordProblem) throw new Error(passwordProblem);
          await cognito.confirmNewPassword(email, code, password);
          await cognito.signIn(email, password);
          onAuthenticated();
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
    [busy, mode, email, password, code, passwordProblem, onAuthenticated, go]
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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>{copy.title}</h1>
          <p style={styles.subtitle}>{copy.subtitle}</p>
        </div>

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

          {passwordProblem && <p style={styles.hint}>{passwordProblem}</p>}

          <button
            type="submit"
            disabled={busy}
            style={{
              ...COMMON_STYLES.button,
              width: '100%',
              marginTop: '8px',
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'One moment…' : copy.submit}
          </button>
        </form>

        <div style={styles.links}>
          {mode === 'signIn' && (
            <>
              <button type="button" style={styles.link} onClick={() => go('signUp')}>
                Create an account
              </button>
              <button type="button" style={styles.link} onClick={() => go('forgot')}>
                Forgot password?
              </button>
            </>
          )}

          {mode === 'signUp' && (
            <button type="button" style={styles.link} onClick={() => go('signIn')}>
              I already have an account
            </button>
          )}

          {mode === 'confirm' && (
            <>
              <button type="button" style={styles.link} onClick={resend}>
                Send another code
              </button>
              <button type="button" style={styles.link} onClick={() => go('signIn')}>
                Back to sign in
              </button>
            </>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" style={styles.link} onClick={() => go('signIn')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>

      <p style={styles.footnote}>
        Saheeh AI is a wellness companion, not a therapist or medical
        professional. If you are in crisis, please contact your local emergency
        services or a crisis line.
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    backgroundColor: COLORS.cream,
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '32px 28px',
    backgroundColor: COLORS.cream,
    border: `2px solid ${COLORS.brownBorder}`,
    borderRadius: '16px',
    boxSizing: 'border-box',
  },
  header: { marginBottom: '20px' },
  title: {
    margin: '0 0 6px',
    fontSize: '26px',
    fontWeight: '600',
    color: COLORS.primary,
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    lineHeight: 1.5,
    color: COLORS.mediumBrown,
  },
  hint: {
    margin: '-8px 0 12px',
    fontSize: '13px',
    color: COLORS.errorBorder,
  },
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '18px',
  },
  link: {
    padding: 0,
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: COLORS.primary,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  footnote: {
    maxWidth: '420px',
    marginTop: '20px',
    fontSize: '12px',
    lineHeight: 1.6,
    textAlign: 'center',
    color: COLORS.mediumBrown,
  },
};
