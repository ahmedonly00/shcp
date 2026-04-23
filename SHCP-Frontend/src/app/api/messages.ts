import { apiClient, unwrap } from './client';

export interface ApiConversation {
  conversationId: string;
  participantId: string;
  participantName: string;
  participantRole: 'patient' | 'provider';
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  starred: boolean;
}

export interface ApiMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export const messagesApi = {
  listConversations: () =>
    apiClient.get('/messages/conversations').then(unwrap<ApiConversation[]>),

  startConversation: (otherUserId: string) =>
    apiClient.post('/messages/conversations', { otherUserId }).then(unwrap<ApiConversation>),

  getMessages: (convId: string) =>
    apiClient.get(`/messages/conversations/${convId}/messages`).then(unwrap<ApiMessage[]>),

  sendMessage: (convId: string, body: string) =>
    apiClient
      .post(`/messages/conversations/${convId}/messages`, { body })
      .then(unwrap<ApiMessage>),

  markAsRead: (convId: string) =>
    apiClient.patch(`/messages/conversations/${convId}/read`).then(unwrap<void>),

  toggleStar: (convId: string) =>
    apiClient.patch(`/messages/conversations/${convId}/star`).then(unwrap<ApiConversation>),
};
