import React from 'react';
import { COLORS } from '../utils/constants';

function LoginModal({ onClose, onConfirm }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="modal-close"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="modal-title">Welcome to Saheeh AI</h2>

        <div className="modal-disclaimer">
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: COLORS.cream }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              ⚠️ Important Notice
            </strong>
            This AI chatbot is not a replacement for professional mental health care. If you are
            experiencing a mental health crisis or emergency, please contact a mental health
            professional or call a crisis hotline immediately.
          </p>
          <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '12px', opacity: 0.9, color: COLORS.cream }}>
            <strong>Crisis Resources:</strong><br />
            • National Suicide Prevention Lifeline: 988<br />
            • Crisis Text Line: Text HOME to 741741
          </p>
        </div>

        <p style={{ color: COLORS.cream, fontSize: '14px', marginBottom: '24px', opacity: 0.9 }}>
          By clicking continue, you acknowledge this is an AI assistant and not a mental health professional.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onConfirm} className="modal-confirm">
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
