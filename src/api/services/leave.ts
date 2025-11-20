import client from '../client'
import type {
  ApiResponse,
  LeaveApprovalHistoryEntry,
  LeaveCommentRecord,
  LeaveDetail,
  LeaveListResponse,
  LeaveRecord,
  LeaveStats,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface LeaveListParams {
  user_id?: number
  status?: string
  page?: number
  page_size?: number
  begin_date?: string
  end_date?: string
  keyword?: string
  companyId?: number
}

export interface LeavePayload {
  user_id: number
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason?: string
  images?: string[]
}

export interface LeaveUpdatePayload {
  leave_type?: string
  start_date?: string
  end_date?: string
  days?: number
  reason?: string
  images?: string[]
}

export const fetchLeaves = (params: LeaveListParams) =>
  unwrap<LeaveListResponse>(
    client.get('/leave', {
      params: {
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
        user_id: params.user_id,
        status: params.status,
        begin_date: params.begin_date,
        end_date: params.end_date,
        keyword: params.keyword,
        company_id: params.companyId,
      },
    }),
  )

export const fetchLeaveDetail = (leaveId: number) => unwrap<LeaveDetail>(client.get(`/leave/${leaveId}`))

export const createLeave = (payload: LeavePayload) => unwrap<LeaveRecord>(client.post('/leave', payload))

export const updateLeave = (leaveId: number, payload: LeaveUpdatePayload) =>
  unwrap(client.put(`/leave/${leaveId}`, payload))

export const deleteLeave = (leaveId: number) => unwrap(client.delete(`/leave/${leaveId}`))

export const submitLeave = (leaveId: number) => unwrap(client.post(`/leave/${leaveId}/submit`, {}))

export const approveLeave = (leaveId: number, action: 'approve' | 'reject', comment?: string) =>
  unwrap(client.post(`/leave/${leaveId}/approve`, { action, comment }))

export const revokeLeave = (leaveId: number) => unwrap(client.post(`/leave/${leaveId}/revoke`, {}))

export const fetchLeaveHistory = (leaveId: number) =>
  unwrap<{ records: LeaveApprovalHistoryEntry[] }>(client.get(`/leave/${leaveId}/history`))

export const fetchLeaveComments = (leaveId: number) =>
  unwrap<{ comments: LeaveCommentRecord[] }>(client.get(`/leave/${leaveId}/comments`))

export const addLeaveComment = (leaveId: number, payload: { content?: string; images?: string[] }) =>
  unwrap(client.post(`/leave/${leaveId}/comments`, payload))

export const uploadLeaveImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/leave/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export const fetchLeaveStats = (params?: { begin_date?: string; end_date?: string }) =>
  unwrap<LeaveStats>(
    client.get('/leave/stats/overview', {
      params: {
        begin_date: params?.begin_date,
        end_date: params?.end_date,
      },
    }),
  )

