import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

// 财务账户类型
export interface FinAccount {
  id: number
  company_id: number
  name: string
  account_type: 'bank' | 'cash' | 'alipay' | 'wechat' | 'other'
  account_no?: string
  bank_name?: string
  balance_cents: number
  status: 'active' | 'inactive'
  remark?: string
  created_at?: string
  updated_at?: string
}

// 获取财务账户列表
export const fetchFinAccounts = (params?: { companyId?: number; status?: string }) =>
  unwrap<{ records: FinAccount[]; total: number }>(
    client.get('/fin-accounts', {
      params: {
        company_id: params?.companyId,
        status: params?.status,
      },
    }),
  )

// 获取账户详情
export const fetchFinAccountDetail = (id: number) =>
  unwrap<FinAccount>(client.get(`/fin-accounts/${id}`))

// 创建账户
export const createFinAccount = (data: {
  name: string
  account_type: string
  account_no?: string
  bank_name?: string
  remark?: string
}) => unwrap<{ id: number }>(client.post('/fin-accounts', data))

// 更新账户
export const updateFinAccount = (id: number, data: Partial<FinAccount>) =>
  unwrap<FinAccount>(client.put(`/fin-accounts/${id}`, data))

// 删除账户
export const deleteFinAccount = (id: number) =>
  unwrap(client.delete(`/fin-accounts/${id}`))
