import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import "./ChatInterface.css";
import ReactMarkdown from "react-markdown";
const ChatInterface = ({ pdfUrl, topic }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => scrollToBottom(), [messages]);


  useEffect(() => {
    if (pdfUrl) {

      setMessages([]);
      setInputMessage("");
      setIsLoading(false);
      setSessionId(null);

      const newSessionId = topic || uuidv4();
      setSessionId(newSessionId);


      setMessages([
        { type: "system", content: "🕐 Initializing new report chat..." },
      ]);

      initializeChat(newSessionId);
    }
  }, [pdfUrl]);




  const getTextDirection = (text = "") => {

    const rtlPattern = /[\u0590-\u08FF]/;
    return rtlPattern.test(text) ? "rtl" : "ltr";
  };




  const initializeChat = async (sessionId) => {
    try {
      const base64Data = pdfUrl.startsWith("data:")
        ? pdfUrl.split(",")[1]
        : pdfUrl;

      const response = await fetch("/chat/init", {
        method: "POST",

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          pdf_base64: base64Data,
        }),
      });

      if (!response.ok) throw new Error("Failed to initialize chat");


      setMessages([
        {
          type: "system",
          content: `✅ Chat initialized for report "${topic || "New Report"}". You can now ask questions.`,
        },
      ]);
    } catch (error) {
      console.error("Error initializing chat:", error);
      setMessages([
        {
          type: "error",
          content: "❌ Failed to initialize chat. Please try again.",
        },
      ]);

      setTimeout(() => setMessages([]), 3000);
    }
  };




  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !sessionId) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);


    setMessages((prev) => [...prev, { type: "user", content: userMessage }]);

    try {
      const response = await fetch("/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          content: data.response || "⚠️ No response from AI.",
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          content: "❌ Failed to get AI response. Please try again.",
        },
      ]);

      setTimeout(() => {
        setMessages((prev) => prev.filter((msg) => msg.type !== "error"));
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map((message, index) => {
          const dir = getTextDirection(message.content);
          return (
            <div key={index} className={`message ${message.type}`}>
              <div className="message-content" dir={dir}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="message system">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask a question about this report..."
          disabled={isLoading || !sessionId}
        />
        <button type="submit" disabled={isLoading || !inputMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface

