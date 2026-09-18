/**
 * What a Practice card is allowed to be.
 *
 * This file is the only place the card contract lives. The generator writes
 * against it, the critic pass is told about it, `upload.js` refuses to
 * publish a deck that breaks it, and `node rules.js <file>` checks a deck by
 * hand. Nothing reaches S3 without passing `validateDeck`.
 *
 * The browser does its own much smaller check (see
 * frontend/src/utils/deck.js): required fields and verdict counts, so a bad
 * card is dropped rather than rendered half-built. It deliberately does not
 * repeat the length caps below. Those are an authoring concern, enforced
 * here where a failure can be fixed, rather than in front of someone who
 * only wanted to learn what CBT is.
 */

const fs = require('fs');
const path = require('path');

// A card is meant to be read at a glance and answered from the two options.
// The prompt is one short question and nothing else: the scenario, if there
// is one, lives inside that question or it does not belong on the card. The
// cap was 420 until 2026-09-18, which let a question run six lines, push the
// options off a phone screen and need its own scrollbar. The explanation is
// where the length is allowed to be, because it arrives in a sheet of its
// own after the answer.
const CAPS = {
  prompt: 130,
  label: 90,
  note: 220,
  explain: 600,
  eyebrow: 24,
  guide_label: 40,
};

// Short is the point now. This only catches a stub: a prompt this short is
// not a question, it is a heading somebody forgot to finish.
const SHORT_PROMPT = 20;

// One sentence. A prompt is allowed exactly one terminator and it has to be
// the last character, which is the cheapest way to say "do not stack a setup
// sentence in front of the question".
const ONE_SENTENCE = /^[^.?!]+[.?!]?$/;

const KINDS = ['concept', 'situation', 'both', 'support'];
// Same convention as the guides in resources/: a card is `draft` until a
// person has actually read it, and `upload.js` will not publish a draft
// without being told to in so many words.
const STATUSES = ['draft', 'published'];
const VERDICTS = ['taught', 'other', 'either'];
const SIDES = ['left', 'right'];
const LEVELS = [1, 2, 3];

// How many options carry `verdict: "taught"`, by kind. `both` and `support`
// cards have no taught option at all, which is what makes "there is no single
// right answer" an ordinary card rather than a special case in the renderer.
const TAUGHT_COUNT = { concept: 1, situation: 1, both: 0, support: 0 };

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Content rules, as patterns. Every one of these is here because a card that
 * matched it would be a card this site should not show anybody. The critic
 * pass is told the same rules in prose; this is the half that cannot be
 * talked out of it.
 */
const BANNED = [
  {
    id: 'asks-about-the-player',
    why: 'A card must not ask the player about themselves. That makes it a screening instrument.',
    re: /\b(do|did|have|are|were|when did|how often do) you\b(?![^.?]*\b(call|text|think of it|say)\b)/i,
    fields: ['prompt'],
  },
  {
    id: 'second-person-distress',
    why: 'Do not attach a distressing state to the reader. Use "someone".',
    re: /\byou(?:'re| are|r)\s+(spiralling|spiraling|depressed|anxious|broken|failing|worthless|hopeless|manic|traumati[sz]ed)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'diagnosis',
    why: 'Nothing mistakable for a diagnosis.',
    // Needs a condition after it. A bare "you have" is ordinary English
    // ("whether you have to obey it") and matching it flagged good cards.
    re: /\b(?:you (?:probably |likely |may |might )?have|this means you have|sounds like you have|you are suffering from)\s+(?:mild |severe |clinical |a |an )*(?:depression|anxiety|adhd|add|ptsd|ocd|bipolar|bpd|psychosis|an? (?:disorder|illness|condition|diagnosis))\b|\bdiagnos(?:e|es|ing) you\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'screening-item',
    why: 'No PHQ-9 or GAD-7 item wording, and no scored checklists.',
    re: /\b(phq-?9|gad-?7|little interest or pleasure|nearly every day|not at all, several days)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'medication',
    why: 'No medication names, doses, or whether to take something.',
    re: /\b(\d+\s?mg|milligrams?|ssri|snri|benzo\w*|sertraline|fluoxetine|citalopram|escitalopram|venlafaxine|bupropion|mirtazapine|quetiapine|lithium|lamotrigine|olanzapine|alprazolam|lorazepam|diazepam|clonazepam|adderall|prozac|zoloft|lexapro|xanax|valium|klonopin|ativan)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'means-or-method',
    why: 'Never a method, an amount or a means in relation to self-harm. No exceptions.',
    re: /\b(overdose|how many pills|cut(ting)? (deep|deeper)|hang(ing)? (them|him|her)self|jump(ing)? (off|from)|firearm|a lethal|bleed out)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'clinical-roleplay',
    why: 'The player is never cast as a clinician, and no card asks them to assess or treat anyone.',
    re: /\b(as (the|their) therapist|you are the (therapist|clinician|counselor|counsellor|psychiatrist)|your (client|patient)|which diagnosis|what would you prescribe|treatment plan for)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'scores-coping',
    why: 'Cards judge whether something is the named skill, never whether a person is healthy.',
    re: /\bwhich (one )?is the (health|unhealth|right|correct|wrong|good|bad)\w*\b/i,
    fields: ['prompt'],
  },
  {
    id: 'replaces-care',
    why: 'Nothing may imply the cards stand in for care.',
    re: /\b(instead of (therapy|a therapist|treatment)|no need (for|to see) a (therapist|doctor)|all you need is)\b/i,
    fields: ['prompt', 'label', 'note', 'explain'],
  },
  {
    id: 'em-dash',
    why: 'House voice: no em dashes.',
    re: /[—–]|--/,
    fields: ['prompt', 'label', 'note', 'explain', 'eyebrow'],
  },
  {
    id: 'straw-man',
    why: 'Both options must be plausible. An option that announces itself as absurd is a straw man.',
    re: /\b(obviously wrong|do nothing at all|just get over it|snap out of it|ignore (it|them) completely)\b/i,
    fields: ['label'],
  },
  {
    id: 'emoji',
    why: 'Emojis only in light moments, and there are none on a card.',
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    fields: ['prompt', 'label', 'note', 'explain', 'eyebrow'],
  },
];

const text = (card) => ({
  prompt: [card.prompt],
  eyebrow: [card.eyebrow],
  explain: [card.explain],
  label: (card.options || []).map((o) => o && o.label),
  note: (card.options || []).map((o) => o && o.note),
});

/** Every problem with one card, as readable lines. Empty means it passes. */
function validateCard(card, { conceptIds = null, guideSlugs = null } = {}) {
  const problems = [];
  const bad = (why) => problems.push(why);

  if (!card || typeof card !== 'object') return ['not an object'];
  if (card.schema !== 1) bad(`schema must be 1, got ${JSON.stringify(card.schema)}`);
  if (!ID_RE.test(card.id || '')) bad(`id must be lowercase words joined by hyphens, got ${JSON.stringify(card.id)}`);
  if (!KINDS.includes(card.kind)) bad(`kind must be one of ${KINDS.join(', ')}, got ${JSON.stringify(card.kind)}`);
  if (!ID_RE.test(card.concept || '')) bad(`concept must be a slug, got ${JSON.stringify(card.concept)}`);
  if (conceptIds && card.concept && !conceptIds.includes(card.concept)) {
    bad(`concept ${card.concept} is not in taxonomy.json`);
  }
  if (!LEVELS.includes(card.level)) bad(`level must be 1, 2 or 3, got ${JSON.stringify(card.level)}`);
  if (typeof card.sensitive !== 'boolean') bad('sensitive must be true or false, written out');
  if (!DATE_RE.test(card.generated || '')) bad('generated must be a YYYY-MM-DD date');
  if (!STATUSES.includes(card.status)) bad(`status must be one of ${STATUSES.join(', ')}`);
  if (card.status === 'published' && !card.reviewed_by) {
    bad('a published card must name the person who read it in reviewed_by');
  }

  // Guide is optional: a concept with no guide yet renders without the link.
  // But a slug that is present must be a guide that exists, or the card sends
  // someone to a 404 from inside a feature about trust.
  if (card.guide) {
    if (!ID_RE.test(card.guide)) bad(`guide must be a slug, got ${JSON.stringify(card.guide)}`);
    if (guideSlugs && !guideSlugs.includes(card.guide)) bad(`guide ${card.guide} is not a file in resources/`);
    if (!card.guide_label) bad('a card with a guide needs a guide_label, e.g. "the CBT guide"');
  } else if (card.guide_label) {
    bad('guide_label without a guide');
  }
  if (card.sensitive && !card.guide) bad('a sensitive card must link a guide');

  for (const [field, values] of Object.entries(text(card))) {
    for (const value of values) {
      if (field === 'prompt' || field === 'explain' || field === 'eyebrow') {
        if (!value || !String(value).trim()) bad(`${field} is empty`);
      }
      if (value && String(value).length > CAPS[field]) {
        bad(`${field} is ${String(value).length} chars, cap is ${CAPS[field]}`);
      }
    }
  }

  const options = Array.isArray(card.options) ? card.options : [];
  if (options.length !== 2) {
    bad(`a card has exactly two options, got ${options.length}`);
  } else {
    options.forEach((option, i) => {
      const where = `options[${i}]`;
      if (!option || typeof option !== 'object') return bad(`${where} is not an object`);
      if (option.side !== SIDES[i]) bad(`${where}.side must be "${SIDES[i]}" (options are in display order)`);
      if (!option.label || !option.label.trim()) bad(`${where}.label is empty`);
      // The note on the option nobody picked is the whole reason this teaches
      // instead of tests, so it is required on both, always.
      if (!option.note || !option.note.trim()) bad(`${where}.note is empty, and both options need one`);
      if (!VERDICTS.includes(option.verdict)) bad(`${where}.verdict must be one of ${VERDICTS.join(', ')}`);
    });

    const taught = options.filter((o) => o && o.verdict === 'taught').length;
    const expected = TAUGHT_COUNT[card.kind];
    if (expected !== undefined && taught !== expected) {
      bad(`a ${card.kind} card has exactly ${expected} taught option(s), got ${taught}`);
    }
    if (expected === 0 && options.some((o) => o && o.verdict !== 'either')) {
      bad(`every option on a ${card.kind} card is "either"`);
    }
    if (expected === 1 && !options.some((o) => o && o.verdict === 'other')) {
      bad(`a ${card.kind} card needs one taught option and one other`);
    }
  }

  for (const rule of BANNED) {
    const fields = text(card);
    for (const field of rule.fields) {
      for (const value of fields[field] || []) {
        if (value && rule.re.test(String(value))) {
          bad(`${rule.id} in ${field}: ${rule.why}`);
        }
      }
    }
  }

  return problems;
}

/** Normalises a prompt enough to catch the same card written twice. */
const fingerprint = (prompt) =>
  String(prompt || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(a|an|the|is|are|of|to|and|or|what|which|that|this|you|your)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

/**
 * Checks a whole deck: every card, plus the things only visible across cards.
 * Returns { problems, warnings, stats }.
 */
function validateDeck(cards, options = {}) {
  const problems = [];
  const warnings = [];
  const seenIds = new Map();
  const seenPrompts = new Map();

  cards.forEach((card, i) => {
    const where = card && card.id ? card.id : `card ${i}`;
    for (const problem of validateCard(card, options)) {
      problems.push(`${where}: ${problem}`);
    }
    if (!card) return;
    if (seenIds.has(card.id)) problems.push(`${card.id}: id used twice`);
    else seenIds.set(card.id, i);

    const print = fingerprint(card.prompt);
    if (print && seenPrompts.has(print)) {
      problems.push(`${where}: same question as ${seenPrompts.get(print)}, in different words`);
    } else if (print) {
      seenPrompts.set(print, where);
    }
    if (card.prompt && card.prompt.length < SHORT_PROMPT) {
      warnings.push(`${where}: prompt is only ${card.prompt.length} chars, which is not a question`);
    }
    if (card.prompt && !ONE_SENTENCE.test(card.prompt.trim())) {
      problems.push(
        `${where}: the prompt is more than one sentence. The card asks one short question; ` +
          'anything that needs setting up belongs inside that question or in the explanation'
      );
    }
  });

  const byKind = {};
  const byConcept = {};
  for (const card of cards) {
    if (!card) continue;
    byKind[card.kind] = (byKind[card.kind] || 0) + 1;
    byConcept[card.concept] = (byConcept[card.concept] || 0) + 1;
  }
  const drafts = cards.filter((c) => c && c.status === 'draft').length;
  if (drafts) warnings.push(`${drafts} of ${cards.length} cards are still drafts and nobody has signed them off`);

  const nuanced = ((byKind.both || 0) + (byKind.support || 0)) / (cards.length || 1);
  if (cards.length >= 20 && nuanced < 0.2) {
    warnings.push(
      `only ${Math.round(nuanced * 100)}% of the deck has no single right answer. Aim for about 30%, ` +
        'or the deck teaches that therapy has right answers.'
    );
  }

  return { problems, warnings, stats: { total: cards.length, drafts, byKind, byConcept } };
}

/** The guide slugs that actually exist, read from resources/. */
function guideSlugsFromRepo(root = path.resolve(__dirname, '..', '..')) {
  const dir = path.join(root, 'resources');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => f.slice(0, -3));
}

module.exports = {
  CAPS,
  KINDS,
  VERDICTS,
  LEVELS,
  BANNED,
  validateCard,
  validateDeck,
  guideSlugsFromRepo,
  fingerprint,
};

// `node tools/practice/rules.js <deck.json>...` checks a deck by hand.
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node tools/practice/rules.js <deck.json>...');
    process.exit(2);
  }
  const taxonomy = require('./taxonomy.json');
  const cards = files.flatMap((f) => {
    const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.cards || [];
  });
  const { problems, warnings, stats } = validateDeck(cards, {
    conceptIds: taxonomy.concepts.map((c) => c.id),
    guideSlugs: guideSlugsFromRepo(),
  });
  console.log(`${stats.total} cards: ${JSON.stringify(stats.byKind)}`);
  warnings.forEach((w) => console.log(`  warning  ${w}`));
  problems.forEach((p) => console.error(`  PROBLEM  ${p}`));
  console.log(problems.length ? `\n${problems.length} problem(s).` : '\nAll cards pass.');
  process.exit(problems.length ? 1 : 0);
}
