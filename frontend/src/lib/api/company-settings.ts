import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface CompanySettings {
  company: { name: string; industry: string; country: string; timezone: string; logoUrl: string };
  oee: { targetOee: number; plannedTimeMethod: string; workingDays: number[] };
  notifications: { stopAlertThresholdMin: number; emailAlerts: boolean; alertEmail: string };
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['admin', 'company-settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<CompanySettings>('/admin/company-settings');
      return data;
    },
    staleTime: 30_000,
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<CompanySettings>) => {
      const { data } = await apiClient.patch<CompanySettings>('/admin/company-settings', patch);
      return data;
    },
    onSuccess: (data) => qc.setQueryData(['admin', 'company-settings'], data),
  });
}
