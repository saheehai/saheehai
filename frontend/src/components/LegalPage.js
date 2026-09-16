import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import SiteNav from './SiteNav';
import {
  LAST_UPDATED,
  ORG_NAME,
  PRIVACY,
  TERMS,
  TURNSTILE_ADDENDUM,
  TURNSTILE_INTRO,
} from '../content/legal';

/**
 * One page for the Terms of Use, the Privacy Policy and the Cloudflare
 * Turnstile addendum, each addressable by hash (/legal#privacy). The text
 * itself lives in content/legal.js.
 */

const SECTIONS = [
  { id: 'terms', title: 'Terms of Use', body: TERMS },
  { id: 'privacy', title: 'Privacy Policy', body: PRIVACY },
  {
    id: 'turnstile',
    title: 'Cloudflare Turnstile Privacy Addendum',
    intro: TURNSTILE_INTRO,
    body: TURNSTILE_ADDENDUM,
  },
];

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// The Markdown starts its headings at "##" so it reads sensibly on its own;
// on this page each document already sits under an h2, so step them down.
// Internal links route through the router; external ones open in a new tab.
const components = {
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  a: ({ href = '', children }) => {
    if (href.startsWith('#')) return <a href={href}>{children}</a>;
    if (href.startsWith('/')) return <Link to={href}>{children}</Link>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

function LegalPage({ signedIn, onSignOut }) {
  const { hash } = useLocation();

  // The router does not scroll to hashes on its own.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news legal">
        <header className="news__intro">
          <h1>Legal</h1>
          <p>
            How {ORG_NAME} works with you, and what happens to what you share. Last updated{' '}
            <time dateTime={LAST_UPDATED}>{formatDate(LAST_UPDATED)}</time>.
          </p>
          <nav className="legal__toc" aria-label="On this page">
            {SECTIONS.map(({ id, title }) => (
              <a key={id} href={`#${id}`}>
                {title}
              </a>
            ))}
          </nav>
        </header>

        {SECTIONS.map(({ id, title, intro, body }) => (
          <section key={id} id={id} className="legal__section">
            <h2 className="legal__title">{title}</h2>
            {intro && (
              <div className="news-article__body legal__intro">
                <ReactMarkdown components={components}>{intro}</ReactMarkdown>
              </div>
            )}
            <div className={`news-article__body ${intro ? 'legal__quoted' : ''}`.trim()}>
              <ReactMarkdown components={components}>{body}</ReactMarkdown>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default LegalPage;
