import React, { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';

const InboxContainer = () => {
  const { conversations, activeConversationId, setConversations } = useChatStore();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/conversations?limit=20`);
        const data = await response.json();
        setConversations(data.conversations);
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      }
    };

    fetchConversations();
  }, [setConversations]);

  return (
    <div className="inbox-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Messages</h2>
        </div>
        <ConversationList />
      </aside>
      <main className="chat-area">
        {activeConversationId ? (
          <ChatWindow />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <h3>No conversation selected</h3>
            <p>Select a chat from the list to start messaging.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxContainer;
