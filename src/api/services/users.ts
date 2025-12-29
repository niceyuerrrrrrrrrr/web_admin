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
  // 基础字段
  id: number
  created_at?: string
  updated_at?: string
  nickname?: string
  username?: string
  email?: string
  phone?: string
  password?: string
  password_change_tz?: number
  app_lang?: string
  reset_token?: string
  system_settings?: any
  sort?: number
  created_by_id?: number
  updated_by_id?: number
  
  // 业务相关字段 - 车辆信息
  plate?: string
  plateNumber?: string // 兼容字段
  plate_history?: string[] // 历史车牌号列表
  tanker_vehicle_code?: string // 当前自编车号（罐车业务）
  tanker_vehicle_code_history?: string[] // 历史自编车号列表（罐车业务）
  position_type?: string
  positionType?: string // 兼容字段
  status?: string
  last_login_at?: string
  lastLoginAt?: string // 兼容字段
  login_count?: number
  loginCount?: number // 兼容字段
  onboard_date?: string
  wx_openid?: string
  role?: string
  
  // 公司相关字段
  company?: string
  company_id?: number
  company_name?: string
  company_business_type?: string
  
  // 部门相关字段
  department_id?: number
  department_name?: string
  departmentId?: number // 兼容字段
  departmentName?: string // 兼容字段
  
  // 银行信息字段
  bank_card?: string
  bank_name?: string
  card_holder?: string
  
  // 入职申请同步的字段
  id_card?: string // 身份证号
  gender?: string // 性别：male/female
  birth_date?: string // 出生日期
  address?: string // 地址
  emergency_contact?: string // 紧急联系人
  emergency_phone?: string // 紧急联系人电话
  work_location?: string // 工作地点
  mp_openid?: string // 服务号OpenID
  
  // 其他字段
  avatar?: string
  name?: string // 兼容字段，通常映射到nickname
  registerTime?: string // 兼容字段，通常映射到created_at
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
  company_id?: number
  department_id?: number
}) =>
  unwrap<UserListResponse>(
    client.get('/users', {
      params: {
        page: params?.page || 1,
        size: params?.size || 100, // 获取更多用户用于选择器
        phone: params?.phone,
        name: params?.name,
        status: params?.status,
        company_id: params?.company_id,
        department_id: params?.department_id,
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
 * 创建用户
 */
export const createUser = (data: {
  nickname: string
  phone: string
  username?: string
  password?: string
  position_type?: string
  company_id?: number
  department_id?: number
  role?: string
  status?: string
}) => unwrap<{ user: User; message: string }>(client.post('/users', data))

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

