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
 * News: what is changing and what we are working on.
 *
 * Posts are Markdown files in the repo's `news/` folder. A build step turns
 * them into JSON under /news/, which these pages fetch. Nothing here needs an
 * account, and nothing here talks to the API.
 */

const ERROR = 'Could not load the news right now. Please try again in a moment.';

export function NewsListPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/news'], path: '/news' });
  const { data, error } = useContentJson('news', 'index.json', ERROR);
  const posts = data ? data.posts : [];

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news">
        <header className="news__intro">
          <h1>News</h1>
          <p>What is changing, and what we are working on.</p>
        </header>

        {error && <Alert kind="error">{error}</Alert>}
        {data === null && !error && <Sprout label="Loading the news" />}
        {data === false && <p className="news__status">Nothing here yet.</p>}
        {data && posts.length === 0 && <p className="news__status">Nothing here yet.</p>}

        {posts.length > 0 && (
          <ol className="news-list">
            {posts.map((post) => (
              <li key={post.slug} className="news-list__item">
                <Link to={`/news/${post.slug}`} className="news-card">
                  <time dateTime={post.date} className="news-card__date">
                    {formatDate(post.date)}
                  </time>
                  <h2 className="news-card__title">{post.title}</h2>
                  {post.summary && <p className="news-card__summary">{post.summary}</p>}
                  <span className="news-card__more">Read more</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <NewsletterForm
          source="news"
          heading="Get these by email"
          blurb="A note when something changes. Rarely more than once a month."
          compact
        />
      </main>

      <SiteFooter />
    </div>
  );
}

export function NewsArticlePage({ signedIn, onSignOut }) {
  const { slug } = useParams();
  const safe = isSafeSlug(slug);
  const { data, error } = useContentJson('news', safe ? `${slug}.json` : 'missing.json', ERROR);

  usePageMeta({
    title: data ? data.title : 'News',
    description: data ? data.summary : pages['/news'].description,
    path: `/news/${slug}`,
  });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news">
        {error && <Alert kind="error">{error}</Alert>}
        {data === null && !error && <Sprout label="Loading the post" />}

        {data === false && (
          <div className="news__status">
            <p>That post does not exist.</p>
            <Link to="/news" className="auth-link">
              Back to all news
            </Link>
          </div>
        )}

        {data && (
          <article className="news-article">
            <time dateTime={data.date} className="news-card__date">
              {formatDate(data.date)}
            </time>
            <h1 className="news-article__title">{data.title}</h1>
            <div className="news-article__body">
              {/* react-markdown renders Markdown to elements and never raw HTML. */}
              <ReactMarkdown>{data.body}</ReactMarkdown>
            </div>
            <footer className="news-article__footer">
              <Link to="/news" className="auth-link">
                ← All news
              </Link>
            </footer>
          </article>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
