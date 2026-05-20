import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type {
  PagedResponse, BaseListParams,
  ProductionRow, ScrapRow, StopRow,
  UpdateProductionInput, UpdateScrapInput, UpdateStopInput,
} from './admin-results';

/**
 * User-scoped result hooks. Same row + input shapes as the admin hooks; they
 * hit /api/v1/myresult/{production,scrap,stop} which filters to rows the
 * authenticated user created and enforces ownership on PATCH (403 otherwise).
 *
 * Tenant scope is derived server-side from the JWT — no X-Tenant-Id header.
 */

export function useMyProductionList(params: BaseListParams) {
  return useQuery({
    queryKey: ['my', 'results', 'production', params] as const,
    queryFn: async () =>
      (await apiClient.get<PagedResponse<ProductionRow>>('/myresult/production', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateMyProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateProductionInput }) =>
      (await apiClient.patch<ProductionRow>(`/myresult/production/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my', 'results', 'production'] }),
  });
}

export function useMyScrapList(params: BaseListParams) {
  return useQuery({
    queryKey: ['my', 'results', 'scrap', params] as const,
    queryFn: async () =>
      (await apiClient.get<PagedResponse<ScrapRow>>('/myresult/scrap', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateMyScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateScrapInput }) =>
      (await apiClient.patch<ScrapRow>(`/myresult/scrap/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my', 'results', 'scrap'] }),
  });
}

export interface MyStopListParams extends BaseListParams {
  include_excluded?: '0' | '1';
}

export function useMyStopList(params: MyStopListParams) {
  return useQuery({
    queryKey: ['my', 'results', 'stop', params] as const,
    queryFn: async () =>
      (await apiClient.get<PagedResponse<StopRow>>('/myresult/stop', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateMyStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateStopInput }) =>
      (await apiClient.patch<StopRow>(`/myresult/stop/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my', 'results', 'stop'] }),
  });
}
