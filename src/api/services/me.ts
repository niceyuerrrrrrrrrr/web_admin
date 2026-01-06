import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface LinkedAccount {
  id: number
  name?: string
  phone?: string
  positionType?: string
  role?: string
  companyId?: number
  companyName?: string
  companyBusinessType?: string
}

export interface LinkedAccountsResponse {
  current_user_id: number
  linked_accounts: LinkedAccount[]
  link_method: 'id_card' | 'none'
}

export const fetchLinkedAccounts = () =>
  unwrap<LinkedAccountsResponse>(client.get('/me/linked-accounts'))

export interface SwitchAccountResponse {
  token: string
  user: {
    id: number
    name?: string
    phone?: string
    positionType?: string
    role?: string
    companyId?: number
    companyName?: string
    companyBusinessType?: string
  }
}

export const switchAccount = (userId: number) =>
  unwrap<SwitchAccountResponse>(client.post('/me/switch-account', { user_id: userId }))
