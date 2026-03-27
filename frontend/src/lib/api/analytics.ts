import { api } from './client'

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getMetrics: (period?: string) =>
    api.get('/analytics/metrics', { params: { period } }),
  getPerformance: () => api.get('/analytics/performance'),
  getReports: () => api.get('/analytics/reports'),
  exportData: (type: string) => api.get(`/analytics/export/${type}`),
}
