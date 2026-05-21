import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import axios from 'axios';

const ChatWindow = () => {
  const { activeConversationId, messages, setMessages, addMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeConversationId) return;

    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/conversations/${activeConversationId}`);
        setMessages(activeConversationId, response.data.messages);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchMessages();
  }, [activeConversationId, setMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;

    const content = input;
    setInput('');
    setIsLoading(true);

    try {
      // We would normally fetch the contactId from the conversation data
      const convResponse = await axios.get(`${import.meta.env.VITE_API_URL}/conversations/${activeConversationId}`);
      const contactId = convResponse.data.conversation.contactId;

      const response = await axios.post(`${import.meta.env.VITE_API_URL}/messages`, {
        contactId,
        content,
      });

      addMessage(activeConversationId, response.data);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = messages[activeConversationId!] || [];

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>Chatting with Contact</h3>
        <div className="chat-actions">
          <button className="btn-secondary">Archive</button>
          <button className="btn-primary">Resolve</button>
        </div>
      </div>
      
      <div className="message-list">
        {currentMessages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.direction === 'OUTBOUND' ? 'out' : 'in'}`}>
            <div className="message-content">{msg.content}</div>
            <div className="message-meta">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {msg.direction === 'OUTBOUND' && <span> • {msg.status}</span>}
            </div>
          </div>
        ))}
      </div>

      <form className="message-input" onSubmit={handleSend}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
