import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

// 公司信息
export interface Company {
  id: number
  name: string
  business_type?: string
  status: string
  created_at?: string
  updated_at?: string
}

// 公司统计
export interface CompanyStatistics {
  company_id: number
  company_name: string
  total_users: number
  active_users: number
  inactive_users: number
  role_distribution: Record<string, number>
}

/**
 * 获取公司列表
 */
export const fetchCompanies = (params?: { status?: string }) =>
  unwrap<{
    records: Company[]
    total: number
  }>(
    client.get('/companies', {
      params: {
        status: params?.status,
      },
    }),
  )

/**
 * 获取公司详情
 */
export const fetchCompanyDetail = (companyId: number) => unwrap<Company>(client.get(`/companies/${companyId}`))

/**
 * 创建公司
 */
export const createCompany = (data: { name: string; business_type: string; status?: string }) =>
  unwrap<{ id: number }>(client.post('/companies', data))

/**
 * 更新公司信息
 */
export const updateCompany = (companyId: number, data: { name?: string; status?: string }) =>
  unwrap<Company>(client.put(`/companies/${companyId}`, data))

/**
 * 更新公司状态
 */
export const updateCompanyStatus = (companyId: number, status: 'active' | 'inactive') =>
  unwrap<{ id: number; name: string; status: string }>(
    client.patch(`/companies/${companyId}/status`, null, {
      params: { status },
    }),
  )

/**
 * 获取公司用户列表
 */
export const fetchCompanyUsers = (params: {
  companyId: number
  page?: number
  pageSize?: number
}) =>
  unwrap<{
    users: Array<{
      id: number
      name?: string
      phone?: string
      position_type?: string
      status?: string
      plate?: string
    }>
    total: number
    page: number
    page_size: number
  }>(
    client.get(`/companies/${params.companyId}/users`, {
      params: {
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    }),
  )

/**
 * 获取公司统计信息
 */
export const fetchCompanyStatistics = (companyId: number) =>
  unwrap<CompanyStatistics>(client.get(`/companies/${companyId}/statistics`))

