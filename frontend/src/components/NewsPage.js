import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import SiteNav from './SiteNav';
import Alert from './Alert';

/**
 * News: what is changing and what we are working on.
 *
 * Posts are Markdown files in the repo's `news/` folder. A build step turns
 * them into JSON under /news/, which these pages fetch. Nothing here needs an
 * account, and nothing here talks to the API.
 */

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/** Fetches generated news JSON; `null` while loading, `false` when missing. */
function useNewsJson(file) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/news/${file}`, { headers: { Accept: 'application/json' } })
      .then((res) => {
        // A missing file comes back as the SPA shell with a 200, so check the
        // type rather than the status.
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.includes('json')) throw new Error('not found');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.message === 'not found') setData(false);
        else setError('Could not load the news right now. Please try again in a moment.');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return { data, error };
}

export function NewsListPage({ signedIn, onSignOut }) {
  const { data, error } = useNewsJson('index.json');
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
        {data === null && !error && <p className="news__status">Loading…</p>}
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
      </main>
    </div>
  );
}

export function NewsArticlePage({ signedIn, onSignOut }) {
  const { slug } = useParams();
  // Never let a URL reach the fetch as a path of its own making.
  const safe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '');
  const { data, error } = useNewsJson(safe ? `${slug}.json` : 'missing.json');

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news">
        {error && <Alert kind="error">{error}</Alert>}
        {data === null && !error && <p className="news__status">Loading…</p>}

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
    </div>
  );
}
