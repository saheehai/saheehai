#!/usr/bin/env node
/**
 * Publishes a deck of Practice cards.
 *
 *   node tools/practice/upload.js --local        for `npm start` and CI
 *   node tools/practice/upload.js --dry-run      print the keys, write nothing
 *   node tools/practice/upload.js                upload to S3, behind a prompt
 *
 * Nothing is published that does not pass tools/practice/rules.js, and
 * nothing that is still `status: draft` goes to S3 unless you say
 * --include-drafts out loud. `--local` always includes drafts, because the
 * point of local is to look at them.
 *
 * Production cards live in the site bucket under `practice-cards/` and are
 * served by the same CloudFront distribution as the guides. They are NOT
 * part of a frontend deploy: this script is the only thing that writes them,
 * so cards can change without shipping code. Both deploy paths exclude the
 * prefix so a frontend deploy cannot delete what this uploaded. If you ever
 * see that exclude go missing, put it back before deploying.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const readline = require('readline');

const rules = require('./rules');
const taxonomy = require('./taxonomy.json');

const ROOT = path.resolve(__dirname, '..', '..');
const PREFIX = 'practice-cards';
const BUCKET = process.env.S3_BUCKET || 'saheeh.ai';
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const LOCAL = has('--local');
const DRY = has('--dry-run');
const INCLUDE_DRAFTS = has('--include-drafts') || LOCAL;
const FROM = path.resolve(ROOT, valueOf('--from', 'tools/practice/deck'));
const LOCAL_DIR = path.join(ROOT, 'frontend', 'public', PREFIX);

const die = (msg) => {
  console.error(`\n${msg}\n`);
  process.exit(1);
};

/** Reads every *.json in the deck folder. One file is one pack. */
function readPacks(dir) {
  if (!fs.existsSync(dir)) die(`No deck at ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  if (!files.length) die(`No card files in ${dir}`);
  return files.map((file) => {
    const id = file.slice(0, -5);
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const cards = Array.isArray(parsed) ? parsed : parsed.cards;
    if (!Array.isArray(cards)) die(`${file} must be an array of cards`);
    return { id, file, cards };
  });
}

const packs = readPacks(FROM);
const all = packs.flatMap((p) => p.cards);

// Validate the whole deck before anything is filtered, so a broken draft is
// still a loud failure rather than something that quietly never ships.
const { problems, warnings, stats } = rules.validateDeck(all, {
  conceptIds: taxonomy.concepts.map((c) => c.id),
  guideSlugs: rules.guideSlugsFromRepo(ROOT),
});
warnings.forEach((w) => console.log(`  warning  ${w}`));
if (problems.length) {
  problems.forEach((p) => console.error(`  PROBLEM  ${p}`));
  die(`${problems.length} problem(s). Nothing published.`);
}

// Filter to what is actually going out.
const shipped = packs
  .map((p) => ({ ...p, cards: p.cards.filter((c) => INCLUDE_DRAFTS || c.status === 'published') }))
  .filter((p) => p.cards.length);
const shippedCards = shipped.flatMap((p) => p.cards);

if (!shippedCards.length) {
  die(
    'Every card is still a draft, so there is nothing to publish.\n' +
      'Read them, set status to "published" and fill in reviewed_by, or pass --include-drafts.'
  );
}

// Only concepts that actually have a card in this deck. "14 of 26 concepts"
// has to count something real, so the manifest carries what shipped rather
// than everything the taxonomy hopes for one day.
const present = new Set(shippedCards.map((c) => c.concept));
const concepts = taxonomy.concepts
  .filter((c) => present.has(c.id))
  .map((c) => ({ id: c.id, label: c.label, guide: c.guide || null }));

// Content-addressed, so republishing the same cards keeps the same version
// and every cached copy stays valid.
const digest = crypto
  .createHash('sha256')
  .update(JSON.stringify(shipped.map((p) => p.cards)))
  .digest('hex')
  .slice(0, 8);
const version = `${taxonomy.deck_version}.${digest}`;

const manifest = {
  version,
  schema: 1,
  generated: new Date().toISOString().slice(0, 10),
  total_cards: shippedCards.length,
  concepts,
  packs: shipped.map((p) => ({ id: p.id, file: `packs/${p.id}.json`, cards: p.cards.length })),
};

const files = [
  ...shipped.map((p) => ({ key: `packs/${p.id}.json`, body: JSON.stringify(p.cards) })),
  // Manifest last, always: it is what points at the packs, so it must never
  // name a file that is not up yet.
  { key: 'manifest.json', body: JSON.stringify(manifest) },
];

const draftCount = shippedCards.filter((c) => c.status === 'draft').length;
console.log(
  `\n${shippedCards.length} cards in ${shipped.length} pack(s), ${concepts.length} concepts, version ${version}` +
    (draftCount ? `\n${draftCount} of them are drafts.` : '')
);
console.log(`kinds: ${JSON.stringify(stats.byKind)}`);

if (DRY) {
  console.log(`\nWould write to ${LOCAL ? LOCAL_DIR : `s3://${BUCKET}/${PREFIX}/`}:`);
  files.forEach((f) => console.log(`  ${PREFIX}/${f.key}  (${f.body.length} bytes)`));
  if (!LOCAL) console.log(`Then invalidate /${PREFIX}/*`);
  process.exit(0);
}

if (LOCAL) {
  fs.rmSync(LOCAL_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(LOCAL_DIR, 'packs'), { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(LOCAL_DIR, f.key), f.body);
  console.log(`\nWrote ${files.length} files to frontend/public/${PREFIX}/`);
  console.log('These are gitignored, and a frontend deploy does not upload them.');
  process.exit(0);
}

// --- S3 from here down -----------------------------------------------------

if (draftCount) {
  die(
    `${draftCount} draft card(s) would go live.\n` +
      'Set status to "published" and fill in reviewed_by once you have read them.'
  );
}

try {
  execFileSync('aws', ['--version'], { stdio: 'ignore' });
} catch {
  die('The AWS CLI is not installed. Visit https://aws.amazon.com/cli/');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
  `\nUpload ${shippedCards.length} cards to s3://${BUCKET}/${PREFIX}/ ? This is live to everyone. [y/N] `,
  (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') die('Nothing uploaded.');

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'practice-'));
    fs.mkdirSync(path.join(tmp, 'packs'));
    for (const f of files) fs.writeFileSync(path.join(tmp, f.key), f.body);

    for (const f of files) {
      execFileSync(
        'aws',
        ['s3', 'cp', path.join(tmp, f.key), `s3://${BUCKET}/${PREFIX}/${f.key}`,
          '--content-type', 'application/json',
          // Same short cache as the guides: a fixed card should reach people
          // in minutes, not on the next CDN expiry.
          '--cache-control', 'public,max-age=300,must-revalidate'],
        { stdio: 'inherit' }
      );
    }

    if (DISTRIBUTION_ID) {
      execFileSync(
        'aws',
        ['cloudfront', 'create-invalidation', '--distribution-id', DISTRIBUTION_ID,
          '--paths', `/${PREFIX}/*`],
        { stdio: 'inherit' }
      );
    } else {
      console.log('\nCLOUDFRONT_DISTRIBUTION_ID is not set, so nothing was invalidated.');
      console.log('Cards will appear as the five minute cache expires.');
    }

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\nPublished version ${version}.`);
  }
);
