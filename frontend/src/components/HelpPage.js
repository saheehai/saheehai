import React from 'react';
import { Link } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import { usePageMeta } from '../hooks/usePageMeta';
import { CRISIS_LINES, FIND_CARE, SUPPORT_LINES } from '../content/resources';
import pages from '../content/pages.json';

/**
 * Get help: the page a person in a hard moment should reach in one click.
 * Numbers first, biggest, no account, no scrolling past a pitch.
 */

function LineList({ items }) {
  return (
    <ul className="help-list">
      {items.map(({ name, how, href, url, note }) => (
        <li key={name} className="help-item">
          <div className="help-item__head">
            <span className="help-item__name">{name}</span>
            {how &&
              (href ? (
                <a className="help-item__how" href={href}>
                  {how}
                </a>
              ) : url ? (
                <a className="help-item__how" href={url} target="_blank" rel="noopener noreferrer">
                  {how}
                </a>
              ) : (
                <span className="help-item__how">{how}</span>
              ))}
          </div>
          {note && <p className="help-item__note">{note}</p>}
          {url && how && href && (
            <a className="help-item__site" href={url} target="_blank" rel="noopener noreferrer">
              {url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          )}
          {url && !how && (
            <a className="help-item__site" href={url} target="_blank" rel="noopener noreferrer">
              {url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function HelpPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/help'], path: '/help' });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news help">
        <header className="news__intro">
          <h1>Get help now</h1>
          <p>
            If you are in danger or thinking about ending your life, please reach one of these
            right now. They are free, confidential, and staffed by people.
          </p>
        </header>

        <section className="help-section help-section--urgent" aria-labelledby="help-crisis">
          <h2 id="help-crisis">Right now</h2>
          <LineList items={CRISIS_LINES} />
        </section>

        <section className="help-section" aria-labelledby="help-support">
          <h2 id="help-support">Talk to someone</h2>
          <p className="help-section__lede">
            Not every hard moment is an emergency. These lines are for the rest: questions,
            worry about someone else, or just needing a person on the other end.
          </p>
          <LineList items={SUPPORT_LINES} />
        </section>

        <section className="help-section" aria-labelledby="help-care">
          <h2 id="help-care">Find care you can afford</h2>
          <p className="help-section__lede">
            Cost keeps more people from care than anything else. These are the places we would
            start. Our <Link to="/resources">Resources</Link> have step-by-step guides.
          </p>
          <LineList items={FIND_CARE} />
        </section>

        <p className="help-footnote">
          Saheeh AI is not a crisis service and does not monitor anything in real time. The
          companion in Experiments is an AI and cannot help in an emergency.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default HelpPage;
