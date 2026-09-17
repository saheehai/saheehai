#!/usr/bin/env node
/**
 * Static HTML for crawlers, one file per public route. Runs after
 * `react-scripts build`.
 *
 * The app is a single page: without this, every URL a crawler or a link
 * preview fetches gets the same <title> and description. This takes the
 * built index.html and writes a copy per route with that route's title,
 * description, canonical and social tags filled in, the same values
 * src/hooks/usePageMeta.js sets in the browser.
 *
 * Output is one flat file per route under build/__pages/, named after the
 * URL path with "/" spelled "__" (build/__pages/help,
 * build/__pages/news__2026-09-16-back-online), because on disk "news" cannot
 * be both a file and a folder while in S3 the keys "news" and "news/x" can
 * coexist. The deploy turns "__" back into "/" and uploads each file to the
 * bucket root as text/html, so the object key matches the URL exactly and
 * S3 serves it directly with no redirect. The root route stays index.html.
 *
 * No headless browser and no dependency: the app still renders on the
 * client, and this only makes the shell honest about which page it is.
 */

const fs = require('fs');
const path = require('path');

const BUILD = path.resolve(__dirname, '..', 'build');
const ROUTES = path.join(BUILD, 'routes.json');
const SITE_URL = 'https://saheeh.ai';
const ORG = 'Saheeh AI';

const escapeAttr = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function setTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    console.error(`prerender: could not find ${pattern} in build/index.html`);
    process.exit(1);
  }
  return html.replace(pattern, replacement);
}

function render(template, { route, title, description }) {
  const full = title ? `${title} · ${ORG}` : ORG;
  const url = `${SITE_URL}${route === '/' ? '/' : route}`;
  let html = template;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${escapeAttr(full)}</title>`);
  html = setTag(html, /<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeAttr(description || '')}"`);
  html = setTag(html, /<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${escapeAttr(full)}"`);
  html = setTag(html, /<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${escapeAttr(description || '')}"`);
  html = setTag(html, /<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${escapeAttr(url)}"`);
  html = setTag(html, /<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${escapeAttr(url)}"`);
  return html;
}

function main() {
  const indexFile = path.join(BUILD, 'index.html');
  if (!fs.existsSync(indexFile) || !fs.existsSync(ROUTES)) {
    console.error('prerender: run `react-scripts build` first (build/index.html and build/routes.json are missing)');
    process.exit(1);
  }
  const template = fs.readFileSync(indexFile, 'utf8');
  const routes = JSON.parse(fs.readFileSync(ROUTES, 'utf8'));

  const outRoot = path.join(BUILD, '__pages');
  fs.rmSync(outRoot, { recursive: true, force: true });

  let count = 0;
  for (const entry of routes) {
    if (entry.route === '/') continue; // index.html already is the front page
    const name = entry.route.replace(/^\//, '').split('/').join('__');
    fs.mkdirSync(outRoot, { recursive: true });
    fs.writeFileSync(path.join(outRoot, name), render(template, entry));
    count += 1;
  }
  // routes.json was only ever an intermediate; keep it out of the bucket.
  fs.rmSync(ROUTES, { force: true });
  console.log(`prerender: ${count} routes → build/__pages/`);
}

main();
