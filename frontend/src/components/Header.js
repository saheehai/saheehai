import React from 'react';

/**
 * Fixed top bar. Height comes from the --header-h custom property so the
 * pages beneath can leave exactly that much room, rather than each guessing.
 */
function Header({ left, title, right, compactTitle = false }) {
  return (
    <header className="app-header">
      <div className="app-header__row">
        <div className="app-header__side">{left}</div>
        {title && (
          <h2 className={`app-header__title ${compactTitle ? 'app-header__title--compact' : ''}`}>
            {title}
          </h2>
        )}
        <div className="app-header__side app-header__side--right">{right}</div>
      </div>
    </header>
  );
}

export default Header;
