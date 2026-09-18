#!/usr/bin/env node
/**
 * Signs off cards you have read.
 *
 *   node approve.js --concept cbt-basics --by "Rehan Ali"
 *   node approve.js --all --by "Rehan Ali"            everything not sensitive
 *   node approve.js --card cbt-basics-thought-record --by "Rehan Ali"
 *
 * Approving copies cards from out/passed into deck/, sets status to
 * published, and writes your name into reviewed_by. Only then will upload.js
 * put them on the CDN.
 *
 * Sensitive cards are never approved in a batch. --concept and --all skip
 * them and say so; each one has to be named with --card, which is a small
 * piece of friction in exactly the right place. Those are the cards about
 * being there for someone in a bad moment, and they are the ones where a
 * confident wrong sentence does the most damage.
 */

const fs = require('fs');
const path = require('path');

const rules = require('./rules');
const taxonomy = require('./taxonomy.json');

const PASSED = path.join(__dirname, 'out', 'passed');
const DECK = path.join(__dirname, 'deck');
const TODAY = new Date().toISOString().slice(0, 10);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const BY = value('--by', '');
const CONCEPT = value('--concept', null);
const CARD = value('--card', null);
const ALL = flag('--all');

if (!BY) {
  console.error('\nWho read them? Pass --by "Your Name".\n');
  process.exit(1);
}
if (!CONCEPT && !CARD && !ALL) {
  console.error('\nPass --concept <id>, --card <id>, or --all.\n');
  process.exit(1);
}
// Cards normally arrive from a generate and review run, in out/passed. The
// starter deck did not: those ten were written by hand straight into deck/
// and sat there as drafts with no way to sign them off, because this script
// only ever looked in out/passed. Drafts already in deck/ are approved from
// where they are, under exactly the same rules.
const SOURCE = fs.existsSync(PASSED) ? PASSED : DECK;
if (!fs.existsSync(SOURCE)) {
  console.error('\nNothing in out/passed and nothing in deck/. Run `node review.js` first.\n');
  process.exit(1);
}

// A generate run writes one file per concept, so filtering by filename was
// the same thing as filtering by concept. The hand written deck is one file
// holding several, so the concept is read off each card instead.
const files = fs.readdirSync(SOURCE).filter((f) => f.endsWith('.json'));

let approved = 0;
let heldBack = 0;

for (const file of files) {
  const cards = JSON.parse(fs.readFileSync(path.join(SOURCE, file), 'utf8'));
  const existing = fs.existsSync(path.join(DECK, file))
    ? JSON.parse(fs.readFileSync(path.join(DECK, file), 'utf8'))
    : [];
  const byId = new Map(existing.map((card) => [card.id, card]));

  for (const card of cards) {
    if (CARD && card.id !== CARD) continue;
    if (CONCEPT && card.concept !== CONCEPT) continue;
    if (card.status === 'published' && card.reviewed_by) continue;
    if (!CARD && card.sensitive) {
      heldBack += 1;
      continue;
    }
    byId.set(card.id, {
      ...card,
      status: 'published',
      reviewed_by: BY,
      reviewed: TODAY,
    });
    approved += 1;
  }

  const merged = [...byId.values()];
  if (!merged.length) continue;

  const problems = rules.validateDeck(merged, {
    conceptIds: taxonomy.concepts.map((c) => c.id),
    guideSlugs: rules.guideSlugsFromRepo(),
  }).problems;
  if (problems.length) {
    console.error(`\n${file}: refusing to approve, the deck does not pass:`);
    problems.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }

  fs.mkdirSync(DECK, { recursive: true });
  fs.writeFileSync(path.join(DECK, file), `${JSON.stringify(merged, null, 2)}\n`);
}

console.log(`\nApproved ${approved} card(s) as read by ${BY}.`);
if (heldBack) {
  console.log(
    `${heldBack} sensitive card(s) were left alone. Read each one and approve it by name:\n` +
      '  node approve.js --card <id> --by "Your Name"'
  );
}
console.log('\nThey are in tools/practice/deck/ now. To publish:\n  node upload.js --dry-run');
