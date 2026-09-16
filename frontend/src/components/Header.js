import React from 'react';

function Header({ left, title, right }) {
  return (
    <div className="app-header fixed top-0 left-0 right-0 z-10 p-2">
      <div className="flex justify-between items-center app-header__row">
        <div className="app-header__side">{left}</div>
        {title && <h2 className="app-header__title">{title}</h2>}
        <div className="app-header__side app-header__side--right">{right}</div>
      </div>
    </div>
  );
}

export default Header;
