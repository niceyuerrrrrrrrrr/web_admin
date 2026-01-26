import client from '../client'
import type { ApiResponse, NavigationAddress } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchNavigationAddresses = (params?: {
  type?: 'loading' | 'unloading' | 'charging'
  keyword?: string
  companyId?: number
}) =>
  unwrap<{ addresses: NavigationAddress[]; total: number }>(
    client.get('/navigation/addresses', {
      params: {
        type: params?.type,
        keyword: params?.keyword,
        company_id: params?.companyId,
      },
    }),
  )

export const createNavigationAddress = (data: {
  type: 'loading' | 'unloading' | 'charging'
  name: string
  address: string
  longitude: number
  latitude: number
  contact?: string
  phone?: string
  remark?: string
}, params?: { companyId?: number }) =>
  unwrap<{ message: string; address_id: number }>(
    client.post('/navigation/addresses', data, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const updateNavigationAddress = (
  addressId: number,
  data: Partial<{
    name: string
    address: string
    longitude: number
    latitude: number
    contact: string
    phone: string
    remark: string
  }>,
  params?: { companyId?: number },
) =>
  unwrap<{ message: string }>(
    client.put(`/navigation/addresses/${addressId}`, data, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const deleteNavigationAddress = (addressId: number, params?: { companyId?: number }) =>
  unwrap<{ message: string }>(
    client.delete(`/navigation/addresses/${addressId}`, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )
