import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Test Response", sender: "assistant" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const handleSend = () => {
    if (inputText.trim()) {
      if (!isLoggedIn) {
        setShowLoginModal(true);
        return;
      }
      
      setIsSending(true);
      setIsTyping(true);
      const newMessage = {
        id: Date.now(),
        text: inputText,
        sender: "user",
      };
      setMessages([...messages, newMessage]);
      setInputText("");

      // Simulate assistant response after 3 seconds
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Test Response",
            sender: "assistant",
          },
        ]);
        setIsSending(false);
      }, 3000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen h-full w-full paper-texture"
    >
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 p-2" style={{ backgroundColor: "#6B4423" }}>
        <div className="flex justify-end items-center" style={{ paddingRight: "16px" }}>
          <button 
            onClick={isLoggedIn ? handleLogout : handleLogin} 
            className="logout-button"
          >
            {isLoggedIn ? "Log Out" : "Log In"}
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24" style={{ marginTop: "60px" }}>
        <div className="max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} mb-3`}
              style={{
                animation: "bubbleUp 0.3s ease-out",
                animationFillMode: "both",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  maxWidth: "min(70%, 400px)",
                  padding: "10px 16px",
                  backgroundColor:
                    message.sender === "user" ? "#6B4423" : "#F5E6D3",
                  color: message.sender === "user" ? "white" : "#5D4E37",
                  borderRadius: message.sender === "user" 
                    ? "16px 16px 4px 16px" 
                    : "16px 16px 16px 4px",
                  border: message.sender === "user" ? "none" : "none",
                  fontWeight: message.id === 1 ? "500" : "normal",
                  fontSize: "14px",
                }}
              >
                <p className="break-words" style={{ margin: 0, fontSize: "14px" }}>{message.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start mb-3">
              <div
                style={{
                  display: "flex",
                  padding: "5px 11px",
                  backgroundColor: "#F5E6D3",
                  borderRadius: "16px 16px 16px 4px",
                  minWidth: "56px",
                  minHeight: "22px",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <div className="flex gap-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "#9CA3AF",
                      animation: "bounce 1.4s infinite",
                    }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "#9CA3AF",
                      animation: "bounce 1.4s infinite",
                      animationDelay: "0.2s",
                    }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "#9CA3AF",
                      animation: "bounce 1.4s infinite",
                      animationDelay: "0.4s",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Container */}
      <div
        className="fixed left-0 right-0"
        style={{ 
          bottom: "0px", 
          zIndex: 40,
          padding: "16px 16px 8px 16px"
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-center gap-2 shadow-lg"
            style={{
              backgroundColor: "#FFF8E7",
              border: "1px solid rgba(139, 107, 71, 0.2)",
              borderRadius: "30px",
              padding: "7.2px"
            }}
          >
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent focus:outline-none text-base"
              style={{
                color: "#5D4E37",
                minWidth: "0",
                border: "none",
                outline: "none",
                resize: "none",
                minHeight: "20px",
                maxHeight: "60px",
                overflowY: "auto",
                lineHeight: "20px",
                fontFamily: "inherit",
                paddingTop: "18px",
                paddingBottom: "8px",
                paddingLeft: "14.4px",
                paddingRight: "14.4px"
              }}
            />
            <button
              onClick={handleSend}
              className="relative hover:scale-105 transition-transform flex-shrink-0"
              style={{
                backgroundColor: "transparent",
                border: "none",
                width: "52px",
                height: "52px",
                padding: "6px",
                marginTop: "2px",
                marginRight: "0px",
              }}
            >
              <div className="relative w-full h-full">
                <div
                  className="absolute transition-all duration-300 ease-out"
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: "#6B4423",
                    opacity: 0.05,
                    transform: "translate(0, 7px)",
                    clipPath:
                      "polygon(3px 0%, 100% 0%, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0% 100%, 0% 3px)",
                    borderRadius: "8px 8px 8px 0px",
                    zIndex: 1,
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: "#6B4423",
                    opacity: 0.5,
                    transform: isSending
                      ? "translate(0, 7px)"
                      : "translate(3.5px, 3.5px)",
                    clipPath:
                      "polygon(3px 0%, 100% 0%, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0% 100%, 0% 3px)",
                    borderRadius: "8px 8px 8px 0px",
                    zIndex: 2,
                    transition: "transform 200ms ease-out",
                  }}
                />
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: "#6B4423",
                    opacity: 1,
                    transform: isSending
                      ? "translate(0, 7px)"
                      : "translate(7px, 0)",
                    clipPath:
                      "polygon(3px 0%, 100% 0%, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0% 100%, 0% 3px)",
                    borderRadius: "8px 8px 8px 0px",
                    zIndex: 3,
                    transition: "transform 200ms ease-out",
                  }}
                >
                  <Send size={16} color="white" strokeWidth={2} style={{ transform: "translate(6px, 1px)" }} />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ 
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(8px)"
          }}
          onClick={() => setShowLoginModal(false)}
        >
          <div 
            className="p-12"
            style={{ 
              backgroundColor: "#6B4423",
              borderRadius: "24px",
              width: "400px",
              textAlign: "center",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 
              className="text-2xl font-semibold mb-8"
              style={{ color: "#FFF8E7" }}
            >
              Welcome to Chatbot
            </h2>
            <button 
              onClick={handleLogin}
              className="py-4 px-8 font-medium transition-all duration-200"
              style={{ 
                backgroundColor: "#FFF8E7",
                color: "#6B4423",
                fontSize: "16px",
                border: "none",
                cursor: "pointer",
                borderRadius: "16px",
                width: "200px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#F5E6D3";
                e.target.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#FFF8E7";
                e.target.style.transform = "scale(1)";
              }}
            >
              Log In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;