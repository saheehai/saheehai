/**
 * Loading and sequencing for Practice cards.
 *
 * Cards are static JSON under /practice-cards, published straight to the
 * bucket by tools/practice/upload.js and served by the same CDN as the
 * guides. No account and no API are involved in reading them: this is the
 * same shape as news and resources, which is why a bad network still leaves
 * someone with the cards they already had.
 *
 * The checks here are deliberately smaller than the ones in
 * tools/practice/rules.js. That file enforces house style and length caps at
 * authoring time, where a failure can be fixed. This one only asks whether a
 * card can be rendered at all, because the alternative in front of a person
 * is half a card.
 */

export const MAX_HISTORY = 20;
const NO_REPEAT_WITHIN = 20;

const KINDS = ['concept', 'situation', 'both', 'support'];
const VERDICTS = ['taught', 'other', 'either'];
const TAUGHT_COUNT = { concept: 1, situation: 1, both: 0, support: 0 };

/** Can this be rendered without lying to anyone? */
function isValidCard(card) {
  if (!card || typeof card !== 'object') return false;
  if (card.schema !== 1) return false;
  if (typeof card.id !== 'string' || !card.id) return false;
  if (!KINDS.includes(card.kind)) return false;
  if (typeof card.concept !== 'string' || !card.concept) return false;
  if (typeof card.prompt !== 'string' || !card.prompt.trim()) return false;
  if (typeof card.explain !== 'string' || !card.explain.trim()) return false;
  if (!Array.isArray(card.options) || card.options.length !== 2) return false;
  for (const option of card.options) {
    if (!option || typeof option !== 'object') return false;
    if (typeof option.label !== 'string' || !option.label.trim()) return false;
    // Both notes, always. The note on the option nobody picked is the reason
    // this teaches instead of testing, so a card missing one is not a card.
    if (typeof option.note !== 'string' || !option.note.trim()) return false;
    if (!VERDICTS.includes(option.verdict)) return false;
  }
  const taught = card.options.filter((o) => o.verdict === 'taught').length;
  return taught === TAUGHT_COUNT[card.kind];
}

/** A missing file comes back as the SPA shell with a 200, so check the type. */
async function getJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('json')) throw new Error(`could not load ${path}`);
  return response.json();
}

export async function loadManifest() {
  const manifest = await getJson('/practice-cards/manifest.json');
  if (!manifest || !Array.isArray(manifest.packs) || !manifest.packs.length) {
    throw new Error('the manifest names no packs');
  }
  return manifest;
}

/**
 * One pack, with anything unrenderable quietly dropped. If most of a pack is
 * broken that is not one bad card, it is the wrong file, so say so and let
 * the page show its error state.
 */
export async function loadPack(file) {
  const cards = await getJson(`/practice-cards/${file}`);
  if (!Array.isArray(cards)) throw new Error(`${file} is not a list of cards`);
  const usable = cards.filter(isValidCard);
  if (cards.length && usable.length < cards.length / 2) {
    throw new Error(`${file} is mostly unreadable`);
  }
  return usable;
}

const lastN = (history, n) => history.slice(Math.max(0, history.length - n));

/**
 * Picks the next card.
 *
 * The rules are deliberately dumb and readable, because a draw order nobody
 * can explain is a draw order nobody can check. Unseen cards come first,
 * weighted toward the concepts someone has met least, so the feed widens
 * rather than drilling. Cards marked to come back to are folded in once they
 * are due. Nothing repeats inside twenty draws or the size of the deck,
 * whichever is smaller, nothing follows a card on the same concept, and a
 * heavy card is never the first thing anyone sees.
 */
export function drawCard(pool, { history = [], progress = {}, allowSensitive = true } = {}) {
  // The no-repeat window cannot be wider than the deck, or a small deck runs
  // out and the feed dead-ends: every card is "recent", nothing is eligible,
  // and the page sits there saying they come back around when they never do.
  // Ten cards and a window of twenty was exactly that.
  //
  // It is kept under the deck size rather than at it, so a small deck still
  // has several cards to choose between. At pool.length - 1 there is exactly
  // one, and the deck becomes a fixed rotation in the same order every time.
  const noRepeat = Math.min(NO_REPEAT_WITHIN, Math.floor(pool.length * 0.6));
  const recent = new Set(lastN(history, noRepeat).map((c) => c.id));
  const lastConcept = history.length ? history[history.length - 1].concept : null;
  const seen = new Set(progress.seen || []);
  const review = new Set(progress.review || []);

  const eligible = pool.filter((card) => {
    if (recent.has(card.id)) return false;
    if (card.sensitive && !allowSensitive) return false;
    // Never open a session on a heavy one.
    if (card.sensitive && history.length === 0) return false;
    return true;
  });
  if (!eligible.length) return null;

  const spread = eligible.filter((c) => c.concept !== lastConcept);
  const candidates = spread.length ? spread : eligible;

  const due = candidates.filter((c) => review.has(c.id));
  const unseen = candidates.filter((c) => !seen.has(c.id));

  // Roughly one in five is something to come back to, once anything is due.
  // Everything else prefers a card nobody has met yet.
  const wantReview = due.length && Math.random() < 0.2;
  const from = wantReview ? due : unseen.length ? unseen : candidates;

  // Count how much of each concept has been met, and lean toward the thin
  // ones. Adding one keeps a brand new concept from dividing by zero.
  const met = {};
  for (const id of seen) {
    const card = pool.find((c) => c.id === id);
    if (card) met[card.concept] = (met[card.concept] || 0) + 1;
  }
  const weight = (card) => 1 / (1 + (met[card.concept] || 0));
  const total = from.reduce((sum, card) => sum + weight(card), 0);
  let roll = Math.random() * total;
  for (const card of from) {
    roll -= weight(card);
    if (roll <= 0) return card;
  }
  return from[from.length - 1];
}
