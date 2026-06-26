import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface UserOrder {
  id: number;
  orderNr: string;
  description: string;
  partName: string | null;
  partNo: string | null;
  equipmentName: string | null;
  plannedQty: number;
  okQty: number;
  scrapQty: number;
  startDate: string | null;
  endDate: string | null;
  status: number;
}

/** Active production orders for the operator's tenant (Sprint 3 / Task 5). */
export function useUserOrders(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  return useQuery({
    queryKey: ['user', 'orders'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ orders: UserOrder[] }>('/user/orders');
      return data.orders;
    },
    enabled,
    staleTime: 30_000,
  });
}
