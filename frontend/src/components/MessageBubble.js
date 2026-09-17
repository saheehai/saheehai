import React from 'react';
import { parseMessage } from '../utils/messageFormat';

/**
 * One turn of the conversation.
 *
 * The companion's text goes through parseMessage, which understands bold,
 * italic and simple lists and nothing else. Everything below is built from
 * React elements, so model output is always text, never markup. The person's
 * own message is never parsed: what they typed is what they see.
 */

function Runs({ runs }) {
  return runs.map((run, i) => {
    if (run.type === 'strong') return <strong key={i}>{run.text}</strong>;
    if (run.type === 'em') return <em key={i}>{run.text}</em>;
    return <React.Fragment key={i}>{run.text}</React.Fragment>;
  });
}

function Block({ block }) {
  if (block.type === 'ul' || block.type === 'ol') {
    const List = block.type === 'ul' ? 'ul' : 'ol';
    return (
      <List className="message-bubble__list">
        {block.items.map((item, i) => (
          <li key={i}>
            <Runs runs={item} />
          </li>
        ))}
      </List>
    );
  }
  return (
    <p className="break-words message-bubble__text">
      {block.lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <Runs runs={line} />
        </React.Fragment>
      ))}
    </p>
  );
}

function MessageBubble({ message }) {
  const isUser = message.sender === 'user';
  const isGreeting = message.id === 1;
  const blocks = isUser ? null : parseMessage(message.text);

  return (
    <div className={`flex mb-3 message-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}
        style={isGreeting ? { fontWeight: 500 } : undefined}
      >
        {isUser ? (
          <p className="break-words message-bubble__text">{message.text}</p>
        ) : (
          blocks.map((block, i) => <Block key={i} block={block} />)
        )}
      </div>
    </div>
  );
}

export default React.memo(MessageBubble);
