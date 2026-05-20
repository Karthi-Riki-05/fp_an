import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { GlobalUserListResponse } from './types';

/**
 * Replacement for the old `useTenantsList`. After the Tenant model removal
 * (see backend MIGRATION_NOTES §13) a "tenant" *is* a Company user row, so
 * this hook fetches Company users via the superadmin endpoint and projects
 * them to the minimal `{ id, name }` shape used by selectors.
 */
export interface CompanyPickerEntry {
  id: number;
  name: string;
}

export function useCompaniesForPicker(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin', 'companies-picker'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<GlobalUserListResponse>('/superadmin/users', {
        params: { roles: 'Company', perPage: 500, active: 'true' },
      });
      return data.data.map<CompanyPickerEntry>((u) => ({ id: u.id, name: u.name }));
    },
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
  });
}
