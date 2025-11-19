import client from '../client'
import type {
  ApiResponse,
  MaterialComment,
  MaterialRequestListResponse,
  MaterialRequestRecord,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface MaterialRequestListParams {
  userId?: number
  status?: string
  page?: number
  pageSize?: number
  beginDate?: string
  endDate?: string
  keyword?: string
}

export const MATERIAL_REQUEST_STATUS_OPTIONS = [
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

export const fetchMaterialRequests = (params?: MaterialRequestListParams) =>
  unwrap<MaterialRequestListResponse>(
    client.get('/material', {
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

export const fetchMaterialRequestDetail = (id: number) =>
  unwrap<MaterialRequestRecord>(client.get(`/material/${id}`))

export const createMaterialRequest = (data: {
  user_id: number
  material_name: string
  material_code?: string
  quantity: number
  unit: string
  purpose?: string
  request_date: string
  images?: string[]
  warehouse_id?: number
}) => unwrap<{ id: number }>(client.post('/material', data))

export const submitMaterialRequest = (id: number) => unwrap(client.post(`/material/${id}/submit`, {}))

export const approveMaterialRequest = (
  id: number,
  data: {
    action: 'approve' | 'reject'
    comment?: string
  },
) => unwrap(client.post(`/material/${id}/approve`, data))

export const deleteMaterialRequest = (id: number) => unwrap(client.delete(`/material/${id}`))

export const fetchMaterialApprovalFlow = (id: number) =>
  unwrap<{
    approval_flow: Array<{
      approver_name: string
      role: string
      status: string
      status_text: string
      approval_time?: string
      comment?: string
    }>
  }>(client.get(`/material/${id}/approval_flow`))

export const fetchMaterialApprovalHistory = (id: number) =>
  unwrap<{ records: Array<{ approver_name: string; action: string; comment?: string; created_at?: string }> }>(
    client.get(`/material/${id}/history`),
  )

export const fetchMaterialComments = (id: number) =>
  unwrap<{ comments: MaterialComment[] }>(client.get(`/material/${id}/comments`))

export const addMaterialComment = (id: number, data: { content?: string; images?: string[] }) =>
  unwrap(client.post(`/material/${id}/comments`, data))

export const uploadMaterialImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/material/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

