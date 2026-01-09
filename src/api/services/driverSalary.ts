import client from '../client'

// ==================== 类型定义 ====================

export interface GlobalConfig {
  id: number
  price_per_trip: number
  safety_bonus_amount: number
  attendance_bonus_amount: number
  hygiene_bonus_amount: number
  energy_saving_bonus_amount: number
  effective_period: string
  status: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface GlobalConfigCreate {
  price_per_trip: number
  safety_bonus_amount: number
  attendance_bonus_amount: number
  hygiene_bonus_amount: number
  energy_saving_bonus_amount: number
  effective_period: string
}

export interface DriverConfig {
  id: number
  user_id: number
  user_name: string
  has_safety_bonus: boolean
  has_attendance_bonus: boolean
  has_hygiene_bonus: boolean
  has_energy_saving_bonus: boolean
  deduction: number
  deduction_reason: string | null
  effective_period: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface DriverConfigCreate {
  user_id: number
  has_safety_bonus: boolean
  has_attendance_bonus: boolean
  has_hygiene_bonus: boolean
  has_energy_saving_bonus: boolean
  deduction: number
  deduction_reason?: string
  effective_period: string
}

export interface SalarySummary {
  id: number
  user_id: number
  user_name: string
  period: string
  trip_count: number
  trip_income: number
  safety_bonus: number
  attendance_bonus: number
  hygiene_bonus: number
  energy_saving_bonus: number
  total_bonus: number
  deduction: number
  gross_salary: number
  net_salary: number
  status: string
  confirmed_by: number | null
  confirmed_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  success: boolean
  code: number
  message: string
  data: T
}

export interface RealtimeTripCount {
  user_id: number
  user_name: string
  business_type: string
  trip_count: number
}

// ==================== 全局配置 API ====================

/**
 * 创建或更新全局配置
 */
export const createOrUpdateGlobalConfig = async (
  config: GlobalConfigCreate,
): Promise<ApiResponse<any>> => {
  const response = await client.post('/driver-salary/global-config', config)
  return response.data
}

/**
 * 按选中ID批量发放工资条（并发送订阅消息）
 */
export const batchSendSalarySlipByIds = async (params: {
  summary_ids: number[]
}): Promise<
  ApiResponse<{
    total: number
    success: number
    failed: number
    denied: number
    notify_sent: number
    results: Array<{
      summary_id: number
      status: 'success' | 'failed'
      salary_slip_id?: number
      notify_sent?: boolean
      reason?: string
    }>
  }>
> => {
  const response = await client.post('/driver-salary/summary/batch-send-by-ids', params)
  return response.data
}

/**
 * 获取全局配置
 */
export const fetchGlobalConfig = async (
  period: string,
): Promise<ApiResponse<GlobalConfig>> => {
  const response = await client.get('/driver-salary/global-config', {
    params: { period },
  })
  return response.data
}

// ==================== 司机配置 API ====================

/**
 * 创建或更新司机配置
 */
export const createOrUpdateDriverConfig = async (
  config: DriverConfigCreate,
): Promise<ApiResponse<any>> => {
  const response = await client.post('/driver-salary/driver-config', config)
  return response.data
}

/**
 * 获取司机配置列表
 */
export const fetchDriverConfigList = async (params: {
  period?: string
  user_id?: number
}): Promise<ApiResponse<DriverConfig[]>> => {
  const response = await client.get('/driver-salary/driver-config/list', {
    params,
  })
  return response.data
}

// ==================== 工资计算 API ====================

/**
 * 计算单个司机工资
 */
export const calculateDriverSalary = async (params: {
  user_id: number
  period: string
  force_recalculate?: boolean
}): Promise<ApiResponse<SalarySummary>> => {
  const response = await client.post('/driver-salary/calculate', params)
  return response.data
}

/**
 * 批量计算所有司机工资
 */
export const batchCalculateSalary = async (
  period: string,
): Promise<ApiResponse<any>> => {
  const response = await client.post('/driver-salary/batch-calculate', null, {
    params: { period },
  })
  return response.data
}

// ==================== 工资汇总 API ====================

/**
 * 获取工资汇总列表
 */
export const fetchSalarySummaryList = async (params: {
  period?: string
  status?: string
  user_id?: number
  company_id?: number
}): Promise<ApiResponse<{
  summaries: SalarySummary[]
  statistics: {
    total_count: number
    total_trips: number
    total_trip_income: number
    total_bonus: number
    total_deduction: number
    total_net_salary: number
    confirmed_count: number
  }
}>> => {
  const response = await client.get('/driver-salary/summary/list', { params })
  return response.data
}

/**
 * 实时获取司机趟数（不依赖工资计算结果）
 */
export const fetchRealtimeTrips = async (params: {
  period: string
  company_id?: number
  department_id?: number
}): Promise<ApiResponse<RealtimeTripCount[]>> => {
  const response = await client.get('/driver-salary/trips/realtime', { params })
  return response.data
}

/**
 * 确认工资
 */
export const confirmSalary = async (
  summaryId: number,
): Promise<ApiResponse<any>> => {
  const response = await client.post(
    `/driver-salary/summary/${summaryId}/confirm`,
  )
  return response.data
}

/**
 * 批量确认工资（仅总经理）
 */
export const batchConfirmSalary = async (params: {
  period: string
  company_id?: number
  department_id?: number
}): Promise<ApiResponse<{ updated: number }>> => {
  const response = await client.post('/driver-salary/summary/batch-confirm', null, {
    params,
  })
  return response.data
}

/**
 * 发放工资条
 */
export const sendSalarySlip = async (
  summaryId: number,
): Promise<ApiResponse<any>> => {
  const response = await client.post(
    `/driver-salary/summary/${summaryId}/send`,
  )
  return response.data
}

/**
 * 批量发放工资条（并发送订阅消息）
 */
export const batchSendSalarySlip = async (params: {
  period: string
  company_id?: number
  department_id?: number
}): Promise<
  ApiResponse<{
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
  }>
> => {
  const response = await client.post('/driver-salary/summary/batch-send', null, {
    params,
  })
  return response.data
}
