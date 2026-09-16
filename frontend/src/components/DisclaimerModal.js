import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Crisis-resources acknowledgement, shown once per device before the first
 * chat. Not a login: accounts are Cognito's job.
 */
function DisclaimerModal({ onClose, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>

        <h2 id="disclaimer-title" className="modal-title">
          Welcome to Saheeh AI
        </h2>

        <div className="modal-disclaimer">
          <p className="modal-disclaimer__lead">
            <strong>Important notice</strong>
            This AI companion is not a replacement for professional mental health care. If you
            are experiencing a mental health crisis or emergency, please contact a mental health
            professional or call a crisis line right away.
          </p>
          <p className="modal-disclaimer__resources">
            <strong>Crisis resources</strong>
            National Suicide Prevention Lifeline: 988
            <br />
            Crisis Text Line: text HOME to 741741
          </p>
        </div>

        <p className="modal-consent">
          By continuing, you acknowledge this is an AI assistant and not a mental health
          professional.
        </p>

        <button type="button" onClick={onConfirm} className="modal-confirm">
          I understand
        </button>
      </div>
    </div>
  );
}

export default DisclaimerModal;
