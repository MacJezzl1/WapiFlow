import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  createdAt: string;
  contactId: string;
}

interface Conversation {
  id: string;
  contact: {
    phoneNumber: string;
    name: string;
  };
  lastMessageAt: string;
  status: string;
  messageCount: number;
}

interface ChatState {
  socket: Socket | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  connect: (token: string) => void;
  disconnect: () => void;
  setConversations: (conversations: Conversation[]) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  setActiveConversation: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  conversations: [],
  activeConversationId: null,
  messages: {},
  connect: (token) => {
    const socket = io(import.meta.env.VITE_API_URL.replace('/api', ''), {
      auth: { token },
    });

    socket.on('new_message', (data) => {
      const { message, conversationId } = data;
      get().addMessage(conversationId, message);
      // Also update conversations list to move this one to the top
      // This would normally involve a refresh call to the API
    });

    socket.on('conversation_updated', (data) => {
      console.log('Conversation updated:', data);
      // Handle conversation list updates
    });

    set({ socket });
  },
  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },
  setConversations: (conversations) => set({ conversations }),
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),
  addMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
}));
