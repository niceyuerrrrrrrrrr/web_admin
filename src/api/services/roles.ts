import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

// 角色信息
export interface Role {
  id: string
  name: string
  title: string
  description: string
  level: number
  department: string
  permissions: {
    can_switch_accounts: boolean
    can_manage_users: boolean
    can_view_finance: boolean
    can_view_statistics: boolean
    can_manage_vehicles: boolean
    can_manage_receipts: boolean
    level: number
  }
}

// 用户权限
export interface UserPermissions {
  role: string
  permissions: {
    can_switch_accounts: boolean
    can_manage_users: boolean
    can_view_finance: boolean
    can_view_statistics: boolean
    can_manage_vehicles: boolean
    can_manage_receipts: boolean
    level: number
  }
  can_switch_accounts: boolean
  can_manage_users: boolean
  can_view_finance: boolean
  can_view_statistics: boolean
  can_manage_vehicles: boolean
  can_manage_receipts: boolean
  level: number
}

/**
 * 获取当前用户权限
 */
export const fetchCurrentUserPermissions = () => unwrap<UserPermissions>(client.get('/roles/permissions'))

/**
 * 获取角色列表
 */
export const fetchRoles = (params?: { page?: number; size?: number }) =>
  unwrap<{
    items: Role[]
    total: number
    page: number
    size: number
  }>(
    client.get('/roles/list', {
      params: {
        page: params?.page || 1,
        size: params?.size || 100,
      },
    }),
  )

