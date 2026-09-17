import { useEffect } from 'react';
import { ORG_NAME, SITE_URL } from '../content/site';

/**
 * Per-page title, description and social tags.
 *
 * The site is a single page as far as the browser is concerned, so without
 * this every route shares one <title> and one description. The tags
 * themselves are declared once in public/index.html; this only fills them
 * in. The prerender step (scripts/prerender.js) writes the same values into
 * static HTML for crawlers that do not run JavaScript.
 */

const set = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

export function usePageMeta({ title, description, path }) {
  useEffect(() => {
    const full = title ? `${title} · ${ORG_NAME}` : ORG_NAME;
    const url = `${SITE_URL}${path || window.location.pathname}`;

    document.title = full;
    if (description) {
      set('meta[name="description"]', 'content', description);
      set('meta[property="og:description"]', 'content', description);
    }
    set('meta[property="og:title"]', 'content', full);
    set('meta[property="og:url"]', 'content', url);
    set('link[rel="canonical"]', 'href', url);
  }, [title, description, path]);
}

export default usePageMeta;
