import client from '../client'
import type { ApiResponse, DistanceRecord } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchDistanceRecords = (params?: {
  keyword?: string
  page?: number
  page_size?: number
  companyId?: number
}) =>
  unwrap<{ list: DistanceRecord[]; total: number; page: number; page_size: number }>(
    client.get('/distance', {
      params: {
        keyword: params?.keyword,
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
        company_id: params?.companyId,
      },
    }),
  )

export const createDistanceRecord = (data: {
  loading_company: string
  unloading_company: string
  distance: number
}, params?: { companyId?: number }) =>
  unwrap(
    client.post('/distance', data, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const updateDistanceRecord = (
  id: number,
  data: Partial<{
    loading_company: string
    unloading_company: string
    distance: number
  }>,
  params?: { companyId?: number },
) =>
  unwrap(
    client.put(`/distance/${id}`, data, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const deleteDistanceRecord = (id: number, params?: { companyId?: number }) =>
  unwrap(
    client.delete(`/distance/${id}`, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )
