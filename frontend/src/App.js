import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { ChevronDown, Send } from "lucide-react";
import "./App.css";
import awsService from "./services/awsService";
import rateLimitService from "./services/rateLimitService";
import JournalPage from "./JournalPage";
import JournalArchivePage from "./JournalArchivePage";
import MissionPage from "./components/MissionPage";
import Header from "./components/Header";
import LoginModal from "./components/LoginModal";
import MessageBubble from "./components/MessageBubble";
import TypingIndicator from "./components/TypingIndicator";
import AuthPage from "./components/AuthPage";
import * as cognito from "./services/cognitoService";
import { usePersistedState } from "./hooks/usePersistedState";
import { useScrollToBottom } from "./hooks/useScrollToBottom";
import { splitIntoChunks } from "./utils/textUtils";
import { STORAGE_KEYS, TYPING_DELAY_MS } from "./utils/constants";

const INITIAL_MESSAGES = [
  { id: 1, text: "Hello! I'm Saheeh AI. Ask me anything!", sender: "assistant" },
];

function ChatPage({ onSignedOut }) {
  const navigate = useNavigate();
  // Persisted, not component state. ChatPage unmounts on navigation, so plain
  // useState reset this on every return from /journal and re-prompted the
  // disclaimer as though the visitor had been logged out.
  const [hasAcknowledged, setHasAcknowledged] = usePersistedState(
    STORAGE_KEYS.disclaimerAccepted,
    false
  );
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [messages, setMessages] = usePersistedState(STORAGE_KEYS.chatMessages, INITIAL_MESSAGES);
  const [conversationId, setConversationId] = usePersistedState(STORAGE_KEYS.conversationId, null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const scrollContainerRef = useRef(null);
  const [scrollRestored, setScrollRestored] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { endRef: messagesEndRef, scrollToBottom } = useScrollToBottom(
    [messages, isTyping, isSending],
    { enabled: scrollRestored && !isTyping && !isSending }
  );

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      setScrollRestored(true);
      return;
    }
    const saved = sessionStorage.getItem(STORAGE_KEYS.chatScrollPosition);
    const raf = requestAnimationFrame(() => {
      const node = scrollContainerRef.current;
      if (!node) return;
      if (saved !== null) {
        node.scrollTop = parseInt(saved, 10);
      } else {
        node.scrollTop = node.scrollHeight;
      }
      const distanceFromBottom = node.scrollHeight - node.clientHeight - node.scrollTop;
      setIsAtBottom(distanceFromBottom <= 20);
      setScrollRestored(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      // Use the node captured at mount, not scrollContainerRef.current: by the
      // time cleanup runs React may have already detached the ref.
      sessionStorage.setItem(STORAGE_KEYS.chatScrollPosition, String(el.scrollTop));
    };
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      sessionStorage.setItem(STORAGE_KEYS.chatScrollPosition, String(el.scrollTop));
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      setIsAtBottom(distanceFromBottom <= 20);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Acknowledging the crisis-resources disclaimer, not signing in - that is
  // Cognito's job now. Persisted so it is asked once, not on every return
  // from /journal. setIsLoggedIn is a stable useState setter, but eslint
  // cannot see through the custom hook to prove it.
  const handleAcknowledge = useCallback(() => {
    setHasAcknowledged(true);
    setShowLoginModal(false);
  }, [setHasAcknowledged]);

  const handleSignOut = useCallback(() => {
    cognito.signOut();
    onSignedOut();
  }, [onSignedOut]);

  const handleSend = useCallback(async () => {
    const userMessage = inputText.trim();
    if (!userMessage) return;
    if (!hasAcknowledged) {
      setShowLoginModal(true);
      return;
    }

    const rateLimitCheck = rateLimitService.checkAndIncrement();
    if (!rateLimitCheck.allowed) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: `Daily limit of ${rateLimitCheck.limit} requests exceeded. Please try again tomorrow.`,
          sender: 'assistant',
        },
      ]);
      return;
    }

    setIsSending(true);
    setIsTyping(true);

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: userMessage, sender: "user" },
    ]);
    setInputText("");

    try {
      const result = await awsService.sendMessage(userMessage, conversationId);
      // The server holds the real quota; keep the local hint in step with it.
      rateLimitService.syncFromServer(result.quota);
      const aiResponse = result.response;
      const newConversationId = result.conversationId;

      if (newConversationId !== conversationId) {
        setConversationId(newConversationId);
      }

      const chunks = splitIntoChunks(aiResponse);

      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
          setIsTyping(true);
          await new Promise((resolve) => setTimeout(resolve, TYPING_DELAY_MS));
          setIsTyping(false);
        } else {
          setIsTyping(false);
        }

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + i, text: chunks[i], sender: "assistant" },
        ]);
      }

      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Chat error:', err.message);
      setIsTyping(false);

      // A 429 is the server's quota, which is authoritative: the local hint
      // was simply behind, so do not hand the attempt back.
      if (err.status !== 429) {
        rateLimitService.rollback();
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: err.message, sender: "assistant" },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [inputText, hasAcknowledged, conversationId, setMessages, setConversationId, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <Header
        right={
          <>
            <button onClick={() => navigate('/mission')} className="logout-button">
              About Us
            </button>
            <button onClick={() => navigate('/journal')} className="logout-button">
              Journal
            </button>
            <button onClick={handleSignOut} className="logout-button">
              Sign Out
            </button>
          </>
        }
      />

      <div className="chat-scroll" ref={scrollContainerRef}>
        <div className="max-w-3xl mx-auto">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {!isAtBottom && (
        <button
          type="button"
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          aria-label="Scroll to latest"
        >
          <ChevronDown size={20} strokeWidth={2.5} />
        </button>
      )}

      <div className="chat-input-container">
        <div className="max-w-3xl mx-auto">
          <div className="chat-input-bar shadow-lg">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="chat-input flex-1 bg-transparent focus:outline-none text-base"
            />
            <button
              onClick={handleSend}
              className="chat-send-btn hover:scale-105 transition-transform flex-shrink-0"
              aria-label="Send"
            >
              <div className="relative w-full h-full">
                <div className="chat-send-icon chat-send-icon--shadow" />
                <div
                  className={`chat-send-icon chat-send-icon--mid ${isSending ? 'chat-send-icon--sending' : ''}`}
                />
                <div
                  className={`chat-send-icon chat-send-icon--top ${isSending ? 'chat-send-icon--sending' : ''}`}
                >
                  <Send size={16} color="white" strokeWidth={2} />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} onConfirm={handleAcknowledge} />
      )}
    </div>
  );
}

function App() {
  // null while the stored session is being checked. Rendering AuthPage during
  // that check would flash a sign-in form at someone who is already signed in.
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    cognito
      .getIdToken()
      .then((token) => {
        if (!cancelled) setIsAuthenticated(Boolean(token));
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignedOut = useCallback(() => setIsAuthenticated(false), []);

  if (isAuthenticated === null) {
    return <div className="app-booting" aria-busy="true" />;
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatPage onSignedOut={handleSignedOut} />} />
        <Route path="/mission" element={<MissionPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal/archive" element={<JournalArchivePage />} />
      </Routes>
    </Router>
  );
}

export default App;
