import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The small underlined row of legal links: Privacy, Terms, and the Cloudflare
 * Turnstile notice. Lives at the foot of the front page and inside the chat
 * acknowledgement.
 *
 * `newTab` opens the pages in a fresh tab. The chat acknowledgement uses it so
 * reading the terms does not close the modal or leave the conversation.
 */
const LINKS = [
  { to: '/legal#privacy', label: 'Privacy Policy' },
  { to: '/legal#terms', label: 'Terms of Use' },
  { to: '/legal#turnstile', label: 'Cloudflare Turnstile notice' },
];

function LegalLinks({ newTab = false, className = '' }) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal">
      {LINKS.map(({ to, label }, i) => (
        <React.Fragment key={to}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {newTab ? (
            <a href={to} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ) : (
            <Link to={to}>{label}</Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default LegalLinks;
