import client from '../client'
import type { ApiResponse, LoginPayload, LoginResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const login = (payload: LoginPayload) => unwrap<LoginResponse>(client.post('/api/v1/auth/login', payload))

