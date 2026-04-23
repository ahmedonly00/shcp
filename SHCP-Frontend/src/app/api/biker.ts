import { apiClient, unwrap } from './client';
import type { BikerDto, DeliveryDto } from './pharmacist';

export type { BikerDto, DeliveryDto };

export const getMyBikerProfile = () =>
  apiClient.get<{ data: BikerDto }>('/biker/me').then(unwrap);

export const updateBikerStatus = (status: 'AVAILABLE' | 'OFFLINE') =>
  apiClient.patch<{ data: BikerDto }>(`/biker/me/status?status=${status}`).then(unwrap);

export const getMyOrders = () =>
  apiClient.get<{ data: DeliveryDto[] }>('/biker/orders').then(unwrap);

export const getOrderById = (deliveryId: string) =>
  apiClient.get<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}`).then(unwrap);

export const acceptOrder = (deliveryId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}/accept`).then(unwrap);

export const declineOrder = (deliveryId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}/decline`).then(unwrap);

export const markPickedUp = (deliveryId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}/picked-up`).then(unwrap);

export const markOnTheWay = (deliveryId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}/on-the-way`).then(unwrap);

export const markDelivered = (deliveryId: string, photo?: File) => {
  const form = new FormData();
  if (photo) form.append('photo', photo);
  return apiClient.post<{ data: DeliveryDto }>(
    `/biker/orders/${deliveryId}/delivered`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ).then(unwrap);
};

export const markFailed = (deliveryId: string, failureReason: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/biker/orders/${deliveryId}/failed`, { failureReason }).then(unwrap);

export const updateLocation = (deliveryId: string, latitude: number, longitude: number) =>
  apiClient.patch(`/biker/orders/${deliveryId}/location`, { latitude, longitude });
