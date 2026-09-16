#!/usr/bin/env node
/**
 * Turns the Markdown posts in the repo's top-level `news/` folder into the
 * JSON the site fetches. Runs before `npm start` and `npm run build`, so a
 * post is live the moment a file is added and merged.
 *
 * Output (all generated, all gitignored):
 *   public/news/index.json   newest-first list of {slug, title, date, summary}
 *   public/news/<slug>.json  one post: the same fields plus `body` (Markdown)
 *
 * A post is a file named like `2026-09-16-back-online.md` with a small
 * front-matter block; see news/_template.md. Files starting with `_` are
 * skipped. The build fails loudly on a malformed post rather than quietly
 * dropping it.
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '..', '..', 'news');
const OUT = path.resolve(__dirname, '..', 'public', 'news');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUMMARY_MAX = 180;

function fail(file, why) {
  console.error(`\nnews/${file}: ${why}\n`);
  process.exit(1);
}

function parseFrontMatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    fail(file, 'must start with a front-matter block (see news/_template.md)');
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) fail(file, `front-matter line is not "key: value": ${line}`);
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

function main() {
  const files = fs.existsSync(SOURCE)
    ? fs.readdirSync(SOURCE).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    : [];

  const posts = files.map((file) => {
    const slug = file.slice(0, -3);
    if (!SLUG_RE.test(slug)) {
      fail(file, 'file name must be lowercase letters, digits and hyphens, e.g. 2026-09-16-back-online.md');
    }
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(SOURCE, file), 'utf8'), file);
    if (!meta.title) fail(file, 'front matter needs a title');
    if (!DATE_RE.test(meta.date || '')) fail(file, 'front matter needs a date in YYYY-MM-DD form');
    if (Number.isNaN(Date.parse(meta.date))) fail(file, `date is not a real date: ${meta.date}`);
    if (!body) fail(file, 'has no body text');

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

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const post of posts) {
    fs.writeFileSync(path.join(OUT, `${post.slug}.json`), JSON.stringify(post));
  }
  const index = posts.map(({ body, ...listing }) => listing);
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ posts: index }));

  console.log(`news: ${posts.length} post${posts.length === 1 ? '' : 's'} → public/news/`);
}

main();
