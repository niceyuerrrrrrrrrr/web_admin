import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface CompanyAttendanceSummary {
  summary: {
    should: number
    attended: number
    late: number
    absent: number
    attendanceRate: number
  }
  list: Array<{
    userId: number
    name: string
    attendedDays: number
    lateDays: number
    missedDays: number
    status: string
  }>
  period: {
    start: string
    end: string
  }
}

// 打卡记录
export interface AttendanceRecord {
  attendance_id: string
  shift_id?: string
  clock_type: 'check_in' | 'check_out'
  clock_time: string
  longitude: number
  latitude: number
  location_text: string
  work_date: string
}

// 班次信息
export interface AttendanceShift {
  id: number
  checkInTime?: string
  checkOutTime?: string
  inLoc?: string
  outLoc?: string
  inAt?: string
  outAt?: string
  status: string
  workDurationMinutes: number
}

export const adminUpdateShift = (data: {
  shift_id: number
  check_in_time: string
  check_out_time?: string
  check_in_location?: string
  check_out_location?: string
}) => unwrap<{ shift: AttendanceShift }>(client.post('/attendance/admin/update-shift', data))

// 考勤统计
export interface AttendanceStatistics {
  total_days: number
  work_days: number
  absent_days: number
  late_count: number
  early_leave_count: number
  total_work_minutes: number
  average_work_minutes: number
  attendance_rate: number
}

// 告警记录
export interface AttendanceAlert {
  id: number
  user_id: number
  alert_type: string
  message: string
  is_resolved: boolean
  created_at: string
}

// 电子围栏
export interface AttendanceFence {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  description?: string
}

// 补卡申请
export interface MakeupApplication {
  id: number
  user_id: number
  work_date: string
  clock_type: 'check_in' | 'check_out'
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: number
  approved_at?: string
  reject_reason?: string
  created_at: string
}

/**
 * 获取打卡历史
 */
export const fetchAttendanceHistory = (params: {
  userId?: number
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  scope?: 'mine' | 'all'
  companyId?: number
}) =>
  unwrap<{
    records: AttendanceRecord[]
    total: number
    page: number
    page_size: number
  }>(
    client.get('/attendance/history', {
      params: {
        user_id: params.userId,
        start_date: params.startDate,
        end_date: params.endDate,
        page: params.page || 1,
        page_size: params.pageSize || 10,
        scope: params.scope || 'mine',
        company_id: params.companyId,
      },
    }),
  )

/**
 * 获取今日班次
 */
export const fetchTodayShifts = (params: { userId: number }) =>
  unwrap<{ shifts: AttendanceShift[] }>(
    client.get('/attendance/today-shifts', {
      params: {
        user_id: params.userId,
      },
    }),
  )

/**
 * 获取考勤统计
 */
export const fetchAttendanceStatistics = (params: {
  userId: number
  startDate?: string
  endDate?: string
}) =>
  unwrap<AttendanceStatistics>(
    client.get('/attendance/statistics', {
      params: {
        user_id: params.userId,
        start_date: params.startDate,
        end_date: params.endDate,
      },
    }),
  )

/**
 * 获取公司级考勤汇总
 */
export const fetchCompanyAttendanceSummary = (params: {
  timeRange?: 'today' | 'week' | 'month' | 'year'
  companyId?: number
}) =>
  unwrap<CompanyAttendanceSummary>(
    client.get('/attendance/company-summary', {
      params: {
        time_range: params.timeRange,
        company_id: params.companyId,
      },
    }),
  )

/**
 * 获取告警记录
 */
export const fetchAttendanceAlerts = (params?: {
  userId?: number
  isResolved?: boolean
  alertType?: string
}) =>
  unwrap<{ alerts: AttendanceAlert[] }>(
    client.get('/attendance/alerts', {
      params: {
        user_id: params?.userId,
        is_resolved: params?.isResolved,
        alert_type: params?.alertType,
      },
    }),
  )

/**
 * 获取电子围栏
 */
export const fetchAttendanceFences = (params?: { userId?: number }) =>
  unwrap<{ fences: AttendanceFence[] }>(
    client.get('/attendance/fences', {
      params: params?.userId ? { user_id: params.userId } : undefined,
    }),
  )

/**
 * 创建电子围栏
 */
export const createFence = (data: {
  name: string
  center_longitude: number
  center_latitude: number
  radius: number
  description?: string
  allowed_roles?: string[]
  location_type?: string
  company_id?: number
}) => unwrap<{ id: number }>(client.post('/attendance/fences', data))

/**
 * 更新电子围栏
 */
export const updateFence = (
  fenceId: number,
  data: {
    name?: string
    center_longitude?: number
    center_latitude?: number
    radius?: number
    description?: string
    allowed_roles?: string[]
    location_type?: string
    is_active?: boolean
  },
) => unwrap(client.put(`/attendance/fences/${fenceId}`, data))

/**
 * 删除电子围栏
 */
export const deleteFence = (fenceId: number) => unwrap(client.delete(`/attendance/fences/${fenceId}`))

/**
 * 获取补卡申请列表
 */
export const fetchMakeupApplications = (params?: {
  userId?: number
  status?: 'pending' | 'approved' | 'rejected'
}) =>
  unwrap<{ applications: MakeupApplication[] }>(
    client.get('/attendance/makeup', {
      params: {
        user_id: params?.userId,
        status: params?.status,
      },
    }),
  )

/**
 * 提交补卡申请
 */
export const createMakeupApplication = (data: {
  user_id: number
  work_date: string
  clock_type: 'check_in' | 'check_out'
  reason: string
}) => unwrap<{ id: number }>(client.post('/attendance/makeup', data))

/**
 * 审批补卡申请
 */
export const approveMakeupApplication = (
  applicationId: number,
  data: { action: 'approve' | 'reject'; reject_reason?: string },
) => unwrap(client.post(`/attendance/makeup/${applicationId}/approve`, data))

/**
 * 解决告警
 */
export const resolveAlert = (alertId: number) =>
  unwrap(client.post(`/attendance/alerts/${alertId}/resolve`))

