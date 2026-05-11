import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface CmsImage {
  id: number;
  cmsId: number;
  path: string;
  alt: string | null;
  createdAt: string;
}

export interface CmsRow {
  id: number;
  slug: string;
  title: string;
  content: string | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  images?: CmsImage[];
}

export interface CmsListResponse {
  data: CmsRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface CreateCmsInput {
  slug: string;
  title: string;
  content?: string;
  status?: boolean;
}

export type UpdateCmsInput = Partial<Omit<CreateCmsInput, 'slug'>>;

const KEYS = {
  list: (page: number, perPage: number) => ['admin', 'cms', { page, perPage }] as const,
  detail: (id: number) => ['admin', 'cms', 'detail', id] as const,
  any: ['admin', 'cms'] as const,
};

export function useCmsList(opts: { page?: number; perPage?: number } = {}) {
  const { page = 1, perPage = 50 } = opts;
  return useQuery({
    queryKey: KEYS.list(page, perPage),
    queryFn: async () =>
      (await apiClient.get<CmsListResponse>('/admin/cms', { params: { page, perPage } })).data,
    placeholderData: (prev) => prev,
  });
}

export function useCmsDetail(id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['admin', 'cms', 'detail', 'idle'],
    queryFn: async () => (await apiClient.get<CmsRow>(`/admin/cms/${id}`)).data,
    enabled: id !== null,
  });
}

export function useCreateCms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCmsInput) =>
      (await apiClient.post<CmsRow>('/admin/cms', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUpdateCms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateCmsInput }) =>
      (await apiClient.patch<CmsRow>(`/admin/cms/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteCms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/cms/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUploadCmsImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cmsId, file, alt }: { cmsId: number; file: File; alt?: string }) => {
      const fd = new FormData();
      fd.append('image', file);
      if (alt) fd.append('alt', alt);
      const { data } = await apiClient.post<CmsImage>(`/admin/cms/${cmsId}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteCmsImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cmsId, imageId }: { cmsId: number; imageId: number }) => {
      await apiClient.delete(`/admin/cms/${cmsId}/images/${imageId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}
