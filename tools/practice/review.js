#!/usr/bin/env node
/**
 * Checks generated cards, in two passes, and builds the sheet a person reads.
 *
 *   node review.js --rules-only     free, no API calls, catches most of it
 *   node review.js                  rules, then the critic pass
 *   node review.js --sheet          rebuild the HTML sheets from out/passed
 *
 * Pass one is rules.js: shape, length, verdict counts, and the content rules
 * that are not negotiable. A card that trips one of those is dropped and is
 * never offered for a fix, because those are not matters of style.
 *
 * Pass two asks Sonnet to check the card against the guide it claims to
 * teach from. It can keep, fix or drop. A fix is re-run through the rules; a
 * second failure is a drop.
 *
 * Neither pass is a substitute for a person reading the cards. What survives
 * is still `status: draft`, and upload.js will not publish a draft. The sheet
 * is what makes reading a thousand of them possible: one concept per page,
 * one card per row, the losing option's note right there beside it.
 */

const fs = require('fs');
const path = require('path');

const rules = require('./rules');
const taxonomy = require('./taxonomy.json');
const { ask, brief, inBatches, withRetries } = require('./client');

const ROOT = path.resolve(__dirname, '..', '..');
const RAW = path.join(__dirname, 'out', 'raw');
const PASSED = path.join(__dirname, 'out', 'passed');
const REJECTED = path.join(__dirname, 'out', 'rejected');
const SHEETS = path.join(__dirname, 'out', 'review');
const CONCURRENCY = 4;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const ONLY = value('--concept', null);
const RULES_ONLY = flag('--rules-only');
const SHEET_ONLY = flag('--sheet');

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'reason'],
  properties: {
    verdict: { type: 'string', enum: ['keep', 'fix', 'drop'] },
    reason: { type: 'string', maxLength: 300 },
    card: {
      type: 'object',
      description: 'the corrected card in full, required when verdict is fix',
      additionalProperties: true,
    },
  },
};

const guideSlugs = rules.guideSlugsFromRepo(ROOT);
const conceptIds = taxonomy.concepts.map((c) => c.id);
const conceptById = new Map(taxonomy.concepts.map((c) => [c.id, c]));

const read = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const write = (dir, file, data) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), `${JSON.stringify(data, null, 2)}\n`);
};

function guideText(slug) {
  if (!slug) return null;
  const file = path.join(ROOT, 'resources', `${slug}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** True when a problem is one of the content rules rather than a slip. */
const isContentRule = (problem) =>
  rules.BANNED.some((rule) => problem.startsWith(`${rule.id} in `));

async function critique(card) {
  const concept = conceptById.get(card.concept);
  const guide = guideText(concept && concept.guide);
  const user = [
    guide
      ? `The guide this card teaches from:\n\n<guide>\n${guide}\n</guide>`
      : 'There is no guide for this concept. Judge the claim against what is well established.',
    '',
    `The card:\n\n${JSON.stringify(card, null, 2)}`,
  ].join('\n');

  const { data } = await ask({
    system: brief('critic.md'),
    user,
    schema: VERDICT_SCHEMA,
    maxTokens: 8000,
  });
  return data;
}

async function reviewConcept(file) {
  const conceptId = file.slice(0, -5);
  const cards = read(RAW, file);
  const kept = [];
  const dropped = [];

  // Pass one, free.
  const survivors = [];
  for (const card of cards) {
    const problems = rules.validateCard(card, { conceptIds, guideSlugs });
    const fatal = problems.filter(isContentRule);
    if (fatal.length) {
      dropped.push({ card, by: 'rules', reason: fatal.join('; ') });
    } else if (problems.length && RULES_ONLY) {
      dropped.push({ card, by: 'rules', reason: problems.join('; ') });
    } else {
      survivors.push({ card, problems });
    }
  }

  if (RULES_ONLY) {
    kept.push(...survivors.map((entry) => entry.card));
  } else {
    const judged = await inBatches(survivors, CONCURRENCY, async ({ card }) => {
      try {
        const result = await withRetries(card.id, () => critique(card));
        return { card, result };
      } catch (err) {
        return { card, result: { verdict: 'drop', reason: `could not check it: ${err.message}` } };
      }
    });

    for (const { card, result } of judged) {
      if (result.verdict === 'drop') {
        dropped.push({ card, by: 'critic', reason: result.reason });
        continue;
      }
      if (result.verdict === 'fix') {
        // Keep the fields the critic has no business changing.
        const fixed = {
          ...card,
          ...(result.card || {}),
          id: card.id,
          concept: card.concept,
          schema: 1,
          status: 'draft',
          reviewed_by: '',
        };
        const problems = rules.validateCard(fixed, { conceptIds, guideSlugs });
        if (problems.length) {
          dropped.push({ card, by: 'critic', reason: `fix still failed: ${problems.join('; ')}` });
        } else {
          kept.push({ ...fixed, fixed_by_critic: result.reason });
        }
        continue;
      }
      kept.push(card);
    }
  }

  write(PASSED, file, kept);
  if (dropped.length) write(REJECTED, file, dropped);
  return { conceptId, kept, dropped };
}

// --- the sheet a person actually reads --------------------------------------

const escape = (value) =>
  String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );

function sheet(conceptId, cards) {
  const concept = conceptById.get(conceptId) || { label: conceptId };
  const rows = cards
    .map(
      (card) => `
    <article class="card${card.sensitive ? ' sensitive' : ''}">
      <header>
        <span class="tag">${escape(card.kind)}</span>
        <span class="tag">level ${escape(card.level)}</span>
        ${card.sensitive ? '<span class="tag heavy">sensitive, read this one properly</span>' : ''}
        ${card.fixed_by_critic ? `<span class="tag fixed">fixed: ${escape(card.fixed_by_critic)}</span>` : ''}
        <code>${escape(card.id)}</code>
      </header>
      <p class="prompt">${escape(card.prompt)}</p>
      <div class="options">
        ${card.options
          .map(
            (option) => `
        <div class="option ${escape(option.verdict)}">
          <b>${escape(option.label)}</b>
          <span class="verdict">${escape(option.verdict)}</span>
          <p>${escape(option.note)}</p>
        </div>`
          )
          .join('')}
      </div>
      <p class="explain">${escape(card.explain)}</p>
      <p class="meta">${card.guide ? `guide: ${escape(card.guide)} · ` : 'no guide · '}<a href="${escape(card.source)}">source</a></p>
    </article>`
    )
    .join('');

  return `<!doctype html>
<meta charset="utf-8">
<title>${escape(concept.label)} · ${escape(conceptId)}</title>
<style>
  body { max-width: 900px; margin: 0 auto; padding: 32px 20px 80px; background: #FFF8E7;
         color: #5D4E37; font: 15px/1.6 Inter, system-ui, sans-serif; }
  h1 { color: #6B4423; font-size: 28px; }
  .lead { color: #7A5C3C; }
  .card { background: #fff; border: 2px solid rgba(93,78,55,.2); border-radius: 14px;
          padding: 18px 20px; margin-bottom: 16px; }
  .card.sensitive { border-color: #D2691E; }
  header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  .tag { background: #F5E6D3; border-radius: 8px; padding: 2px 8px; font-size: 12px; color: #7A5C3C; }
  .tag.heavy { background: #D2691E; color: #FFF8E7; }
  .tag.fixed { background: #F0FFF4; color: #2F855A; }
  code { font-size: 12px; color: #7A5C3C; margin-left: auto; }
  .prompt { font-size: 17px; font-weight: 600; color: #5D4E37; }
  .options { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; margin: 12px 0; }
  .option { border: 2px solid rgba(93,78,55,.2); border-radius: 12px; padding: 10px 12px; font-size: 14px; }
  .option.taught { border-color: #2F855A; }
  .verdict { display: block; font-size: 11px; text-transform: uppercase; color: #7A5C3C; margin: 2px 0 6px; }
  .option p { margin: 0; color: #7A5C3C; }
  .explain { background: #F5E6D3; border-radius: 12px; padding: 12px 14px; }
  .meta { font-size: 12px; color: #7A5C3C; }
  @media (max-width: 640px) { .options { grid-template-columns: 1fr; } }
</style>
<h1>${escape(concept.label)}</h1>
<p class="lead">${escape(conceptId)} · ${cards.length} cards that passed both checks, all still drafts.</p>
<p class="lead">Read for: a claim that is not quite true, an option nobody would pick, a note that
talks down to whoever picked it, and anything that sounds like an app rather than a person. Every
card outlined in orange is sensitive and needs reading individually, not in a batch.</p>
${rows}
`;
}

async function run() {
  if (!fs.existsSync(RAW)) {
    console.error('\nNothing in out/raw. Run `node generate.js` first.\n');
    process.exit(1);
  }

  const source = SHEET_ONLY ? PASSED : RAW;
  const files = fs
    .readdirSync(source)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !ONLY || f === `${ONLY}.json`);

  if (SHEET_ONLY) {
    fs.mkdirSync(SHEETS, { recursive: true });
    for (const file of files) {
      const cards = read(PASSED, file);
      fs.writeFileSync(path.join(SHEETS, `${file.slice(0, -5)}.html`), sheet(file.slice(0, -5), cards));
    }
    console.log(`Rebuilt ${files.length} sheet(s) in tools/practice/out/review/`);
    return;
  }

  let keptTotal = 0;
  let droppedTotal = 0;
  fs.mkdirSync(SHEETS, { recursive: true });

  for (const file of files) {
    const { conceptId, kept, dropped } = await reviewConcept(file);
    fs.writeFileSync(path.join(SHEETS, `${conceptId}.html`), sheet(conceptId, kept));
    keptTotal += kept.length;
    droppedTotal += dropped.length;
    console.log(`${conceptId.padEnd(30)} kept ${String(kept.length).padStart(4)}  dropped ${String(dropped.length).padStart(4)}`);
  }

  console.log(`\n${keptTotal} kept, ${droppedTotal} dropped.`);
  if (droppedTotal) {
    console.log('Reasons are in out/rejected/. Read a few: they are how prompt.md gets better.');
  }
  console.log('\nNow read them. Open tools/practice/out/review/<concept>.html');
  console.log('Then mark what you approve, and publish:  node upload.js --dry-run');
}

run().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
