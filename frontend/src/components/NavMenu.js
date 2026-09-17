import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

/**
 * A dropdown in the header: one button that opens a short list of pages.
 *
 * The header uses two of these. "Experiments" holds the chat and the journal,
 * so the beta things stay together (which is how the Terms describe them)
 * and the header does not grow a button per experiment. "Resources" holds
 * the guides, the crisis lines and the news, so the header stays the same
 * width whether or not someone is signed in.
 *
 * `items` is [{ label, to, Icon, tag? }]; `tag` renders as "(beta)".
 */
function NavMenu({ label, Icon, items, active = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className={`logout-button nav-btn menu__trigger ${open ? 'is-open' : ''} ${active ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <Icon size={15} aria-hidden="true" />
        <span className="nav-btn__label">{label}</span>
        <ChevronDown size={14} className="menu__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="menu__panel" role="menu">
          {items.map(({ label: itemLabel, tag, to, Icon: ItemIcon }) => (
            <button
              key={to}
              type="button"
              role="menuitem"
              className="menu__item"
              onClick={() => {
                close();
                navigate(to);
              }}
            >
              <ItemIcon size={16} aria-hidden="true" />
              {itemLabel}
              {tag && <span className="menu__tag">({tag})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NavMenu;
