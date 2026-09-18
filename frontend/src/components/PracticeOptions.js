import React from 'react';

/**
 * The two answers, left and right, in DOM order so a screen reader and a
 * keyboard meet them the same way an eye does.
 *
 * During a horizontal drag the option being aimed at goes to an outlined
 * "aiming" state, and past the commit threshold it fills in: the fill is
 * literally a preview of the pressed state, so letting go is never a
 * surprise. The other option is never dimmed. Dimming would say it is wrong,
 * and on a card where both answers are real it is not.
 */

const KEYCAP = { left: 'A', right: 'D' };

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
        const classes = [
          'practice-option',
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
            aria-keyshortcuts={KEYCAP[option.side]}
            aria-pressed={revealed ? isChosen : undefined}
          >
            <span className="practice-option__key" aria-hidden="true">
              {KEYCAP[option.side]}
            </span>
            <span className="practice-option__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PracticeOptions;
