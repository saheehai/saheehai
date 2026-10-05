import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * The two answers, left and right, in DOM order so a screen reader and a
 * keyboard meet them the same way an eye does.
 *
 * Each one carries an arrow on its outer edge, pointing the way the card
 * goes. It used to be an A and a D in the corner, which named a key and
 * nothing else; the arrow names the swipe and the key at once.
 *
 * During a horizontal drag the option being aimed at goes to an outlined
 * "aiming" state, and past the commit threshold it fills in: the fill is
 * literally a preview of the pressed state, so letting go is never a
 * surprise. The other option is never dimmed. Dimming would say it is wrong,
 * and on a card where both answers are real it is not.
 */

const ARROW = { left: ArrowLeft, right: ArrowRight };

// aria-keyshortcuts takes a space separated list, and both of these really
// do answer, so it can say so rather than naming half of them.
const SHORTCUTS = { left: 'A ArrowLeft', right: 'D ArrowRight' };

function PracticeOptions({
  options,
  aiming = null,
  committing = false,
  chosen = null,
  revealed = false,
  onChoose,
  disabled = false,
}) {
  return (
    <div className="practice-options">
      {options.map((option) => {
        const isChosen = chosen === option.side;
        const isAimed = !revealed && aiming === option.side;
        const Arrow = ARROW[option.side];
        const classes = [
          'practice-option',
          // Side comes from the data, not from the position: rules.js pins
          // the order but the browser side check does not re-read it.
          `practice-option--${option.side}`,
          isAimed && 'is-aiming',
          isAimed && committing && 'is-committing',
          isChosen && 'is-chosen',
          revealed && !isChosen && 'is-passed',
          revealed && option.verdict === 'taught' && 'is-taught',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={option.side}
            type="button"
            className={classes}
            onClick={() => onChoose(option.side)}
            disabled={disabled}
            aria-keyshortcuts={SHORTCUTS[option.side]}
            aria-pressed={revealed ? isChosen : undefined}
          >
            <span className="practice-option__arrow" aria-hidden="true">
              <Arrow size={16} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="practice-option__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PracticeOptions;
