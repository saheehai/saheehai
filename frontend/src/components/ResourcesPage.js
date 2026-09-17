import React from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import Alert from './Alert';
import Sprout from './Sprout';
import NewsletterForm from './NewsletterForm';
import { formatDate, isSafeSlug, useContentJson } from '../hooks/useContentJson';
import { usePageMeta } from '../hooks/usePageMeta';
import pages from '../content/pages.json';

/**
 * Resources: plain-language guides to paying for care and to mental health
 * basics. Same pipeline as News: Markdown in the repo's `resources/`
 * folder, JSON under /resources/ at build time, fetched here.
 *
 * Each article carries a `track`, a `status` (draft or published), an
 * `updated` date and, once a clinician has looked at it, a `reviewed_by`
 * line. Drafts are shown, clearly labelled, so that reviewers can read them
 * in place; the label goes away when the front matter changes.
 */

export const TRACKS = {
  'paying-for-care': {
    title: 'Paying for care',
    blurb: 'Hospital bills, charity care, sliding scales, prescriptions, and the programs that already exist to help.',
  },
  'mental-health-basics': {
    title: 'Mental health basics',
    blurb: 'What the different kinds of help are, what a first appointment is like, and how to talk about it.',
  },
};

const ERROR = 'Could not load the resources right now. Please try again in a moment.';

const components = {
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

function DraftNotice() {
  return (
    <p className="resource-draft" role="note">
      <strong>Draft.</strong> This guide has not yet been reviewed by a clinician or a benefits
      counselor. Check anything here against the source it links to before acting on it.
    </p>
  );
}

export function ResourcesListPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/resources'], path: '/resources' });
  const { data, error } = useContentJson('resources', 'index.json', ERROR);
  const articles = data ? data.articles : [];

  const byTrack = Object.keys(TRACKS).map((key) => ({
    key,
    ...TRACKS[key],
    items: articles.filter((a) => a.track === key),
  }));
  const other = articles.filter((a) => !TRACKS[a.track]);

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news resources">
        <header className="news__intro">
          <h1>Resources</h1>
          <p>
            Short, practical guides. If you need someone right now, go to <Link to="/help">get help</Link>.
          </p>
        </header>

        {error && <Alert kind="error">{error}</Alert>}
        {data === null && !error && <Sprout label="Loading the resources" />}
        {(data === false || (data && articles.length === 0)) && (
          <p className="news__status">Nothing here yet. The first guides are being written.</p>
        )}

        {articles.length > 0 &&
          byTrack.map(({ key, title, blurb, items }) => (
            <section key={key} className="resources-track" aria-labelledby={`track-${key}`}>
              <h2 id={`track-${key}`}>{title}</h2>
              <p className="resources-track__blurb">{blurb}</p>
              {items.length === 0 ? (
                <p className="news__status">Coming soon.</p>
              ) : (
                <ol className="news-list">
                  {items.map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </ol>
              )}
            </section>
          ))}

        {other.length > 0 && (
          <section className="resources-track" aria-labelledby="track-other">
            <h2 id="track-other">More</h2>
            <ol className="news-list">
              {other.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </ol>
          </section>
        )}

        <NewsletterForm
          source="resources"
          heading="New guides, when they land"
          blurb="One email when a new guide is published. Nothing else."
          compact
        />
      </main>

      <SiteFooter />
    </div>
  );
}

function ArticleCard({ article }) {
  return (
    <li className="news-list__item">
      <Link to={`/resources/${article.slug}`} className="news-card">
        <span className="news-card__date">
          {article.status === 'draft' ? 'Draft · ' : ''}Updated {formatDate(article.updated)}
        </span>
        <h3 className="news-card__title">{article.title}</h3>
        {article.summary && <p className="news-card__summary">{article.summary}</p>}
        <span className="news-card__more">Read the guide</span>
      </Link>
    </li>
  );
}

export function ResourceArticlePage({ signedIn, onSignOut }) {
  const { slug } = useParams();
  const safe = isSafeSlug(slug);
  const { data, error } = useContentJson('resources', safe ? `${slug}.json` : 'missing.json', ERROR);

  usePageMeta({
    title: data ? data.title : 'Resources',
    description: data ? data.summary : pages['/resources'].description,
    path: `/resources/${slug}`,
  });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news resources">
        {error && <Alert kind="error">{error}</Alert>}
        {data === null && !error && <Sprout label="Loading the guide" />}

        {data === false && (
          <div className="news__status">
            <p>That guide does not exist.</p>
            <Link to="/resources" className="auth-link">
              Back to all resources
            </Link>
          </div>
        )}

        {data && (
          <article className="news-article">
            <p className="news-card__date">
              {TRACKS[data.track] ? TRACKS[data.track].title : 'Resources'} · Updated{' '}
              <time dateTime={data.updated}>{formatDate(data.updated)}</time>
            </p>
            <h1 className="news-article__title">{data.title}</h1>
            {data.status === 'draft' && <DraftNotice />}
            {data.reviewed_by && (
              <p className="resource-reviewed">Reviewed by {data.reviewed_by}</p>
            )}
            <div className="news-article__body">
              {/* react-markdown renders Markdown to elements and never raw HTML. */}
              <ReactMarkdown components={components}>{data.body}</ReactMarkdown>
            </div>
            <p className="help-footnote">
              This guide is general information, not medical, legal or financial advice about
              your situation. Programs change; confirm details with the program itself.
            </p>
            <footer className="news-article__footer">
              <Link to="/resources" className="auth-link">
                ← All resources
              </Link>
            </footer>
          </article>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
