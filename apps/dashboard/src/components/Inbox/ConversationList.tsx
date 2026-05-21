import React from 'react';
import { useChatStore } from '@/store/useChatStore';

const ConversationList = () => {
  const { conversations, activeConversationId, setActiveConversation } = useChatStore();

  return (
    <div className="conversation-list">
      {conversations.length === 0 ? (
        <div className="no-convs">No conversations found</div>
      ) : (
        conversations.map((conv) => (
          <div 
            key={conv.id} 
            className={`conv-item ${activeConversationId === conv.id ? 'active' : ''}`}
            onClick={() => setActiveConversation(conv.id)}
          >
            <div className="conv-avatar">
              {conv.contact.name?.[0] || 'C'}
            </div>
            <div className="conv-details">
              <div className="conv-header">
                <span className="conv-name">{conv.contact.name || conv.contact.phoneNumber}</span>
                <span className="conv-time">{new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="conv-preview">
                {conv.status === 'OPEN' && <span className="status-badge open">Open</span>}
                {conv.status === 'ASSIGNED' && <span className="status-badge assigned">Assigned</span>}
                <span>Loading preview...</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ConversationList;
