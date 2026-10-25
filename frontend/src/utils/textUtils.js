import { CHUNK_SIZE } from './constants';
import { isListLine } from './messageFormat';

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

/**
 * A reply as the pieces it may be cut between, each with the text that joins
 * it to the piece before: a space between sentences, a newline between lines,
 * a blank line between paragraphs.
 *
 * A whole list is one piece, and so is the line that introduces it ("On the
 * site you can:"), so a list never starts in one bubble and ends in the next.
 */
function pieces(text) {
  const out = [];
  let sep = '';

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (out.length) sep = '\n\n';
      continue;
    }

    const prev = out[out.length - 1];
    if (isListLine(line)) {
      if (prev && (prev.list || prev.text.trimEnd().endsWith(':'))) {
        prev.text += sep + line;
        prev.list = true;
      } else {
        out.push({ text: line, sep, list: true });
      }
    } else {
      const sentences = line.split(/(?<=[.!?])[ \t]+/);
      for (let i = 0; i < sentences.length; i++) {
        out.push({ text: sentences[i], sep: i === 0 ? sep : ' ', list: false });
      }
    }
    sep = '\n';
  }

  return out;
}

/**
 * A long reply as a few bubbles, sent one after another like texts.
 *
 * It cuts only between sentences or paragraphs and keeps every line break
 * inside a bubble. It used to rejoin sentences with spaces, which ran a list
 * onto one line with its bullets showing as stray asterisks, and could split
 * the list across two bubbles.
 */
export function splitIntoChunks(text, maxWords = CHUNK_SIZE) {
  if (!text || countWords(text) <= maxWords) {
    return [text];
  }

  const chunks = [];
  let current = '';
  let words = 0;

  for (const piece of pieces(text)) {
    const count = countWords(piece.text);

    if (words > 0 && words + count > maxWords) {
      chunks.push(current.trim());
      current = piece.text;
      words = count;
    } else {
      current += (current ? piece.sep : '') + piece.text;
      words += count;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}
