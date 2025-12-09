import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface ShiftTemplate {
  id: number
  name: string
  start_time: string
  end_time: string
  grace_minutes: number
  is_active: boolean
  workday_flag: boolean
  roles: string[]
}

export interface ShiftTemplatePayload {
  name: string
  start_time: string
  end_time: string
  grace_minutes?: number
  is_active?: boolean
  workday_flag?: boolean
  roles?: { role_name: string }[]
}

export interface AttendancePolicy {
  company_id: number
  on_duty_grace: number
  off_duty_grace: number
  min_work_minutes: number
  location_check_enabled: boolean
}

export interface AttendancePolicyPayload {
  on_duty_grace?: number
  off_duty_grace?: number
  min_work_minutes?: number
  location_check_enabled?: boolean
}

export interface LeaveTypeDict {
  id: number
  name: string
  is_field_trip: boolean
  requires_proof: boolean
  is_active: boolean
  company_id?: number | null
}

export interface LeaveTypePayload {
  name: string
  is_field_trip?: boolean
  requires_proof?: boolean
  is_active?: boolean
}

export interface RosterItemPayload {
  user_id: number
  work_date: string
  shift_id?: number
  status?: string
}

export const listShiftTemplates = (companyId?: number) =>
  unwrap<ShiftTemplate[]>(
    client.get('/attendance/config/shifts', { params: companyId ? { company_id: companyId } : undefined }),
  )
export const createShiftTemplate = (payload: ShiftTemplatePayload, companyId?: number) =>
  unwrap(client.post('/attendance/config/shifts', payload, { params: companyId ? { company_id: companyId } : undefined }))
export const updateShiftTemplate = (id: number, payload: Partial<ShiftTemplatePayload>, companyId?: number) =>
  unwrap(client.put(`/attendance/config/shifts/${id}`, payload, { params: companyId ? { company_id: companyId } : undefined }))
export const deleteShiftTemplate = (id: number, companyId?: number) =>
  unwrap(client.delete(`/attendance/config/shifts/${id}`, { params: companyId ? { company_id: companyId } : undefined }))
export const exportShiftTemplates = (companyId?: number) =>
  unwrap<{ filename: string; content: string }>(
    client.get('/attendance/config/shifts/export', { params: companyId ? { company_id: companyId } : undefined }),
  )
export const importShiftTemplates = (file: File, companyId?: number) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap(
    client.post('/attendance/config/shifts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: companyId ? { company_id: companyId } : undefined,
    }),
  )
}

export const getAttendancePolicy = (companyId?: number) =>
  unwrap<AttendancePolicy>(
    client.get('/attendance/config/policy', { params: companyId ? { company_id: companyId } : undefined }),
  )
export const updateAttendancePolicy = (payload: AttendancePolicyPayload, companyId?: number) =>
  unwrap(client.put('/attendance/config/policy', payload, { params: companyId ? { company_id: companyId } : undefined }))

export const listLeaveTypes = (companyId?: number) =>
  unwrap<LeaveTypeDict[]>(client.get('/attendance/config/leave-types', { params: companyId ? { company_id: companyId } : undefined }))
export const createLeaveType = (payload: LeaveTypePayload, companyId?: number) =>
  unwrap(client.post('/attendance/config/leave-types', payload, { params: companyId ? { company_id: companyId } : undefined }))
export const updateLeaveType = (id: number, payload: Partial<LeaveTypePayload>, companyId?: number) =>
  unwrap(client.put(`/attendance/config/leave-types/${id}`, payload, { params: companyId ? { company_id: companyId } : undefined }))
export const deleteLeaveType = (id: number, companyId?: number) =>
  unwrap(client.delete(`/attendance/config/leave-types/${id}`, { params: companyId ? { company_id: companyId } : undefined }))

export const listRosters = (params: { start_date: string; end_date: string }, companyId?: number) =>
  unwrap(
    client.get('/attendance/config/rosters', {
      params: { ...params, ...(companyId ? { company_id: companyId } : {}) },
    }),
  )

export const setRosters = (items: RosterItemPayload[], companyId?: number) =>
  unwrap(client.post('/attendance/config/rosters', items, { params: companyId ? { company_id: companyId } : undefined }))

// -------------------- 围栏 --------------------
export interface GeoFence {
  id: number
  name: string
  center_lng: number
  center_lat: number
  radius: number
  description?: string
  allowed_roles: string[]
  location_type: string
  is_active: boolean
  company_id?: number
}

export interface GeoFencePayload {
  name: string
  center_lng: number
  center_lat: number
  radius: number
  description?: string
  allowed_roles?: string[]
  location_type?: string
  is_active?: boolean
}

export const listFences = (companyId?: number) =>
  unwrap<GeoFence[]>(client.get('/attendance/config/fences', { params: companyId ? { company_id: companyId } : undefined }))
export const createFence = (payload: GeoFencePayload, companyId?: number) =>
  unwrap(client.post('/attendance/config/fences', payload, { params: companyId ? { company_id: companyId } : undefined }))
export const updateFence = (id: number, payload: Partial<GeoFencePayload>, companyId?: number) =>
  unwrap(client.put(`/attendance/config/fences/${id}`, payload, { params: companyId ? { company_id: companyId } : undefined }))
export const deleteFence = (id: number, companyId?: number) =>
  unwrap(client.delete(`/attendance/config/fences/${id}`, { params: companyId ? { company_id: companyId } : undefined }))

// ============ 补卡配额管理 ============

export interface MakeupQuota {
  user_id: number
  user_name: string
  position_type: string
  monthly_makeup_quota: number
  used_makeup_count: number
  remaining: number
  last_reset_date: string | null
}

export interface MakeupQuotaUpdate {
  user_id: number
  monthly_makeup_quota: number
}

export const listMakeupQuotas = (companyId?: number, search?: string) =>
  unwrap(client.get<MakeupQuota[]>('/attendance/config/makeup-quotas', { 
    params: { 
      ...(companyId ? { company_id: companyId } : {}),
      ...(search ? { search } : {})
    } 
  }))

export const updateMakeupQuota = (payload: MakeupQuotaUpdate, companyId?: number) =>
  unwrap(client.put('/attendance/config/makeup-quota', payload, { 
    params: companyId ? { company_id: companyId } : undefined 
  }))


