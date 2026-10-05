import React from 'react';
import { Link } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Where an unknown address lands.
 *
 * Until now `*` redirected to `/`, which is the worst of both: a person who
 * followed a stale link was silently moved somewhere else and left to work
 * out for themselves that the thing they wanted was gone, and a crawler saw
 * the front page served under a hundred different URLs.
 *
 * The page is not an apology and not an error code. Someone who mistypes an
 * address on this site may be having a hard day, so it says plainly that
 * nothing is broken on their end and then points at the two things people
 * actually come here for. Get help is first, before the guides and before
 * anything of their own, for the same reason it leads the footer.
 *
 * It is `noindex`: a soft 404 is the one page on the site that should never
 * be in a search result. The status code is still 200, because CloudFront
 * rewrites 403 and 404 to `/index.html` so that deep links work at all, and
 * nothing in the bucket knows which paths the router accepts. The robots tag
 * is what keeps a mistyped URL out of the index.
 */

function NotFoundPage({ signedIn, onSignOut }) {
  usePageMeta({
    title: 'Page not found',
    description: 'That page is not here. Ways to get help, and the rest of the site.',
    noindex: true,
  });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news">
        <header className="news__intro">
          <h1>That page is not here</h1>
          <p>
            The link may be old, or the address may have a small typo in it. Nothing went
            wrong on your side.
          </p>
        </header>

        <ol className="news-list">
          <li className="news-list__item">
            <Link to="/help" className="news-card">
              <h3 className="news-card__title">Get help now</h3>
              <p className="news-card__summary">
                Crisis lines you can call or text, free and confidential, and where to find
                low-cost care.
              </p>
              <span className="news-card__more">Go to get help</span>
            </Link>
          </li>

          <li className="news-list__item">
            <Link to="/resources" className="news-card">
              <h3 className="news-card__title">Resources</h3>
              <p className="news-card__summary">
                Plain-language guides on paying for care and on mental health basics. Free, with
                no ads and no sign-up.
              </p>
              <span className="news-card__more">Go to the guides</span>
            </Link>
          </li>

          <li className="news-list__item">
            {signedIn ? (
              <Link to="/journal" className="news-card">
                <h3 className="news-card__title">Your journal</h3>
                <p className="news-card__summary">
                  Private to you, and yours to download or delete whenever you want.
                </p>
                <span className="news-card__more">Go to the journal</span>
              </Link>
            ) : (
              <Link to="/signin" className="news-card">
                <h3 className="news-card__title">Sign in</h3>
                <p className="news-card__summary">
                  For the private journal and the Experiments. An account is free, and the
                  guides do not need one.
                </p>
                <span className="news-card__more">Go to sign in</span>
              </Link>
            )}
          </li>
        </ol>

        <p className="news__status">
          Or start again from <Link to="/">the front page</Link>.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default NotFoundPage;
