import React from 'react';
import { Navigate } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import { usePageMeta } from '../hooks/usePageMeta';
import team from '../content/team.json';
import { ORG_NAME } from '../content/site';
import pages from '../content/pages.json';

/**
 * Who we are: directors and advisors, with a face and a line each. A named
 * board is the governance signal donors and grant reviewers look for first.
 * Content lives in content/team.json; while it is empty this route sends
 * people to the front page rather than showing an empty board.
 */

const initial = (name) => name.trim().charAt(0).toUpperCase();

function Person({ name, role, bio, photo, links = [] }) {
  return (
    <li className="team-card">
      {photo ? (
        <img className="team-card__photo" src={photo} alt="" width="96" height="96" />
      ) : (
        <div className="team-card__photo team-card__photo--initial" aria-hidden="true">
          {initial(name)}
        </div>
      )}
      <div>
        <h3 className="team-card__name">{name}</h3>
        <p className="team-card__role">{role}</p>
        {bio && <p className="team-card__bio">{bio}</p>}
        {links.length > 0 && (
          <p className="team-card__links">
            {links.map(({ label, url }) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

function TeamPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/team'], path: '/team' });

  if (team.directors.length === 0) return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news team">
        <header className="news__intro">
          <h1>Who we are</h1>
          <p>
            {ORG_NAME} was formed in {team.founded} as a Texas nonprofit corporation. It is run by
            volunteers, and these are the people responsible for it.
          </p>
        </header>

        <section className="help-section" aria-labelledby="team-directors">
          <h2 id="team-directors">Board of directors</h2>
          <ul className="team-list">
            {team.directors.map((person) => (
              <Person key={person.name} {...person} />
            ))}
          </ul>
        </section>

        {team.advisors.length > 0 && (
          <section className="help-section" aria-labelledby="team-advisors">
            <h2 id="team-advisors">Advisors</h2>
            <ul className="team-list">
              {team.advisors.map((person) => (
                <Person key={person.name} {...person} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default TeamPage;
