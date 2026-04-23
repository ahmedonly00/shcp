import { apiClient, unwrap } from './client';
import type { DeliveryDto } from './pharmacist';

export type { DeliveryDto };

/** Returns the patient's current active delivery (ASSIGNED → ON_THE_WAY), or null. */
export const getActiveDelivery = () =>
  apiClient.get<{ data: DeliveryDto | null }>('/deliveries/tracking/active').then(unwrap);

/** Returns full tracking detail for a specific delivery (patient owner / pharmacist / admin). */
export const getDeliveryTracking = (deliveryId: string) =>
  apiClient.get<{ data: DeliveryDto }>(`/deliveries/${deliveryId}/tracking`).then(unwrap);
