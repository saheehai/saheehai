import React from 'react';

/**
 * A round picture, or the first letter of the nickname when there is none.
 * Decorative: the name or label next to it carries the meaning.
 */
function Avatar({ src, name, size = 24, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`avatar ${className}`.trim()}
        style={style}
      />
    );
  }
  const initial = (name || '').trim().charAt(0).toUpperCase() || '·';
  return (
    <span className={`avatar avatar--initial ${className}`.trim()} style={style} aria-hidden="true">
      {initial}
    </span>
  );
}

export default Avatar;
