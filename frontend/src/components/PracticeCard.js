import React from 'react';

/**
 * One card: an eyebrow and one short question. That is the whole face.
 *
 * The question is capped at one sentence by tools/practice/rules.js, which
 * is what lets this never scroll and never be cut off. Before 2026-09-18 a
 * prompt could run to 420 characters, which on a phone meant six lines, a
 * scrollbar inside the question, and the options pushed off the screen.
 *
 * The explanation is not here. It arrives after an answer as its own sheet
 * (PracticeExplain), which is where the length is allowed to be.
 */

// Even inside one sentence there is a range, so the longest questions get
// smaller type rather than a taller card.
function promptSize(prompt) {
  if (prompt.length > 95) return 'is-long';
  if (prompt.length > 60) return 'is-medium';
  return '';
}

function PracticeCard({ card, revealed, seenBefore }) {
  const nuanced = card.kind === 'both' || card.kind === 'support';

  return (
    <article className={`practice-card ${revealed ? 'is-answered' : ''}`}>
      <div className="practice-card__eyebrow">
        <span className="practice-card__topic">{card.eyebrow}</span>
        {card.sensitive && (
          <span className="practice-card__flag">This one is about a hard subject.</span>
        )}
        {nuanced && !card.sensitive && (
          <span className="practice-card__flag">Both can be right</span>
        )}
        {seenBefore && <span className="practice-card__flag">Seen before</span>}
      </div>

      <h2 className={`practice-card__prompt ${promptSize(card.prompt)}`}>{card.prompt}</h2>
    </article>
  );
}

export default PracticeCard;
