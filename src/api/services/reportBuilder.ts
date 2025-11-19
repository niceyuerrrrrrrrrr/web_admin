import client from '../client'
import type {
  ApiResponse,
  CustomReportRecord,
  ReportHistoryRecord,
  ReportModule,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchReportModules = () => unwrap<{ modules: ReportModule[] }>(client.get('/report-builder/modules'))

export const fetchReports = () => unwrap<{ records: CustomReportRecord[] }>(client.get('/report-builder'))

export const createReport = (payload: Partial<CustomReportRecord>) => unwrap(client.post('/report-builder', payload))

export const updateReport = (id: number, payload: Partial<CustomReportRecord>) =>
  unwrap(client.put(`/report-builder/${id}`, payload))

export const deleteReport = (id: number) => unwrap(client.delete(`/report-builder/${id}`))

export const runReport = (id: number) => unwrap<{ rows: Record<string, any>[] }>(client.post(`/report-builder/${id}/run`))

export const exportReport = (id: number) => client.post(`/report-builder/${id}/export`, {}, { responseType: 'blob' })

export const fetchReportHistory = (id: number) =>
  unwrap<{ records: ReportHistoryRecord[] }>(client.get(`/report-builder/${id}/history`))

