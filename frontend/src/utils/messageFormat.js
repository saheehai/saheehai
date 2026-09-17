/**
 * The small slice of Markdown the companion is allowed to write.
 *
 * The prompt asks for prose, but models drift, and a stray "**" reaching
 * someone mid-sentence looks broken. So the chat renders a deliberately tiny
 * subset and nothing else: bold, italic, and simple lists.
 *
 * This produces plain data that MessageBubble turns into React elements.
 * Nothing here builds HTML and nothing is ever handed to
 * dangerouslySetInnerHTML, so text from the model cannot become markup.
 * Anything outside the subset is left exactly as the person would read it.
 */

// Bold before italic, so "**x**" is never seen as two italics. Emphasis may
// not open or close on a space, which is what keeps "2 * 3 = 6" as arithmetic
// rather than an italic run. Underscores are deliberately not emphasis: they
// turn up inside words far more often than a model writes _italics_.
const INLINE = /(\*\*(?=\S)[^*\n]*[^\s*]\*\*|\*(?=\S)[^*\n]*[^\s*]\*)/g;

const BULLET = /^\s{0,3}[-*•]\s+(.*)$/;
const NUMBER = /^\s{0,3}\d{1,2}[.)]\s+(.*)$/;

/**
 * One line of text as a list of {type, text} runs.
 *
 * Walked with matchAll rather than split, so a run is emphasis only because
 * the pattern matched it. Deciding after the fact by looking at a piece's
 * first and last characters gets text like "** **" wrong.
 */
export function parseInline(line) {
  const runs = [];
  let at = 0;

  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) {
      runs.push({ type: 'text', text: line.slice(at, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      runs.push({ type: 'strong', text: token.slice(2, -2) });
    } else {
      runs.push({ type: 'em', text: token.slice(1, -1) });
    }
    at = match.index + token.length;
  }

  if (at < line.length) runs.push({ type: 'text', text: line.slice(at) });
  return runs.length ? runs : [{ type: 'text', text: line }];
}

/**
 * A message as blocks: paragraphs and lists.
 *
 * Blank lines separate paragraphs. Lines inside one paragraph keep their
 * breaks, the way the bubble has always shown them.
 */
export function parseMessage(text) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', lines: paragraph.map(parseInline) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const line of String(text ?? '').split('\n')) {
    const bullet = line.match(BULLET);
    const numbered = !bullet && line.match(NUMBER);

    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      flushParagraph();
      if (!list || list.type !== kind) {
        flushList();
        list = { type: kind, items: [] };
      }
      list.items.push(parseInline((bullet || numbered)[1]));
      continue;
    }

    flushList();
    if (line.trim() === '') {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }

  flushList();
  flushParagraph();
  return blocks;
}
