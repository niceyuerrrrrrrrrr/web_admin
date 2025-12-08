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

export const listShiftTemplates = () => unwrap<ShiftTemplate[]>(client.get('/attendance/config/shifts'))
export const createShiftTemplate = (payload: ShiftTemplatePayload) =>
  unwrap(client.post('/attendance/config/shifts', payload))
export const updateShiftTemplate = (id: number, payload: Partial<ShiftTemplatePayload>) =>
  unwrap(client.put(`/attendance/config/shifts/${id}`, payload))
export const deleteShiftTemplate = (id: number) => unwrap(client.delete(`/attendance/config/shifts/${id}`))
export const exportShiftTemplates = () =>
  unwrap<{ filename: string; content: string }>(client.get('/attendance/config/shifts/export'))
export const importShiftTemplates = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap(client.post('/attendance/config/shifts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }))
}

export const getAttendancePolicy = () => unwrap<AttendancePolicy>(client.get('/attendance/config/policy'))
export const updateAttendancePolicy = (payload: AttendancePolicyPayload) =>
  unwrap(client.put('/attendance/config/policy', payload))

export const listLeaveTypes = () => unwrap<LeaveTypeDict[]>(client.get('/attendance/config/leave-types'))
export const createLeaveType = (payload: LeaveTypePayload) => unwrap(client.post('/attendance/config/leave-types', payload))
export const updateLeaveType = (id: number, payload: Partial<LeaveTypePayload>) =>
  unwrap(client.put(`/attendance/config/leave-types/${id}`, payload))
export const deleteLeaveType = (id: number) => unwrap(client.delete(`/attendance/config/leave-types/${id}`))

export const listRosters = (params: { start_date: string; end_date: string }) =>
  unwrap(
    client.get('/attendance/config/rosters', {
      params,
    }),
  )

export const setRosters = (items: RosterItemPayload[]) => unwrap(client.post('/attendance/config/rosters', items))

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

export const listFences = () => unwrap<GeoFence[]>(client.get('/attendance/config/fences'))
export const createFence = (payload: GeoFencePayload) => unwrap(client.post('/attendance/config/fences', payload))
export const updateFence = (id: number, payload: Partial<GeoFencePayload>) =>
  unwrap(client.put(`/attendance/config/fences/${id}`, payload))
export const deleteFence = (id: number) => unwrap(client.delete(`/attendance/config/fences/${id}`))


