import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

// ==================== 类型定义 ====================

export interface GlobalConfig {
  id: number
  period: string
  company_id: number
  department_id?: number
  performance_x: number
  created_at: string
  updated_at: string
}

export interface UserConfig {
  id: number
  period: string
  user_id: number
  user_name: string
  company_id: number
  department_id?: number
  department_name?: string
  position_type: string
  base_salary: number
  leader_ratio: number
  managed_department_ids?: number[]
  is_active: boolean
  created_at: string
}

export interface SalarySummary {
  id: number
  period: string
  user_id: number
  user_name: string
  company_id: number
  company_name: string
  department_id?: number
  department_name?: string
  position_type: string
  base_salary: number
  performance_bonus: number
  total_salary: number
  leader_ratio?: number
  dept_driver_trips?: number
  performance_x?: number
  performance_pool?: number
  status: 'pending' | 'confirmed' | 'sent'
  confirmed_at?: string
  sent_at?: string
  salary_slip_id?: number
  created_at: string
}

// ==================== 全局配置 API ====================

export const fetchGlobalConfigs = (params?: {
  period?: string
  company_id?: number
}) =>
  unwrap<{ configs: GlobalConfig[] }>(
    client.get('/staff-salary/global-config', { params })
  )

export const createOrUpdateGlobalConfig = (data: {
  period: string
  company_id: number
  department_id?: number
  performance_x: number
}) =>
  unwrap<{ message: string; id: number }>(
    client.post('/staff-salary/global-config', data)
  )

// ==================== 人员配置 API ====================

export interface AvailableStaff {
  user_id: number
  user_name: string
  company_id: number
  company_name: string
  department_id?: number
  department_name?: string
  position_type: string
}

export const fetchAvailableStaff = (params?: {
  company_id?: number
  department_id?: number
}) =>
  unwrap<{ staff: AvailableStaff[]; total: number }>(
    client.get('/staff-salary/available-staff', { params })
  )

export const fetchUserConfigs = (params: {
  period: string
  company_id?: number
  department_id?: number
}) =>
  unwrap<{ configs: UserConfig[] }>(
    client.get('/staff-salary/user-config', { params })
  )

export const batchCreateUserConfigs = (data: {
  period: string
  configs: Array<{
    user_id: number
    base_salary: number
    leader_ratio?: number
    managed_department_ids?: number[]
  }>
}) =>
  unwrap<{ success_count: number; error_count: number; errors: string[] }>(
    client.post('/staff-salary/user-config/batch', data)
  )

// ==================== 工资计算 API ====================

export const calculateSalary = (params: {
  period: string
  company_id?: number
}) =>
  unwrap<{ success_count: number; error_count: number; errors: string[]; message: string }>(
    client.post('/staff-salary/calculate', null, { params })
  )

// ==================== 工资汇总 API ====================

export const fetchSalarySummary = (params: {
  period: string
  company_id?: number
  department_id?: number
  status?: string
}) =>
  unwrap<{
    summaries: SalarySummary[]
    total: number
    statistics: {
      total_count: number
      total_base_salary: number
      total_performance_bonus: number
      total_salary: number
      confirmed_count: number
      sent_count: number
    }
  }>(client.get('/staff-salary/summary', { params }))

// ==================== 确认 API ====================

export const confirmSalary = (summaryId: number) =>
  unwrap<{ message: string }>(
    client.post(`/staff-salary/summary/${summaryId}/confirm`)
  )

export const batchConfirmSalary = (params: {
  period: string
  company_id?: number
  department_id?: number
}) =>
  unwrap<{ message: string }>(
    client.post('/staff-salary/summary/batch-confirm', null, { params })
  )

// ==================== 发放 API ====================

export const sendSalary = (summaryId: number) =>
  unwrap<{ message: string; salary_slip_id: number; notify_sent: boolean }>(
    client.post(`/staff-salary/summary/${summaryId}/send`)
  )

export const batchSendSalary = (params: {
  period: string
  company_id?: number
  department_id?: number
}) =>
  unwrap<{
    success_count: number
    failed_count: number
    notify_sent_count: number
    message: string
  }>(
    client.post('/staff-salary/summary/batch-send', null, { params })
  )

export const batchSendSalaryByIds = (data: {
  summary_ids: number[]
}) =>
  unwrap<{
    total: number
    success: number
    failed: number
    notify_sent: number
    results: Array<{
      summary_id: number
      status: 'success' | 'failed'
      salary_slip_id?: number
      notify_sent?: boolean
      reason?: string
    }>
  }>(
    client.post('/staff-salary/summary/batch-send-by-ids', data)
  )
