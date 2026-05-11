import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface TestimonialRow {
  id: number;
  name: string;
  companyName: string;
  title: string | null;
  role: string | null;
  body: string;
  image: string | null;
  status: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialListResponse {
  data: TestimonialRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface TestimonialMeta {
  name: string;
  companyName: string;
  title?: string;
  role?: string;
  body: string;
  status?: boolean;
  sortOrder?: number;
}

const KEYS = {
  list: (page: number, perPage: number) => ['admin', 'testimonials', { page, perPage }] as const,
  any: ['admin', 'testimonials'] as const,
};

export function useTestimonials(opts: { page?: number; perPage?: number } = {}) {
  const { page = 1, perPage = 50 } = opts;
  return useQuery({
    queryKey: KEYS.list(page, perPage),
    queryFn: async () => (
      await apiClient.get<TestimonialListResponse>('/admin/testimonials', { params: { page, perPage } })
    ).data,
    placeholderData: (prev) => prev,
  });
}

export function useCreateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meta, file }: { meta: TestimonialMeta; file?: File }) => {
      const fd = new FormData();
      Object.entries(meta).forEach(([k, v]) => {
        if (v !== undefined) fd.append(k, String(v));
      });
      if (file) fd.append('image', file);
      const { data } = await apiClient.post<TestimonialRow>('/admin/testimonials', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUpdateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meta }: { id: number; meta: Partial<TestimonialMeta> }) =>
      (await apiClient.patch<TestimonialRow>(`/admin/testimonials/${id}`, meta)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useReplaceTestimonialImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await apiClient.post<TestimonialRow>(`/admin/testimonials/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/testimonials/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}
