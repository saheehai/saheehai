import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * A modal for the actions that cannot be undone.
 *
 * Same shell as the disclaimer modal, with the things a destructive dialog
 * needs on top: focus moves into it and is trapped there, Escape and the
 * backdrop close it, focus goes back where it was, and when `confirmWord`
 * is given the person has to type it before the button enables.
 */
function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  confirmWord = null,
  confirmHint = null,
  busy = false,
  onConfirm,
  onClose,
}) {
  const [typed, setTyped] = useState('');
  const cardRef = useRef(null);
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    const card = cardRef.current;
    const focusable = () =>
      Array.from(
        card.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')
      );
    const first = focusable().find((el) => !el.classList.contains('modal-close')) || card;
    first.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [onClose]);

  const ready = !busy && (!confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase());

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal-card modal-card--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={cardRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
          disabled={busy}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <h2 id={titleId} className="modal-title">
          {title}
        </h2>

        <div className="confirm__body">{children}</div>

        {confirmWord && (
          <div className="confirm__field">
            <label htmlFor={inputId}>{confirmHint || `Type ${confirmWord} to continue`}</label>
            <input
              id={inputId}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              disabled={busy}
            />
          </div>
        )}

        <div className="confirm__actions">
          <button type="button" className="confirm__cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="confirm__danger"
            onClick={onConfirm}
            disabled={!ready}
            aria-disabled={!ready}
          >
            {busy ? 'One moment…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
