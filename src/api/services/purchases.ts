import client from '../client'
import type {
  ApiResponse,
  PurchaseApprovalNode,
  PurchaseComment,
  PurchaseDetail,
  PurchaseListResponse,
  PurchaseRecord,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface PurchaseListParams {
  userId?: number
  status?: string
  page?: number
  pageSize?: number
  beginDate?: string
  endDate?: string
  keyword?: string
  companyId?: number
}

export const PURCHASE_STATUS_OPTIONS = [
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

export const fetchPurchases = (params?: PurchaseListParams) =>
  unwrap<PurchaseListResponse>(
    client.get('/purchase', {
      params: {
        user_id: params?.userId,
        status: params?.status,
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        keyword: params?.keyword,
        company_id: params?.companyId,
      },
    }),
  )

export const fetchPurchaseDetail = (id: number) =>
  unwrap<PurchaseDetail>(client.get(`/purchase/${id}`))

export const createPurchase = (data: {
  user_id: number
  amount: number
  category: string
  supplier?: string
  date: string
  remark?: string
  images?: string[]
  project?: string
}) => unwrap<{ id: number }>(client.post('/purchase', data))

export const updatePurchase = (id: number, data: Partial<PurchaseRecord>) =>
  unwrap<PurchaseDetail>(client.put(`/purchase/${id}`, data))

export const submitPurchase = (id: number) => unwrap(client.post(`/purchase/${id}/submit`))

export const approvePurchase = (id: number, data: { action: 'approve' | 'reject'; comment?: string }) =>
  unwrap(client.post(`/purchase/${id}/approve`, data))

export const revokePurchase = (id: number) => unwrap(client.post(`/purchase/${id}/revoke`))

export const deletePurchase = (id: number) => unwrap(client.delete(`/purchase/${id}`))

export const fetchApprovalFlow = (id: number) =>
  unwrap<{ approval_flow: PurchaseApprovalNode[] }>(client.get(`/purchase/${id}/approval_flow`))

export const fetchApprovalHistory = (id: number) =>
  unwrap<{ records: Array<{ id: number; approver_name: string; action: string; created_at?: string; comment?: string }> }>(
    client.get(`/purchase/${id}/history`),
  )

export const fetchComments = (id: number) =>
  unwrap<{ comments: PurchaseComment[] }>(client.get(`/purchase/${id}/comments`))

export const addComment = (id: number, data: { content?: string; images?: string[] }) =>
  unwrap(client.post(`/purchase/${id}/comments`, data))

export const uploadPurchaseImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/purchase/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}
