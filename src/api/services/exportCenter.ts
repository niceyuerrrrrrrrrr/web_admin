import client from '../client'
import type { ApiResponse, ExportJobRecord, ExportTemplateRecord, ReportModule } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchExportModules = () => unwrap<{ modules: ReportModule[] }>(client.get('/export-center/modules'))

export const fetchExportTemplates = () =>
  unwrap<{ records: ExportTemplateRecord[] }>(client.get('/export-center/templates'))

export const createExportTemplate = (payload: Partial<ExportTemplateRecord>) =>
  unwrap(client.post('/export-center/templates', payload))

export const deleteExportTemplate = (id: number) => unwrap(client.delete(`/export-center/templates/${id}`))

export const fetchExportJobs = () => unwrap<{ records: ExportJobRecord[] }>(client.get('/export-center/jobs'))

export const createExportJob = (payload: { module: string; params?: Record<string, any> }) =>
  unwrap(client.post('/export-center/export', payload))

export const downloadExportJob = (id: number) =>
  client.get(`/export-center/jobs/${id}/download`, { responseType: 'blob' })

