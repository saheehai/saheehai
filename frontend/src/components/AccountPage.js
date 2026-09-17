import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookLock, Camera, Download, Sparkles, Trash2, UserX } from 'lucide-react';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import Alert from './Alert';
import FormInput from './FormInput';
import Avatar from './Avatar';
import ConfirmDialog from './ConfirmDialog';
import Sprout from './Sprout';
import awsService from '../services/awsService';
import * as cognito from '../services/cognitoService';
import { useProfile } from '../context/ProfileContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { fileToAvatarDataUrl } from '../utils/imageUtils';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * The Account page: who you are here, how you sign in, and what we hold.
 *
 * Five sections. Profile (picture and nickname), the companion's access and
 * the two data actions talk to our API. Email and password go straight from the browser to
 * Cognito, like signing in does, so a password never touches our servers.
 * Deleting the account is two steps in order: our API removes the rows,
 * then the browser deletes the Cognito user with the person's own session.
 * If the second step fails, the page says so plainly and offers a retry;
 * the data is already gone, and nothing is stranded.
 */

const MIN_PASSWORD_LENGTH = 12;
const NICKNAME_MAX = 30;

// What a delete-data or sign-out should clear from this browser.
const CHAT_AND_JOURNAL_KEYS = [
  STORAGE_KEYS.chatMessages,
  STORAGE_KEYS.conversationId,
  STORAGE_KEYS.journalDraft,
];

function passwordProblem(password) {
  if (!password) return null;
  if (password.length < MIN_PASSWORD_LENGTH) return `At least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Needs an uppercase letter, a lowercase letter and a number.';
  }
  return null;
}

function Section({ id, title, lead, children }) {
  return (
    <section className="account-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="account-section__title">
        {title}
      </h2>
      {lead && <p className="account-section__lead">{lead}</p>}
      {children}
    </section>
  );
}

// --- Profile ---------------------------------------------------------------

function ProfileSection() {
  const { profile, setProfile } = useProfile();
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);

  // The context may arrive after first render, on a fresh sign-in.
  useEffect(() => {
    setNickname(profile?.nickname || '');
    setAvatar(profile?.avatar || '');
  }, [profile]);

  const dirty = nickname !== (profile?.nickname || '') || avatar !== (profile?.avatar || '');

  const choose = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const save = useCallback(
    async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const saved = await awsService.saveProfile({
          nickname: nickname.trim(),
          avatar,
          shareNickname: profile?.share_nickname !== false,
          shareJournal: profile?.share_journal === true,
        });
        setProfile(saved);
        setNotice('Saved.');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, nickname, avatar, profile, setProfile]
  );

  return (
    <Section id="profile" title="Profile" lead="How you appear to yourself here. Both are optional.">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && !error && <Alert kind="success">{notice}</Alert>}

      <form onSubmit={save}>
        <div className="account-avatar">
          <Avatar src={avatar} name={nickname} size={96} className="account-avatar__img" />
          <div className="account-avatar__controls">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={choose}
              className="sr-only"
              id="avatar-file"
              disabled={busy}
            />
            <label htmlFor="avatar-file" className="page-heading__action account-avatar__pick">
              <Camera size={16} aria-hidden="true" />
              {avatar ? 'Change picture' : 'Add a picture'}
            </label>
            {avatar && (
              <button
                type="button"
                className="auth-link"
                onClick={() => setAvatar('')}
                disabled={busy}
              >
                Remove picture
              </button>
            )}
            <p className="account-avatar__policy">
              Your picture is only ever shown to you. It still has to follow our{' '}
              <Link to="/legal#terms">Terms</Link>: nothing graphic, sexual, violent or hateful,
              and no one else's photo without their permission. Accounts that break this rule
              are closed.
            </p>
          </div>
        </div>

        <FormInput
          label="Nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX))}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          placeholder="What should we call you?"
          hint="Letters, numbers and spaces, up to 30 characters. The companion will use it too."
          disabled={busy}
        />

        <button type="submit" className="account-submit" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Section>
  );
}

// --- What the companion can see --------------------------------------------

function Toggle({ id, icon, title, description, checked, onChange, disabled }) {
  return (
    <div className="sharing-row">
      <span className="sharing-row__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="sharing-row__body">
        <label className="sharing-row__title" htmlFor={id}>
          {title}
        </label>
        <p className="sharing-row__note">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        className="sharing-row__switch"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Two switches that decide what reaches the companion.
 *
 * They save the moment they are flipped: a privacy choice that waits behind
 * a Save button is a choice someone thinks they have made and has not. The
 * journal one starts off and stays off until it is turned on here.
 */
function SharingSection() {
  const { profile, setProfile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const shareNickname = profile?.share_nickname !== false;
  const shareJournal = profile?.share_journal === true;

  const update = useCallback(
    async (change) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const saved = await awsService.saveProfile({
          nickname: profile?.nickname || '',
          avatar: profile?.avatar || '',
          shareNickname,
          shareJournal,
          ...change,
        });
        setProfile(saved);
        setNotice('Saved.');
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, profile, shareNickname, shareJournal, setProfile]
  );

  return (
    <Section
      id="sharing"
      title="What the companion can see"
      lead="The chat only knows what you allow here. Turning something off takes effect on your next message."
    >
      {error && <Alert kind="error">{error}</Alert>}
      {notice && !error && <Alert kind="success">{notice}</Alert>}

      <Toggle
        id="share-nickname"
        icon={<Sparkles size={18} />}
        title="Use my nickname"
        description="The chat can greet you by the name you set above. With this off it does not know your name at all."
        checked={shareNickname}
        onChange={(value) => update({ shareNickname: value })}
        disabled={busy}
      />

      <Toggle
        id="share-journal"
        icon={<BookLock size={18} />}
        title="Read my recent journal entries"
        description="Your five most recent entries are sent with each message, so the chat can pick up where your writing left off. They leave our servers to reach the AI model, the same way your messages already do. Off unless you turn it on, and your journal stays private to you either way."
        checked={shareJournal}
        onChange={(value) => update({ shareJournal: value })}
        disabled={busy}
      />

      <p className="sharing-note">
        Nothing here trains a model. See the <Link to="/legal#privacy">Privacy Policy</Link> for
        what happens to a message once you send it.
      </p>
    </Section>
  );
}

// --- Sign-in details -------------------------------------------------------

function EmailForm({ email, onChanged }) {
  const [step, setStep] = useState('view'); // view | enter | code
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const reset = () => {
    setStep('view');
    setNewEmail('');
    setCode('');
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (step === 'enter') {
        if (newEmail.trim().toLowerCase() === email.toLowerCase()) {
          throw new Error('That is already your email address.');
        }
        await cognito.requestEmailChange(newEmail);
        setStep('code');
        setNotice(`We sent a code to ${newEmail.trim()}. Your current address keeps working until you enter it.`);
      } else if (step === 'code') {
        await cognito.confirmEmailChange(code);
        await onChanged();
        reset();
        setNotice('Your email address has been updated. Sign in with the new one from now on.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await cognito.resendEmailChangeCode();
      setNotice('Sent another code.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="account-form">
      <h3 className="account-form__title">Email</h3>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && !error && <Alert kind="success">{notice}</Alert>}

      {step === 'view' && (
        <div className="account-row">
          <span className="account-row__value">{email || 'Loading…'}</span>
          <button type="button" className="page-heading__action" onClick={() => setStep('enter')}>
            Change email
          </button>
        </div>
      )}

      {step === 'enter' && (
        <>
          <FormInput
            label="New email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={busy}
            hint="We will email a code to the new address. Newsletter sign-ups are separate; resubscribe from the new address if you want the updates."
          />
          <div className="account-actions">
            <button type="submit" className="account-submit" disabled={busy}>
              {busy ? 'One moment…' : 'Send code'}
            </button>
            <button type="button" className="auth-link" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'code' && (
        <>
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
          <div className="account-actions">
            <button type="submit" className="account-submit" disabled={busy}>
              {busy ? 'One moment…' : 'Confirm new email'}
            </button>
            <button type="button" className="auth-link" onClick={resend} disabled={busy}>
              Send another code
            </button>
            <button type="button" className="auth-link" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const problem = useMemo(() => passwordProblem(next), [next]);
  const mismatch = again && next !== again ? 'Those passwords do not match.' : null;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (problem || mismatch) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await cognito.changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setNotice('Your password has been changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="account-form">
      <h3 className="account-form__title">Password</h3>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && !error && <Alert kind="success">{notice}</Alert>}
      <FormInput
        label="Current password"
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        required
        disabled={busy}
      />
      <FormInput
        label="New password"
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        required
        disabled={busy}
        hint={problem || `At least ${MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`}
      />
      <FormInput
        label="New password again"
        type="password"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        autoComplete="new-password"
        required
        disabled={busy}
        hint={mismatch}
      />
      <button
        type="submit"
        className="account-submit"
        disabled={busy || !current || !next || !again || Boolean(problem) || Boolean(mismatch)}
      >
        {busy ? 'One moment…' : 'Change password'}
      </button>
    </form>
  );
}

// --- Data ------------------------------------------------------------------

function downloadJson(doc) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saheeh-ai-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataSection({ onDataDeleted }) {
  const [busy, setBusy] = useState(null); // 'export' | 'delete' | null
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const exportData = async () => {
    if (busy) return;
    setBusy('export');
    setError(null);
    setNotice(null);
    try {
      downloadJson(await awsService.exportData());
      setNotice('Your export has been downloaded. It is a plain JSON file; keep it somewhere private.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const deleteData = async () => {
    if (busy) return;
    setBusy('delete');
    setError(null);
    setNotice(null);
    try {
      const { deleted } = await awsService.deleteData();
      CHAT_AND_JOURNAL_KEYS.forEach((key) => localStorage.removeItem(key));
      onDataDeleted();
      setConfirming(false);
      setNotice(
        `Done. ${deleted.chat} chat messages, ${deleted.journal} journal entries and your profile were deleted. Your account is still here.`
      );
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      id="data"
      title="Your data"
      lead="Everything you have written here belongs to you. Take a copy, or clear it, whenever you like."
    >
      {error && <Alert kind="error">{error}</Alert>}
      {notice && !error && <Alert kind="success">{notice}</Alert>}

      <div className="account-cards">
        <div className="account-card">
          <h3 className="account-card__title">Download a copy</h3>
          <p className="account-card__text">
            Your chats, journal entries, profile and account details, as one JSON file. Server
            logs are not included; they hold no message text and expire after 30 days.
          </p>
          <button
            type="button"
            className="page-heading__action"
            onClick={exportData}
            disabled={Boolean(busy)}
          >
            <Download size={16} aria-hidden="true" />
            {busy === 'export' ? 'Preparing…' : 'Download my data'}
          </button>
        </div>

        <div className="account-card">
          <h3 className="account-card__title">Delete my chats and journal</h3>
          <p className="account-card__text">
            Removes every conversation, every journal entry and your profile picture and
            nickname. Your account and email stay, so you can keep using the site. This cannot
            be undone.
          </p>
          <button
            type="button"
            className="page-heading__action page-heading__action--danger"
            onClick={() => setConfirming(true)}
            disabled={Boolean(busy)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete my data
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete your chats and journal?"
          confirmLabel="Delete my data"
          confirmWord="DELETE"
          busy={busy === 'delete'}
          onConfirm={deleteData}
          onClose={() => setConfirming(false)}
        >
          <p>
            Every conversation and journal entry will be gone for good, along with your profile.
            If you want a copy, download it first.
          </p>
        </ConfirmDialog>
      )}
    </Section>
  );
}

// --- Delete account --------------------------------------------------------

function DeleteAccountSection({ email, onSignOut }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Set when the rows are gone but the Cognito step failed.
  const [dataGone, setDataGone] = useState(false);

  const finish = useCallback(() => {
    onSignOut();
    navigate('/', { replace: true, state: { accountDeleted: true } });
  }, [onSignOut, navigate]);

  const deleteAccount = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!dataGone) {
        const result = await awsService.deleteAccountData(email);
        const left = Object.values(result.remaining || {}).reduce((a, b) => a + b, 0);
        if (left > 0) {
          throw new Error('Some of your data could not be removed yet. Please try again in a moment.');
        }
        setDataGone(true);
      }
      await cognito.deleteAccount();
      finish();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      id="delete"
      title="Delete your account"
      lead="Leaves nothing behind: your account, chats, journal and profile are all removed."
    >
      {error && <Alert kind="error">{error}</Alert>}
      {dataGone && !busy && (
        <Alert kind="error">
          Your data has been deleted, but the account itself could not be removed. Try again, or{' '}
          <Link to="/support">contact us</Link> and we will finish it for you.
        </Alert>
      )}
      <p className="account-section__text">
        This is immediate and cannot be undone. Newsletter sign-ups are kept separately; use the
        unsubscribe link in any email to stop those.
      </p>
      <button
        type="button"
        className="page-heading__action page-heading__action--danger"
        onClick={() => setConfirming(true)}
        disabled={busy || !email}
      >
        <UserX size={16} aria-hidden="true" />
        {dataGone ? 'Try deleting the account again' : 'Delete my account'}
      </button>

      {confirming && (
        <ConfirmDialog
          title="Delete your account?"
          confirmLabel="Delete my account"
          confirmWord={email}
          confirmHint="Type your email address to continue"
          busy={busy}
          onConfirm={deleteAccount}
          onClose={() => setConfirming(false)}
        >
          <p>
            Your account, every conversation, every journal entry and your profile will be gone
            for good. You will be signed out straight away. If you want a copy of anything,
            download it first.
          </p>
        </ConfirmDialog>
      )}
    </Section>
  );
}

// --- Page ------------------------------------------------------------------

function AccountPage({ onSignOut }) {
  usePageMeta({ title: 'Account', description: 'Your profile, sign-in details and data.', path: '/account' });
  const { setProfile } = useProfile();
  const [account, setAccount] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const loadAccount = useCallback(async () => {
    try {
      setAccount(await cognito.getAccount());
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn onSignOut={onSignOut} />

      <div className="page-content account">
        <div className="page-heading">
          <div>
            <p className="page-heading__eyebrow">Your account</p>
            <h1 className="page-heading__title">Account</h1>
          </div>
        </div>

        {loadError && <Alert kind="error">{loadError}</Alert>}

        <ProfileSection />

        <SharingSection />

        <Section id="signin" title="Sign-in details" lead="Your email and password go straight to the sign-in service. We never see the password.">
          {account ? (
            <>
              <EmailForm email={account.email} onChanged={loadAccount} />
              <PasswordForm />
            </>
          ) : (
            !loadError && <Sprout label="Loading your details" size={40} />
          )}
        </Section>

        <DataSection onDataDeleted={() => setProfile({})} />

        <DeleteAccountSection email={account?.email || ''} onSignOut={onSignOut} />
      </div>

      <SiteFooter />
    </div>
  );
}

export default AccountPage;
