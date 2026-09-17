import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Phone } from 'lucide-react';
import LegalLinks from './LegalLinks';
import { CONTACT_EMAIL, EIN, ORG_NAME, ORG_STATUS, REPO_URL } from '../content/site';
import team from '../content/team.json';

/**
 * The foot of every page except the chat. Three things, in this order:
 * how to get help right now, where else to go on the site, and who we are.
 *
 * The crisis line comes first and is on every page because a person in
 * distress may land anywhere, and the peers we measured against (NAMI, JED,
 * Trevor, Crisis Text Line) all keep it in reach at all times.
 *
 * The two numbers are rows you press, not words in a sentence. On a phone,
 * 988 set inside a paragraph was a target about the size of a fingernail.
 */

const LINKS = [
  { to: '/help', label: 'Get help' },
  { to: '/resources', label: 'Resources' },
  { to: '/news', label: 'News' },
  { to: '/mission', label: 'Mission' },
  { to: '/support', label: 'Support us' },
];

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__crisis">
          <p className="footer-crisis__lead">
            <strong>In crisis?</strong> Reach a person right now. Free, and confidential.
          </p>

          <div className="footer-crisis__actions">
            <a className="footer-crisis__action" href="tel:988">
              <Phone size={17} strokeWidth={2.25} aria-hidden="true" />
              <span>Call or text 988</span>
            </a>
            <a className="footer-crisis__action" href="sms:741741?&body=HOME">
              <MessageSquare size={17} strokeWidth={2.25} aria-hidden="true" />
              <span>Text HOME to 741741</span>
            </a>
          </div>

          <p className="footer-crisis__more">
            Outside the US,{' '}
            <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
              findahelpline.com
            </a>
            . <Link to="/help">More ways to get help</Link>.
          </p>
        </div>

        <nav className="site-footer__nav" aria-label="Site">
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
          {team.directors.length > 0 && <Link to="/team">Who we are</Link>}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Open source
          </a>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
        </nav>

        <p className="site-footer__note">
          The wellness companion in Experiments is a beta feature and an AI, not a therapist or
          medical professional. Nothing on this site is medical advice.
        </p>

        <LegalLinks />

        <p className="site-footer__org">
          © {year} {ORG_NAME}, {ORG_STATUS}
          {EIN && ` EIN ${EIN}.`}
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
