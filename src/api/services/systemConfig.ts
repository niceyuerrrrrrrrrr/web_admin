import client from '../client'
import type {
  ApiResponse,
  SystemAttendanceConfig,
  SystemApprovalConfig,
  SystemBaseConfig,
  SystemConfigResponse,
  SystemNotificationConfig,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface SystemConfigPayload {
  base: SystemBaseConfig
  approval: SystemApprovalConfig
  attendance: SystemAttendanceConfig
  notification: SystemNotificationConfig
}

export const fetchSystemConfig = () => unwrap<SystemConfigResponse>(client.get('/system-config'))

export const saveSystemConfig = (payload: SystemConfigPayload) => unwrap(client.post('/system-config', payload))

