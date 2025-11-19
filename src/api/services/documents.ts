import client from '../client'
import type { ApiResponse, DocumentListResponse, DocumentRecord, DocumentStats } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface DocumentListParams {
  category: string
  doc_type?: string
  search?: string
  subject?: string
  expire_status?: string
  page?: number
  page_size?: number
}

export interface DocumentPayload {
  category: string
  doc_type: string
  doc_no: string
  subject_identifier?: string
  subject_display?: string
  expire_date?: string
  remark?: string
  assets?: Array<{ file_url: string; file_name?: string; file_thumb?: string }>
}

export interface DocumentUpdatePayload extends Partial<DocumentPayload> {
  sync_version?: number
  keep_asset_ids?: number[]
  remove_asset_ids?: number[]
}

export const fetchDocuments = (params: DocumentListParams) =>
  unwrap<DocumentListResponse>(
    client.get('/documents', {
      params: {
        category: params.category,
        doc_type: params.doc_type,
        search: params.search,
        subject: params.subject,
        expire_status: params.expire_status,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      },
    }),
  )

export const createDocument = (payload: DocumentPayload) => unwrap<DocumentRecord>(client.post('/documents', payload))

export const updateDocument = (docId: number, payload: DocumentUpdatePayload) =>
  unwrap(client.put(`/documents/${docId}`, payload))

export const deleteDocument = (docId: number) => unwrap(client.delete(`/documents/${docId}`))

export const uploadDocumentAsset = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export const fetchDocumentStats = (params?: { category?: string }) =>
  unwrap<DocumentStats>(
    client.get('/documents/stats/overview', {
      params: {
        category: params?.category,
      },
    }),
  )

