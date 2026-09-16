import React from 'react';

function MessageBubble({ message }) {
  const isUser = message.sender === 'user';
  const isGreeting = message.id === 1;

  return (
    <div
      className={`flex mb-3 message-row ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}
        style={isGreeting ? { fontWeight: 500 } : undefined}
      >
        <p className="break-words message-bubble__text">{message.text}</p>
      </div>
    </div>
  );
}

export default React.memo(MessageBubble);
