import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FlaskConical, MessageCircle } from 'lucide-react';

/**
 * "Experiments" dropdown in the header.
 *
 * The chat is the first experiment; it is reached from here rather than from
 * a top-level button so new experiments can join the list without the header
 * growing a button each time.
 */
// Everything in here is beta, and says so: the companion is a secondary
// feature, not the product, and nobody should mistake it for care.
const ITEMS = [{ label: 'Chat', tag: 'beta', to: '/chat', Icon: MessageCircle }];

function ExperimentsMenu({ active = false }) {
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
        aria-label="Experiments"
      >
        <FlaskConical size={15} aria-hidden="true" />
        <span className="nav-btn__label">Experiments</span>
        <ChevronDown size={14} className="menu__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="menu__panel" role="menu">
          {ITEMS.map(({ label, tag, to, Icon }) => (
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
              <Icon size={16} aria-hidden="true" />
              {label}
              {tag && <span className="menu__tag">({tag})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExperimentsMenu;
