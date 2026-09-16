import { CHUNK_SIZE } from './constants';

export function splitIntoChunks(text, maxWords = CHUNK_SIZE) {
  if (!text || text.trim().split(/\s+/).length <= maxWords) {
    return [text];
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;

    if (currentWordCount > 0 && currentWordCount + sentenceWordCount > maxWords) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentWordCount = sentenceWordCount;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentWordCount += sentenceWordCount;
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
