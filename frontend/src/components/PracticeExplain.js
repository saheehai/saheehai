import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowRight, Check, Circle, Phone, ThumbsDown, ThumbsUp } from 'lucide-react';

/**
 * The explanation, as a small popup floating over the card.
 *
 * It used to be inside the card, then a sheet across the bottom of the
 * screen. Both made the answer feel like a place you had arrived at and had
 * to get out of. It is a note that appears over the card instead, and it
 * goes away on the same movements that move the deck: swipe, scroll, WASD,
 * the arrows, Escape, the button, or a tap outside it. Whatever is already
 * in the person's hand dismisses it, so nobody has to find the control.
 *
 * Dismissing is what moves to the next card, so there is one way forward.
 *
 * It always explains both options, including the one nobody picked. That
 * note is what makes this teaching rather than testing, and it is why a card
 * without it is dropped before it ever renders.
 */

const DISMISS_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'escape',
  'enter',
  ' ',
]);

// Far enough that resting a thumb does not count.
const SWIPE_PX = 50;

function verdictFor(card, chosen, shown) {
  if (card.kind === 'support') return { tone: 'none', line: 'There is no wrong answer here.' };
  if (card.kind === 'both') {
    return { tone: 'none', line: 'Both of these work. They just cost different things.' };
  }
  if (shown) return { tone: 'none', line: 'Here is the answer.' };
  const picked = card.options.find((option) => option.side === chosen);
  if (picked && picked.verdict === 'taught') return { tone: 'good', line: 'That is the one.' };
  return { tone: 'other', line: 'Not quite.' };
}

function PracticeExplain({ card, chosen, shown, vote, onVote, onRetry, onDismiss }) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const pointer = useRef(null);
  const verdict = verdictFor(card, chosen, shown);
  const heavy = card.sensitive || card.kind === 'support';

  // Focus lands on the popup rather than being announced through a live
  // region: far more reliable across screen readers, and it puts the reader
  // at the top of exactly the text that matters. It is also what makes the
  // keys below reach it.
  useEffect(() => {
    if (panelRef.current) panelRef.current.focus();
  }, [card.id]);

  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Leave the controls inside the popup their own keyboard.
      const onControl = event.target.closest && event.target.closest('button, a');
      if (onControl && (event.key === 'Enter' || event.key === ' ')) return;
      if (!DISMISS_KEYS.has(event.key.toLowerCase())) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  // A wheel or trackpad flick dismisses, unless the text still has somewhere
  // to scroll in that direction.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      const body = bodyRef.current;
      if (body && body.contains(event.target)) {
        const room =
          event.deltaY > 0
            ? body.scrollHeight - body.clientHeight - body.scrollTop > 1
            : body.scrollTop > 1;
        if (room) return;
      }
      event.preventDefault();
      dismiss();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [dismiss]);

  const onPointerDown = (event) => {
    if (event.target.closest('button, a')) return;
    pointer.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) >= SWIPE_PX) dismiss();
  };

  return (
    <div className="practice-explain" data-no-drag>
      <button
        type="button"
        className="practice-explain__backdrop"
        aria-label="Close the explanation and go to the next card"
        onClick={dismiss}
      />
      <div
        className="practice-explain__panel"
        role="dialog"
        aria-modal="true"
        aria-label="The answer"
        tabIndex={-1}
        ref={panelRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        <div className="practice-explain__body" ref={bodyRef}>
          <p className={`practice-verdict is-${verdict.tone}`}>
            {verdict.tone === 'good' && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
            {verdict.tone === 'other' && <Circle size={12} strokeWidth={3} aria-hidden="true" />}
            <span>{verdict.line}</span>
          </p>

          <p className="practice-card__explain">{card.explain}</p>

          <ul className="practice-notes">
            {card.options.map((option) => (
              <li key={option.side} className="practice-notes__item">
                <strong>{option.label}.</strong> {option.note}
              </li>
            ))}
          </ul>

          {heavy && (
            <a className="footer-crisis__action practice-card__call" href="tel:988">
              <Phone size={16} strokeWidth={2.25} aria-hidden="true" />
              <span>Call or text 988</span>
            </a>
          )}

          {card.guide && (
            <a className="practice-card__guide" href={`/resources/${card.guide}`}>
              More in {card.guide_label || 'the guide'}
              <ArrowRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="practice-explain__footer">
          <button type="button" className="practice-explain__next" onClick={dismiss}>
            Next
          </button>
          <button type="button" className="practice-link" onClick={onRetry}>
            Try again
          </button>
          <div className="practice-vote">
            <button
              type="button"
              className={`practice-vote__button ${vote === 'up' ? 'is-picked' : ''}`}
              onClick={() => onVote('up')}
              aria-label="This card was helpful"
              aria-pressed={vote === 'up'}
            >
              <ThumbsUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`practice-vote__button ${vote === 'down' ? 'is-picked' : ''}`}
              onClick={() => onVote('down')}
              aria-label="Something is wrong with this card"
              aria-pressed={vote === 'down'}
            >
              <ThumbsDown size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticeExplain;
