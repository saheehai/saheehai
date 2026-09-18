#!/usr/bin/env node
/**
 * Writes Practice cards with Sonnet.
 *
 *   node generate.js --concept cbt-basics --count 20   one concept, small
 *   node generate.js                                   the whole taxonomy
 *   node generate.js --dry-run                         print the plan only
 *
 * Output goes to out/raw/<concept>.json and is appended to, so a run that
 * dies partway through can be started again and will pick up where it left
 * off. Nothing here publishes anything: `review.js` checks what this wrote
 * and `upload.js` puts the approved cards on the CDN.
 *
 * Each batch is told the prompts that already exist for its concept, which
 * is what stops the fortieth card on distress tolerance being the first one
 * again in different words.
 */

const fs = require('fs');
const path = require('path');

const rules = require('./rules');
const taxonomy = require('./taxonomy.json');
const { MODEL, ask, brief, withRetries } = require('./client');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out', 'raw');
const BATCH = 10;
const TODAY = new Date().toISOString().slice(0, 10);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const ONLY = value('--concept', null);
const COUNT = value('--count', null);
const DRY = flag('--dry-run');

const CARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'level', 'sensitive', 'prompt', 'options', 'explain', 'source'],
        properties: {
          id: { type: 'string', description: 'short slug describing this card, no numbering' },
          kind: { type: 'string', enum: rules.KINDS },
          level: { type: 'integer', enum: rules.LEVELS },
          sensitive: { type: 'boolean' },
          prompt: { type: 'string', maxLength: rules.CAPS.prompt },
          explain: { type: 'string', maxLength: rules.CAPS.explain },
          source: { type: 'string', description: 'a URL supporting the claim, .gov or the programme itself where possible' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['side', 'label', 'note', 'verdict'],
              properties: {
                side: { type: 'string', enum: ['left', 'right'] },
                label: { type: 'string', maxLength: rules.CAPS.label },
                note: { type: 'string', maxLength: rules.CAPS.note },
                verdict: { type: 'string', enum: rules.VERDICTS },
              },
            },
          },
        },
      },
    },
  },
};

/** The guide text a concept teaches from, so the cards stay tied to the site. */
function guideText(slug) {
  if (!slug) return null;
  const file = path.join(ROOT, 'resources', `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'card';

function readExisting(conceptId) {
  const file = path.join(OUT, `${conceptId}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeConcept(conceptId, cards) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${conceptId}.json`), `${JSON.stringify(cards, null, 2)}\n`);
}

/** What mix of kinds this concept still needs, as a sentence for the model. */
function wanted(concept, existing) {
  const mix = concept.kinds || taxonomy.mix;
  const target = concept.target;
  const have = {};
  for (const card of existing) have[card.kind] = (have[card.kind] || 0) + 1;

  return Object.entries(mix)
    .map(([kind, share]) => {
      const owed = Math.max(0, Math.round(target * share) - (have[kind] || 0));
      return { kind, owed };
    })
    .filter((entry) => entry.owed > 0);
}

async function generateBatch(concept, kind, count, existing) {
  const guide = guideText(concept.guide);
  const levels = taxonomy.levels;

  const user = [
    `Concept: ${concept.label} (${concept.id})`,
    `Scope: ${concept.brief}`,
    '',
    `Write ${count} cards of kind "${kind}".`,
    `Spread them across levels 1, 2 and 3, roughly ${levels['1'] * 100}% / ${levels['2'] * 100}% / ${levels['3'] * 100}%. ` +
      'Level 1 is someone who has never heard the term. Level 3 is someone who has been in therapy and wants the part that is easy to get wrong.',
    concept.sensitive_ratio
      ? `About ${Math.round(concept.sensitive_ratio * 100)}% of these should be marked sensitive: true.`
      : 'None of these should be marked sensitive: true unless the subject genuinely requires it.',
    '',
    guide
      ? `Teach from this guide. Do not contradict it, and do not go far past what it covers.\n\n<guide>\n${guide}\n</guide>`
      : 'There is no guide for this concept yet, so stay on ground that is well established and easy to source.',
    '',
    existing.length
      ? `These questions already exist for this concept. Write about something else.\n\n${existing
          .map((card) => `- ${card.prompt}`)
          .join('\n')}`
      : 'This is the first batch for this concept.',
  ].join('\n');

  const { data } = await ask({ system: brief('prompt.md'), user, schema: CARD_SCHEMA });
  return data.cards || [];
}

async function run() {
  const concepts = taxonomy.concepts.filter((c) => !ONLY || c.id === ONLY);
  if (!concepts.length) {
    console.error(`No concept called ${ONLY}. See taxonomy.json.`);
    process.exit(1);
  }

  if (DRY) {
    let total = 0;
    for (const concept of concepts) {
      const existing = readExisting(concept.id);
      const owed = wanted(concept, existing);
      const owedTotal = owed.reduce((sum, entry) => sum + entry.owed, 0);
      total += owedTotal;
      console.log(
        `${concept.id.padEnd(30)} have ${String(existing.length).padStart(4)}  ` +
          `want ${String(owedTotal).padStart(4)}  ${owed.map((e) => `${e.kind}:${e.owed}`).join(' ')}`
      );
    }
    console.log(`\n${total} cards to write with ${MODEL}. Nothing was generated.`);
    return;
  }

  for (const concept of concepts) {
    let existing = readExisting(concept.id);
    let owed = wanted(concept, existing);
    if (COUNT) {
      // --count is a ceiling for this run, spread over whatever is still owed.
      let left = Number(COUNT);
      owed = owed
        .map((entry) => {
          const take = Math.min(entry.owed, left);
          left -= take;
          return { ...entry, owed: take };
        })
        .filter((entry) => entry.owed > 0);
    }
    if (!owed.length) {
      console.log(`${concept.id}: already full`);
      continue;
    }

    console.log(`\n${concept.id}: ${owed.map((e) => `${e.kind} ${e.owed}`).join(', ')}`);

    for (const entry of owed) {
      let remaining = entry.owed;
      while (remaining > 0) {
        const size = Math.min(BATCH, remaining);
        const fresh = await withRetries(`${concept.id}/${entry.kind}`, () =>
          generateBatch(concept, entry.kind, size, existing)
        );

        const seen = new Set(existing.map((card) => card.id));
        const prints = new Set(existing.map((card) => rules.fingerprint(card.prompt)));

        for (const card of fresh) {
          const print = rules.fingerprint(card.prompt);
          if (prints.has(print)) continue; // the model repeated itself
          prints.add(print);

          let id = `${concept.id}-${slugify(card.id)}`;
          let n = 2;
          while (seen.has(id)) id = `${concept.id}-${slugify(card.id)}-${n++}`;
          seen.add(id);

          existing.push({
            ...card,
            id,
            schema: 1,
            concept: concept.id,
            eyebrow: concept.label,
            ...(concept.guide
              ? { guide: concept.guide, guide_label: `the ${concept.label} guide` }
              : {}),
            generated: TODAY,
            status: 'draft',
            reviewed_by: '',
          });
        }

        // Written after every batch, so an interrupted run loses one batch
        // rather than an afternoon.
        writeConcept(concept.id, existing);
        remaining -= size;
        console.log(`  ${existing.length} cards on file`);
      }
    }
  }

  console.log('\nWritten to tools/practice/out/raw/. Nothing is checked yet:');
  console.log('  node review.js');
}

run().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
