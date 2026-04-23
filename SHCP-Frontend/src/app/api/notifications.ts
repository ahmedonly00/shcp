import { apiClient, unwrap } from './client';

export interface ApiNotification {
  notificationId: string;
  userId: string;
  type: 'appointment' | 'prescription' | 'message' | 'alert' | 'reminder';
  title: string;
  message: string;
  date: string;
  read: boolean;
  channel: string;
}

export const notificationsApi = {
  getMyNotifications: () =>
    apiClient.get('/notifications/me').then(unwrap<ApiNotification[]>),

  markAsRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then(unwrap<ApiNotification>),

  markAllAsRead: () =>
    apiClient.patch('/notifications/me/read-all').then(unwrap<void>),

  registerDeviceToken: (deviceToken: string) =>
    apiClient.put('/users/device-token', { deviceToken }).then(unwrap<void>),

  removeDeviceToken: () =>
    apiClient.delete('/users/device-token').then(unwrap<void>),
};
