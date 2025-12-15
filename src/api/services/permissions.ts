/**
 * 权限管理 API 服务
 */
import apiClient from '../client'

// ============================================
// 类型定义
// ============================================

export interface Permission {
  id: number
  code: string
  name: string
  module: string
  type: 'menu' | 'action' | 'data'
  parent_code?: string
  description?: string
  sort_order: number
  is_active: boolean
}

export interface Role {
  id: number
  code: string
  name: string
  company_id?: number
  description?: string
  is_system: boolean
  is_active: boolean
  permissions: string[]
}

export interface UserPermissions {
  user_id: number
  permissions: string[]
  roles: string[]
  is_super_admin: boolean
  can_switch_accounts: boolean
  can_manage_users: boolean
  can_view_finance: boolean
  can_view_all_data: boolean
}

export interface PermissionsResponse {
  permissions: Permission[]
  modules: Record<string, Permission[]>
  total: number
}

export interface RolesResponse {
  roles: Role[]
  total: number
}

// ============================================
// API 函数
// ============================================

/**
 * 获取权限列表
 */
export const fetchPermissions = async (params?: {
  module?: string
  include_inactive?: boolean
}): Promise<PermissionsResponse> => {
  const response = await apiClient.get('/permissions', { params })
  return response.data.data
}

/**
 * 创建权限
 */
export const createPermission = async (data: {
  code: string
  name: string
  module: string
  type?: string
  parent_code?: string
  description?: string
  sort_order?: number
}): Promise<Permission> => {
  const response = await apiClient.post('/permissions', data)
  return response.data.data
}

/**
 * 更新权限
 */
export const updatePermission = async (
  id: number,
  data: Partial<Permission>
): Promise<Permission> => {
  const response = await apiClient.put(`/permissions/${id}`, data)
  return response.data.data
}

/**
 * 删除权限
 */
export const deletePermission = async (id: number): Promise<void> => {
  await apiClient.delete(`/permissions/${id}`)
}

/**
 * 获取角色列表
 */
export const fetchRolesList = async (params?: {
  include_inactive?: boolean
}): Promise<RolesResponse> => {
  const response = await apiClient.get('/permissions/roles', { params })
  return response.data.data
}

/**
 * 获取角色详情
 */
export const fetchRoleDetail = async (id: number): Promise<Role> => {
  const response = await apiClient.get(`/permissions/roles/${id}`)
  return response.data.data
}

/**
 * 创建角色
 */
export const createRole = async (data: {
  code: string
  name: string
  company_id?: number
  description?: string
  permission_codes?: string[]
}): Promise<Role> => {
  const response = await apiClient.post('/permissions/roles', data)
  return response.data.data
}

/**
 * 更新角色
 */
export const updateRole = async (
  id: number,
  data: {
    name?: string
    description?: string
    is_active?: boolean
    permission_codes?: string[]
  }
): Promise<Role> => {
  const response = await apiClient.put(`/permissions/roles/${id}`, data)
  return response.data.data
}

/**
 * 删除角色
 */
export const deleteRole = async (id: number): Promise<void> => {
  await apiClient.delete(`/permissions/roles/${id}`)
}

/**
 * 获取用户角色
 */
export const fetchUserRoles = async (userId: number): Promise<{ user_id: number; roles: Role[] }> => {
  const response = await apiClient.get(`/permissions/users/${userId}/roles`)
  return response.data.data
}

/**
 * 设置用户角色
 */
export const setUserRoles = async (
  userId: number,
  roleCodes: string[]
): Promise<{ user_id: number; roles: string[] }> => {
  const response = await apiClient.put(`/permissions/users/${userId}/roles`, {
    role_codes: roleCodes,
  })
  return response.data.data
}

/**
 * 获取当前用户权限
 */
export const fetchMyPermissions = async (): Promise<UserPermissions> => {
  const response = await apiClient.get('/permissions/me')
  return response.data.data
}

/**
 * 检查权限
 */
export const checkPermission = async (code: string): Promise<boolean> => {
  const response = await apiClient.get('/permissions/me/check', {
    params: { code },
  })
  return response.data.data.has_permission
}

/**
 * 批量检查权限
 */
export const checkPermissionsBatch = async (
  codes: string[]
): Promise<{ permissions: Record<string, boolean>; has_all: boolean; has_any: boolean }> => {
  const response = await apiClient.post('/permissions/me/check-batch', codes)
  return response.data.data
}
