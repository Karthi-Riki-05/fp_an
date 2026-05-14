import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface IconAsset {
  name: string;
  filename: string;
  url: string;
}

interface IconListResponse {
  icons: IconAsset[];
  total: number;
}

/** Listing of icon files under frontend/public/equipment-icons/. Cached. */
export function useIcons() {
  return useQuery({
    queryKey: ['admin-icons'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<IconListResponse>('/admin/icons');
      return data.icons;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateIcons() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['admin-icons'] });
}

/**
 * Upload one icon file. Backend saves it under public/equipment-icons/ and
 * returns the persisted filename.
 */
export async function uploadIcon(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('icon', file);
  const { data } = await apiClient.post<{ filename: string }>(
    '/admin/icons/upload',
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.filename;
}
