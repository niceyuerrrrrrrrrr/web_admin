import client from '../client'
import type {
  ApiResponse,
  ReportApprovalHistoryEntry,
  ReportCommentRecord,
  ReportDetail,
  ReportListResponse,
  ReportRecord,
  ReportStats,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface ReportListParams {
  user_id?: number
  status?: string
  page?: number
  page_size?: number
  begin_date?: string
  end_date?: string
  keyword?: string
  company_id?: number
}

export interface ReportPayload {
  type: string
  title: string
  description?: string
  location?: string
  priority?: string
  images?: string[]
}

export interface ReportUpdatePayload extends Partial<ReportPayload> {}

export const fetchReports = (params: ReportListParams) =>
  unwrap<ReportListResponse>(
    client.get('/report', {
      params: {
        user_id: params.user_id,
        status: params.status,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
        begin_date: params.begin_date,
        end_date: params.end_date,
        keyword: params.keyword,
        company_id: params.company_id,
      },
    }),
  )

export const fetchReportDetail = (reportId: number) => unwrap<ReportDetail>(client.get(`/report/${reportId}`))

export const createReport = (payload: ReportPayload) => unwrap<ReportRecord>(client.post('/report', payload))

export const updateReport = (reportId: number, payload: ReportUpdatePayload) =>
  unwrap(client.put(`/report/${reportId}`, payload))

export const deleteReport = (reportId: number) => unwrap(client.delete(`/report/${reportId}`))

export const submitReport = (reportId: number) => unwrap(client.post(`/report/${reportId}/submit`, {}))

export const approveReport = (reportId: number, action: 'approve' | 'reject', comment?: string) =>
  unwrap(client.post(`/report/${reportId}/approve`, { action, comment }))

export const resolveReport = (reportId: number) => unwrap(client.post(`/report/${reportId}/resolve`, {}))

export const closeReport = (reportId: number) => unwrap(client.post(`/report/${reportId}/close`, {}))

export const revokeReport = (reportId: number) => unwrap(client.post(`/report/${reportId}/revoke`, {}))

export const fetchReportHistory = (reportId: number) =>
  unwrap<{ records: ReportApprovalHistoryEntry[] }>(client.get(`/report/${reportId}/history`))

export const fetchReportComments = (reportId: number) =>
  unwrap<{ comments: ReportCommentRecord[] }>(client.get(`/report/${reportId}/comments`))

export const addReportComment = (reportId: number, payload: { content?: string; images?: string[] }) =>
  unwrap(client.post(`/report/${reportId}/comments`, payload))

export const uploadReportImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/report/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export const fetchReportStats = (params?: { begin_date?: string; end_date?: string; company_id?: number }) =>
  unwrap<ReportStats>(
    client.get('/report/stats/overview', {
      params: {
        begin_date: params?.begin_date,
        end_date: params?.end_date,
        company_id: params?.company_id,
      },
    }),
  )

