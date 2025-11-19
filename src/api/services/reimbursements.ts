import client from '../client'
import type {
  ApiResponse,
  ReimbursementApprovalNode,
  ReimbursementComment,
  ReimbursementDetail,
  ReimbursementListResponse,
  ReimbursementRecord,
  ReimbursementStats,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface ReimbursementListParams {
  userId?: number
  status?: string
  page?: number
  pageSize?: number
  beginDate?: string
  endDate?: string
  keyword?: string
}

export const REIMBURSEMENT_STATUS_OPTIONS = [
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

export const fetchReimbursements = (params?: ReimbursementListParams) =>
  unwrap<ReimbursementListResponse>(
    client.get('/reimbursement', {
      params: {
        user_id: params?.userId,
        status: params?.status,
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        keyword: params?.keyword,
      },
    }),
  )

export const fetchReimbursementDetail = (id: number) =>
  unwrap<ReimbursementDetail>(client.get(`/reimbursement/${id}`))

export const createReimbursement = (data: {
  user_id: number
  amount: number
  category: string
  merchant?: string
  date: string
  remark?: string
  images?: string[]
  project?: string
}) => unwrap<{ id: number }>(client.post('/reimbursement', data))

export const updateReimbursement = (id: number, data: Partial<ReimbursementRecord>) =>
  unwrap<ReimbursementDetail>(client.put(`/reimbursement/${id}`, data))

export const submitReimbursement = (id: number) => unwrap(client.post(`/reimbursement/${id}/submit`))

export const approveReimbursement = (id: number, data: { action: 'approve' | 'reject'; comment?: string }) =>
  unwrap(client.post(`/reimbursement/${id}/approve`, data))

export const revokeReimbursement = (id: number) => unwrap(client.post(`/reimbursement/${id}/revoke`))

export const deleteReimbursement = (id: number) => unwrap(client.delete(`/reimbursement/${id}`))

export const fetchApprovalFlow = (id: number) =>
  unwrap<{ approval_flow: ReimbursementApprovalNode[] }>(client.get(`/reimbursement/${id}/approval_flow`))

export const fetchApprovalHistory = (id: number) =>
  unwrap<{ records: Array<{ id: number; approver_name: string; action: string; created_at?: string; comment?: string }> }>(
    client.get(`/reimbursement/${id}/history`),
  )

export const fetchComments = (id: number) =>
  unwrap<{ comments: ReimbursementComment[] }>(client.get(`/reimbursement/${id}/comments`))

export const addComment = (id: number, data: { content?: string; images?: string[] }) =>
  unwrap(client.post(`/reimbursement/${id}/comments`, data))

export const uploadReimbursementImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/reimbursement/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export const fetchReimbursementStats = (params?: { beginDate?: string; endDate?: string; userId?: number }) =>
  unwrap<ReimbursementStats>(
    client.get('/reimbursement/stats/overview', {
      params: {
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        user_id: params?.userId,
      },
    }),
  )

