import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ChevronDown } from "lucide-react";
import "./App.css";
import awsService from "./services/awsService";
import rateLimitService from "./services/rateLimitService";
import JournalPage from "./JournalPage";
import JournalArchivePage from "./JournalArchivePage";
import AboutPage from "./components/AboutPage";
import LegalPage from "./components/LegalPage";
import { NewsArticlePage, NewsListPage } from "./components/NewsPage";
import SiteNav from "./components/SiteNav";
import DisclaimerModal from "./components/DisclaimerModal";
import MessageBubble from "./components/MessageBubble";
import TypingIndicator from "./components/TypingIndicator";
import ChatInputBar from "./components/ChatInputBar";
import AuthPage from "./components/AuthPage";
import * as cognito from "./services/cognitoService";
import { usePersistedState } from "./hooks/usePersistedState";
import { useIdleSignOut } from "./hooks/useIdleSignOut";
import { useScrollToBottom } from "./hooks/useScrollToBottom";
import { splitIntoChunks } from "./utils/textUtils";
import { GREETING_MESSAGE, STORAGE_KEYS, TYPING_DELAY_MS } from "./utils/constants";

const INITIAL_MESSAGES = [GREETING_MESSAGE];

// What one person's session leaves in the browser. Cleared on sign-out so the
// next account on this device starts from nothing.
const PERSONAL_LOCAL_KEYS = [
  STORAGE_KEYS.chatMessages,
  STORAGE_KEYS.conversationId,
  STORAGE_KEYS.journalDraft,
  STORAGE_KEYS.disclaimerAccepted,
  STORAGE_KEYS.lastActive,
];

function ChatPage({ onSignOut }) {
  // Persisted, not component state. ChatPage unmounts on navigation, so plain
  // useState reset this on every return from /journal and re-prompted the
  // disclaimer as though the visitor had been logged out.
  const [hasAcknowledged, setHasAcknowledged] = usePersistedState(
    STORAGE_KEYS.disclaimerAccepted,
    false
  );
  // Ask up front rather than ambushing the first send.
  const [showDisclaimer, setShowDisclaimer] = useState(() => !hasAcknowledged);
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
  // Cognito's job now. setHasAcknowledged is a stable useState setter, but
  // eslint cannot see through the custom hook to prove it.
  const handleAcknowledge = useCallback(() => {
    setHasAcknowledged(true);
    setShowDisclaimer(false);
  }, [setHasAcknowledged]);

  const handleSend = useCallback(async () => {
    const userMessage = inputText.trim();
    if (!userMessage) return;
    if (!hasAcknowledged) {
      setShowDisclaimer(true);
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
      let result;
      try {
        result = await awsService.sendMessage(userMessage, conversationId);
      } catch (err) {
        // The stored conversation id is a cache, and it can go stale: it may
        // belong to a previous identity on this browser, or the server may no
        // longer hold it. Either way the server says 404, and the right
        // response is to start a fresh conversation, not to strand the person.
        if (err.status !== 404 || !conversationId) throw err;
        console.warn('Stored conversation was rejected; starting a new one');
        setConversationId(null);
        result = await awsService.sendMessage(userMessage, null);
      }
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

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn onSignOut={onSignOut} />

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
          <ChatInputBar
            value={inputText}
            onChange={setInputText}
            onSend={handleSend}
            sending={isSending}
          />
        </div>
      </div>

      {showDisclaimer && (
        <DisclaimerModal onClose={() => setShowDisclaimer(false)} onConfirm={handleAcknowledge} />
      )}
    </div>
  );
}

/** Sends a signed-out visitor to the sign-in card, remembering where they were headed. */
function RequireAuth({ authed, children }) {
  const location = useLocation();
  if (!authed) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return children;
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

  const handleSignOut = useCallback(() => {
    cognito.signOut();
    PERSONAL_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(STORAGE_KEYS.chatScrollPosition);
    setIsAuthenticated(false);
  }, []);

  const handleAuthenticated = useCallback(() => setIsAuthenticated(true), []);

  // Automatic logoff. A tab left open on a shared device should not go on
  // showing someone's journal; the sign-in card explains what happened.
  const handleIdle = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.idleSignedOut, "1");
    } catch {
      /* the sign-out still happens */
    }
    handleSignOut();
  }, [handleSignOut]);
  useIdleSignOut(isAuthenticated === true, handleIdle);

  if (isAuthenticated === null) {
    return <div className="app-booting" aria-busy="true" />;
  }

  return (
    <Router>
      <Routes>
        {/* The front page is who we are, signed in or not. */}
        <Route
          path="/"
          element={<AboutPage signedIn={isAuthenticated} onSignOut={handleSignOut} />}
        />
        <Route
          path="/news"
          element={<NewsListPage signedIn={isAuthenticated} onSignOut={handleSignOut} />}
        />
        <Route
          path="/news/:slug"
          element={<NewsArticlePage signedIn={isAuthenticated} onSignOut={handleSignOut} />}
        />
        <Route
          path="/legal"
          element={<LegalPage signedIn={isAuthenticated} onSignOut={handleSignOut} />}
        />
        <Route path="/privacy" element={<Navigate to="/legal#privacy" replace />} />
        <Route path="/terms" element={<Navigate to="/legal#terms" replace />} />
        <Route path="/about" element={<Navigate to="/" replace />} />
        <Route path="/mission" element={<Navigate to="/" replace />} />

        <Route
          path="/signin"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage onAuthenticated={handleAuthenticated} />
            )
          }
        />

        <Route
          path="/chat"
          element={
            <RequireAuth authed={isAuthenticated}>
              <ChatPage onSignOut={handleSignOut} />
            </RequireAuth>
          }
        />
        <Route
          path="/journal"
          element={
            <RequireAuth authed={isAuthenticated}>
              <JournalPage onSignOut={handleSignOut} />
            </RequireAuth>
          }
        />
        <Route
          path="/journal/archive"
          element={
            <RequireAuth authed={isAuthenticated}>
              <JournalArchivePage onSignOut={handleSignOut} />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
