import React from 'react';

/**
 * Loading indicator: a seedling that sprouts, unfurls a leaf on each side,
 * and starts again. Replaces the "Loading..." text everywhere something is
 * being fetched. Announced to screen readers as the label; the drawing
 * itself is decorative.
 */
function Sprout({ label = 'Loading', size = 56, className = '' }) {
  return (
    <div className={`sprout ${className}`.trim()} role="status" aria-live="polite">
      <svg
        className="sprout__svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="sprout__stem" d="M50 92 V40" pathLength="1" />
          <path
            className="sprout__leaf sprout__leaf--left"
            d="M50 40 C 38 44, 22 36, 18 16 C 38 12, 52 24, 50 40 Z"
          />
          <path
            className="sprout__leaf sprout__leaf--right"
            d="M50 62 C 60 64, 76 58, 80 40 C 62 36, 50 48, 50 62 Z"
          />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default React.memo(Sprout);
