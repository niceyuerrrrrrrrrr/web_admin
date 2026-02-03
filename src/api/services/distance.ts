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
  loading_company?: string
  unloading_company?: string
  distance_values?: string
  min_distance?: number
  max_distance?: number
  page?: number
  page_size?: number
  companyId?: number
  columnFilters?: {
    loading_company?: string[]
    unloading_company?: string[]
  }
}) =>
  unwrap<{ list: DistanceRecord[]; total: number; page: number; page_size: number }>(
    client.get('/distance', {
      params: {
        keyword: params?.keyword,
        loading_company: params?.loading_company,
        unloading_company: params?.unloading_company,
        distance_values: params?.distance_values,
        min_distance: params?.min_distance,
        max_distance: params?.max_distance,
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
        company_id: params?.companyId,
        ...params?.columnFilters,
      },
    }),
  )

export const fetchDistanceOptions = (params?: { companyId?: number }) =>
  unwrap<{ loading_companies: string[]; unloading_companies: string[]; distances: number[] }>(
    client.get('/distance/options', {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const batchUpdateDistanceRecords = (
  data: {
    ids: number[]
    loading_company?: string
    unloading_company?: string
    distance?: number
  },
  params?: { companyId?: number },
) =>
  unwrap<{ updated_count: number }>(
    client.put('/distance/batch', data, {
      params: {
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
