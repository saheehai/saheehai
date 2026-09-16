import React from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import Header from './Header';
import MessageBubble from './MessageBubble';
import ChatInputBar from './ChatInputBar';
import { GREETING_MESSAGE } from '../utils/constants';

/**
 * A still of the chat, shown blurred behind the sign-in card.
 *
 * Deliberately not the real ChatPage: nothing here reads storage or talks to
 * the network, so whoever signed out last leaves no trace on this screen.
 * It is inert, so nothing in it can be focused or clicked through the blur.
 */
function ChatBackdrop() {
  return (
    <div className="auth-backdrop paper-texture" aria-hidden="true" inert="">
      <Header
        left={<span className="app-header__brand">Saheeh AI</span>}
        right={
          <>
            <span className="logout-button menu__trigger">
              <FlaskConical size={15} />
              <span className="menu__label">Experiments</span>
              <ChevronDown size={14} className="menu__caret" />
            </span>
            <span className="logout-button">Journal</span>
            <span className="logout-button">About Us</span>
          </>
        }
      />
      <div className="chat-scroll">
        <div className="max-w-3xl mx-auto">
          <MessageBubble message={GREETING_MESSAGE} />
        </div>
      </div>
      <div className="chat-input-container">
        <div className="max-w-3xl mx-auto">
          <ChatInputBar value="" onChange={() => {}} onSend={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}

export default ChatBackdrop;
