import React, { useState } from 'react';
import { subscribe } from '../services/subscribeService';

/**
 * One email field. Used on the front page, the Support page and the News
 * page, so the copy around it is a prop and the mechanics live here.
 *
 * Double opt-in: the address is not on the list until the person clicks the
 * link we email them. Nothing else is collected, and the Privacy Policy
 * says so.
 */
function NewsletterForm({ source = 'site', heading, blurb, compact = false }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setState('sending');
    setMessage('');
    try {
      await subscribe(address, source);
      setState('sent');
      setMessage('Check your inbox for a confirmation link. Nothing arrives until you click it.');
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <form className={`newsletter ${compact ? 'newsletter--compact' : ''}`.trim()} onSubmit={onSubmit}>
      {heading && <h2 className="newsletter__heading">{heading}</h2>}
      {blurb && <p className="newsletter__blurb">{blurb}</p>}
      <div className="newsletter__row">
        <label className="sr-only" htmlFor={`newsletter-email-${source}`}>
          Email address
        </label>
        <input
          id={`newsletter-email-${source}`}
          className="newsletter__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === 'sending'}
        />
        <button
          type="submit"
          className="auth-submit newsletter__button"
          disabled={state === 'sending' || !email.trim()}
        >
          {state === 'sending' ? 'Sending…' : 'Keep me posted'}
        </button>
      </div>
      {message && (
        <p
          className={`newsletter__status ${state === 'error' ? 'newsletter__status--error' : ''}`.trim()}
          role="status"
        >
          {message}
        </p>
      )}
      <p className="newsletter__fine">
        Occasional email, only from us. Unsubscribe with one click. We never sell or share your
        address.
      </p>
    </form>
  );
}

export default NewsletterForm;
