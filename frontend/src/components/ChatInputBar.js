import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

const MAX_HEIGHT_PX = 120;

/**
 * The message box and its send button.
 *
 * The button is three stacked paper layers. Holding it down collapses the
 * stack; sending springs it back and greys it out until the reply lands, so
 * "busy" never looks like "still pressed".
 */
function ChatInputBar({ value, onChange, onSend, sending = false, disabled = false }) {
  const textareaRef = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [pressKey, setPressKey] = useState(0);

  const hasText = value.trim().length > 0;
  const canSend = hasText && !sending && !disabled;

  // Grow with the text up to a few lines, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const fire = useCallback(() => {
    if (!canSend) return;
    // A fresh key remounts the stack, so the spring restarts cleanly even if
    // the previous press has not finished settling.
    setPressKey((k) => k + 1);
    setPressed(true);
    onSend();
  }, [canSend, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        fire();
      }
    },
    [fire]
  );

  const buttonClass = [
    'chat-send-btn',
    sending && 'is-sending',
    pressed && 'is-pressed',
    !hasText && !sending && 'is-empty',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="chat-input-bar">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="chat-input"
        disabled={disabled}
        aria-label="Message"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={fire}
        disabled={sending || disabled}
        aria-label="Send"
        aria-busy={sending}
      >
        <span key={pressKey} className="chat-send-stack" onAnimationEnd={() => setPressed(false)}>
          <span className="chat-send-layer chat-send-layer--shadow" />
          <span className="chat-send-layer chat-send-layer--mid" />
          <span className="chat-send-layer chat-send-layer--top">
            <Send size={16} color="white" strokeWidth={2} aria-hidden="true" />
          </span>
        </span>
      </button>
    </div>
  );
}

export default ChatInputBar;
