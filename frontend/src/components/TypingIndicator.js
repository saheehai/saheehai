import React from 'react';

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="typing-indicator">
        <div className="flex gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
          <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(TypingIndicator);
