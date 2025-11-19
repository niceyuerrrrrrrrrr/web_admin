import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface User {
  id: number
  name?: string
  nickname?: string
  phone?: string
  plateNumber?: string
  position_type?: string
  positionType?: string
  status?: string
  lastLoginAt?: string
  loginCount?: number
  registerTime?: string
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  size: number
}

export const fetchUsers = (params?: {
  page?: number
  size?: number
  phone?: string
  name?: string
  status?: string
}) =>
  unwrap<UserListResponse>(
    client.get('/users', {
      params: {
        page: params?.page || 1,
        size: params?.size || 100, // 获取更多用户用于选择器
        phone: params?.phone,
        name: params?.name,
        status: params?.status,
      },
    }),
  )

/**
 * 获取用户详情
 */
export const fetchUserDetail = (userId: number) => unwrap<{ user: User }>(client.get(`/users/${userId}`))

/**
 * 更新用户信息
 */
export const updateUser = (userId: number, data: Partial<User>) =>
  unwrap<{ user: User }>(client.patch(`/users/${userId}`, data))

/**
 * 删除用户
 */
export const deleteUser = (userId: number) => unwrap(client.delete(`/users/${userId}`))

/**
 * 重置用户密码
 */
export const resetUserPassword = (userId: number) => unwrap<{ message: string }>(client.post(`/users/${userId}/reset-password`))

/**
 * 更新用户状态
 */
export const updateUserStatus = (userId: number, status: 'active' | 'inactive') =>
  unwrap<{ user: User; message: string }>(
    client.patch(`/users/${userId}/status`, null, {
      params: { status },
    }),
  )

/**
 * 批量操作用户
 */
export const batchOperateUsers = (params: {
  operation: 'delete' | 'update_status' | 'assign_role'
  user_ids: number[]
  data?: any
}) =>
  unwrap<{ message: string }>(
    client.post('/users/batch', {
      operation: params.operation,
      user_ids: params.user_ids,
      data: params.data,
    }),
  )

