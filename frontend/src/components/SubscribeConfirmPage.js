import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import Sprout from './Sprout';
import { confirm, unsubscribe } from '../services/subscribeService';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Where the links in our emails land: /subscribe/confirm?token=… and
 * /subscribe/unsubscribe?token=…. One request, one sentence back.
 */

const COPY = {
  confirm: {
    title: 'Confirming your email',
    done: "You're on the list. Thank you. We will write when there is something worth saying.",
  },
  unsubscribe: {
    title: 'Unsubscribing',
    done: "You're off the list. No hard feelings, and you can come back any time.",
  },
};

function SubscribeConfirmPage({ signedIn, onSignOut }) {
  const { action } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const copy = COPY[action];

  usePageMeta({ title: copy ? copy.title : 'Newsletter', path: `/subscribe/${action}` });

  const [state, setState] = useState('working'); // working | done | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!copy || !token) {
      setState('error');
      setMessage('That link is missing something. Please use the link from the email.');
      return undefined;
    }
    let cancelled = false;
    const call = action === 'confirm' ? confirm : unsubscribe;
    call(token)
      .then(() => {
        if (!cancelled) setState('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setMessage(err.message || 'That link did not work. It may have expired.');
      });
    return () => {
      cancelled = true;
    };
  }, [action, token, copy]);

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news">
        <header className="news__intro">
          <h1>{copy ? copy.title : 'Newsletter'}</h1>
        </header>
        {state === 'working' && <Sprout label="One moment" />}
        {state === 'done' && <p className="news__status">{copy.done}</p>}
        {state === 'error' && <p className="news__status">{message}</p>}
        <p>
          <Link to="/" className="auth-link">
            ← Back to Saheeh AI
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default SubscribeConfirmPage;
