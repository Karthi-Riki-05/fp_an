import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { Equipment } from './types';

export interface CreateEquipmentInput {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateEquipmentInput extends Partial<CreateEquipmentInput> {}

const EQUIPMENT_KEY = (tenantId: number | null) => ['equipment', tenantId] as const;

function tenantHeaders(tenantId: number | null) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

export function useEquipmentList(tenantId: number | null) {
  return useQuery({
    queryKey: EQUIPMENT_KEY(tenantId),
    queryFn: async () => {
      const { data } = await apiClient.get<Equipment[]>('/equipment', {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    enabled: tenantId !== undefined, // null is allowed (admin without override)
  });
}

export function useCreateEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const { data } = await apiClient.post<Equipment>('/equipment', input, {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) }),
  });
}

export function useDeleteEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/equipment/${id}`, {
        headers: tenantHeaders(tenantId),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) }),
  });
}
