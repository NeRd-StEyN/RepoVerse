// components/ChatInterface/ChatInterface.jsx
import React, { useState } from 'react';
import './ChatInterface.css';

const ChatInterface = ({ reportContent }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! Ask me anything about this report. For example: 'Summarize the key findings.'",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !reportContent) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        text: `I've analyzed your question about the report. Based on the content, I can provide insights and summaries. (This is a simulated response - in a real app, this would connect to an AI service.)`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const exampleQuestions = [
    "Summarize the key findings",
    "What are the main points?",
    "Explain the methodology",
    "What data supports this?"
  ];

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>Chat with this Report</h3>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.isUser ? 'user-message' : 'ai-message'}`}
          >
            <div className="message-content">
              <p>{message.text}</p>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message ai-message">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {reportContent && (
        <div className="example-questions">
          <p>Try asking:</p>
          <div className="question-tags">
            {exampleQuestions.map((question, index) => (
              <span
                key={index}
                className="question-tag"
                onClick={() => setInputMessage(question)}
              >
                {question}
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask a question about the report..."
          className="chat-input"
          disabled={!reportContent || isLoading}
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={!inputMessage.trim() || !reportContent || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;