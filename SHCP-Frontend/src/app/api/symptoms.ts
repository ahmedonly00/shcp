import { apiClient, unwrap } from './client';
import { ApiSymptomReport } from '@/app/types';

export interface SymptomInput {
  symptomText: string;
  language?: string;
  symptoms?: string[];
  severity?: string;
  duration?: string;
  bodyMapData?: Record<string, boolean>;
}

export const symptomsApi = {
  analyze: (data: SymptomInput) =>
    apiClient.post<ApiSymptomReport>('/symptoms/analyze', data).then(unwrap<ApiSymptomReport>),

  getReport: (reportId: string) =>
    apiClient.get<ApiSymptomReport>(`/symptoms/reports/${reportId}`).then(unwrap<ApiSymptomReport>),
};
