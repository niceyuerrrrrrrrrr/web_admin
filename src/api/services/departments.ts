import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface Department {
  id: number
  title: string
  company_id?: number
  company_name?: string
  parent_id?: number
  sort?: number
  user_count?: number
  created_at?: string
  updated_at?: string
}

export interface DepartmentListResponse {
  records: Department[]
  total: number
}

export interface DepartmentDetailResponse {
  id: number
  title: string
  company_id?: number
  company_name?: string
  parent_id?: number
  sort?: number
  user_count?: number
  created_at?: string
  updated_at?: string
}

/**
 * 获取部门列表
 */
export const fetchDepartments = (params?: {
  company_id?: number
}) => {
  // 确保 company_id 参数正确传递
  const queryParams: { company_id?: number } = {}
  if (params?.company_id !== undefined && params?.company_id !== null) {
    queryParams.company_id = params.company_id
  }
  return unwrap<DepartmentListResponse>(
    client.get('/departments', {
      params: queryParams,
    }),
  )
}

/**
 * 获取部门详情
 */
export const fetchDepartmentDetail = (departmentId: number) =>
  unwrap<DepartmentDetailResponse>(client.get(`/departments/${departmentId}`))

/**
 * 创建部门
 */
export const createDepartment = (data: {
  title: string
  company_id?: number
  parent_id?: number
  sort?: number
}) =>
  unwrap<{ id: number; title: string; company_id?: number; message: string }>(
    client.post('/departments', data),
  )

/**
 * 更新部门信息
 */
export const updateDepartment = (
  departmentId: number,
  data: {
    title?: string
    parent_id?: number
    sort?: number
  },
) =>
  unwrap<{ id: number; title: string; message: string }>(
    client.put(`/departments/${departmentId}`, data),
  )

/**
 * 删除部门
 */
export const deleteDepartment = (departmentId: number) =>
  unwrap<{ message: string }>(client.delete(`/departments/${departmentId}`))

