#!/usr/bin/env node
/**
 * Turns the Markdown in the repo's top-level `news/` and `resources/`
 * folders into the JSON the site fetches, and writes the sitemap. Runs
 * before `npm start` and `npm run build`, so a post or a guide is live the
 * moment a file is added and merged.
 *
 * Output (all generated, all gitignored):
 *   public/news/index.json        newest-first {slug, title, date, summary}
 *   public/news/<slug>.json       one post: the same fields plus `body`
 *   public/resources/index.json   {slug, title, track, status, updated, reviewed_by, order, summary}
 *   public/resources/<slug>.json  one guide: the same fields plus `body`
 *   public/sitemap.xml            every public route, for search engines
 *
 * A news post is `2026-09-16-back-online.md` with a front-matter block (see
 * news/_template.md). A guide is `hospital-charity-care.md` (see
 * resources/_template.md). Files starting with `_` are skipped. The build
 * fails loudly on a malformed file rather than quietly dropping it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.resolve(__dirname, '..', 'public');
const PAGES = require('../src/content/pages.json');
const TEAM = require('../src/content/team.json');

const SITE_URL = 'https://saheeh.ai';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUMMARY_MAX = 180;
const TRACKS = ['paying-for-care', 'mental-health-basics', 'foundations'];
const STATUSES = ['draft', 'published'];

function fail(folder, file, why) {
  console.error(`\n${folder}/${file}: ${why}\n`);
  process.exit(1);
}

function parseFrontMatter(raw, folder, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    fail(folder, file, `must start with a front-matter block (see ${folder}/_template.md)`);
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) fail(folder, file, `front-matter line is not "key: value": ${line}`);
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

function firstParagraph(body) {
  const para = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('!['));
  if (!para) return '';
  // Strip the most common inline Markdown so the summary reads as prose.
  const text = para
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ');
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : text;
}

function readFolder(folder) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((file) => {
      const slug = file.slice(0, -3);
      if (!SLUG_RE.test(slug)) {
        fail(folder, file, 'file name must be lowercase letters, digits and hyphens');
      }
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const { meta, body } = parseFrontMatter(raw, folder, file);
      if (!meta.title) fail(folder, file, 'front matter needs a title');
      if (!body) fail(folder, file, 'has no body text');
      return { file, slug, meta, body };
    });
}

function checkDate(folder, file, key, value) {
  if (!DATE_RE.test(value || '')) fail(folder, file, `front matter needs ${key} in YYYY-MM-DD form`);
  if (Number.isNaN(Date.parse(value))) fail(folder, file, `${key} is not a real date: ${value}`);
}

function writeFolder(folder, listKey, items) {
  const out = path.join(PUBLIC, folder);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const item of items) {
    fs.writeFileSync(path.join(out, `${item.slug}.json`), JSON.stringify(item));
  }
  const index = items.map(({ body, ...listing }) => listing);
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ [listKey]: index }));
  console.log(`${folder}: ${items.length} → public/${folder}/`);
}

function buildNews() {
  const posts = readFolder('news').map(({ file, slug, meta, body }) => {
    checkDate('news', file, 'date', meta.date);
    return {
      slug,
      title: meta.title,
      date: meta.date,
      summary: meta.summary || firstParagraph(body),
      body,
    };
  });
  // Newest first; same-day posts fall back to file name so the order is stable.
  posts.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
  writeFolder('news', 'posts', posts);
  return posts;
}

function buildResources() {
  const articles = readFolder('resources').map(({ file, slug, meta, body }) => {
    if (!TRACKS.includes(meta.track)) {
      fail('resources', file, `track must be one of: ${TRACKS.join(', ')}`);
    }
    const status = meta.status || 'draft';
    if (!STATUSES.includes(status)) {
      fail('resources', file, `status must be one of: ${STATUSES.join(', ')}`);
    }
    checkDate('resources', file, 'updated', meta.updated);
    if (meta.order !== undefined && !Number.isFinite(Number(meta.order))) {
      fail('resources', file, `order must be a number, got: ${meta.order}`);
    }
    return {
      slug,
      title: meta.title,
      track: meta.track,
      status,
      updated: meta.updated,
      reviewed_by: meta.reviewed_by || '',
      order: meta.order === undefined ? undefined : Number(meta.order),
      summary: meta.summary || firstParagraph(body),
      body,
    };
  });
  // Published before drafts, then by an explicit `order` when the front
  // matter gives one (so a track can open with its foundational guide), then
  // most recently updated first.
  const rank = (a) => (Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER);
  articles.sort(
    (a, b) =>
      (a.status === 'draft') - (b.status === 'draft') ||
      rank(a) - rank(b) ||
      b.updated.localeCompare(a.updated) ||
      a.slug.localeCompare(b.slug)
  );
  writeFolder('resources', 'articles', articles);
  return articles;
}

/** Every public route, with what the prerender step and the sitemap need. */
function routes(posts, articles) {
  const list = Object.entries(PAGES)
    // /team redirects home until someone is named in content/team.json.
    .filter(([route]) => route !== '/team' || TEAM.directors.length > 0)
    .map(([route, { title, description }]) => ({ route, title, description }));
  for (const p of posts) {
    list.push({ route: `/news/${p.slug}`, title: p.title, description: p.summary, lastmod: p.date });
  }
  for (const a of articles) {
    list.push({
      route: `/resources/${a.slug}`,
      title: a.title,
      description: a.summary,
      lastmod: a.updated,
    });
  }
  return list;
}

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

function writeSitemap(list) {
  const urls = list
    .map(({ route, lastmod }) => {
      const loc = `${SITE_URL}${route === '/' ? '/' : route}`;
      return `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), xml);
  console.log(`sitemap: ${list.length} URLs → public/sitemap.xml`);
}

function main() {
  const posts = buildNews();
  const articles = buildResources();
  const list = routes(posts, articles);
  writeSitemap(list);
  // The prerender step (after `react-scripts build`) reads this to know
  // which routes to write static HTML for.
  fs.writeFileSync(path.join(PUBLIC, 'routes.json'), JSON.stringify(list));
}

module.exports = { main };

if (require.main === module) main();
