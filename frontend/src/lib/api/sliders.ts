import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface SliderRow {
  id: number;
  title: string | null;
  description: string | null;
  image: string;
  link: string | null;
  status: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SliderListResponse {
  data: SliderRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface SliderMeta {
  title?: string;
  description?: string;
  link?: string;
  status?: boolean;
  sortOrder?: number;
}

const KEYS = {
  list: (page: number, perPage: number) => ['admin', 'sliders', { page, perPage }] as const,
  any: ['admin', 'sliders'] as const,
};

export function useSliders(opts: { page?: number; perPage?: number } = {}) {
  const { page = 1, perPage = 50 } = opts;
  return useQuery({
    queryKey: KEYS.list(page, perPage),
    queryFn: async () => (
      await apiClient.get<SliderListResponse>('/admin/sliders', { params: { page, perPage } })
    ).data,
    placeholderData: (prev) => prev,
  });
}

function buildSliderForm(meta: SliderMeta, file?: File) {
  const fd = new FormData();
  if (meta.title !== undefined) fd.append('title', meta.title);
  if (meta.description !== undefined) fd.append('description', meta.description);
  if (meta.link !== undefined) fd.append('link', meta.link);
  if (meta.status !== undefined) fd.append('status', String(meta.status));
  if (meta.sortOrder !== undefined) fd.append('sortOrder', String(meta.sortOrder));
  if (file) fd.append('image', file);
  return fd;
}

export function useCreateSlider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meta, file }: { meta: SliderMeta; file: File }) => {
      const fd = buildSliderForm(meta, file);
      const { data } = await apiClient.post<SliderRow>('/admin/sliders', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUpdateSlider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meta }: { id: number; meta: SliderMeta }) =>
      (await apiClient.patch<SliderRow>(`/admin/sliders/${id}`, meta)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useReplaceSliderImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await apiClient.post<SliderRow>(`/admin/sliders/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteSlider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/sliders/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}
