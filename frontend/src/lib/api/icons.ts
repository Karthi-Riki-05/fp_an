import { useQuery } from '@tanstack/react-query';
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

/** Listing of icon files under frontend/public/equipment-icons/. Static — cached. */
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
