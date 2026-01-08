import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

/**
 * 数据清洗配置类型
 */
export interface DataCleanConfigItem {
  id: number
  values: string[]
  updated_at: string | null
}

export type DataCleanConfigs = Record<string, DataCleanConfigItem>

/**
 * 获取数据清洗配置列表
 */
export const fetchDataCleanConfigs = (companyId?: number) =>
  unwrap<DataCleanConfigs>(
    client.get('/data-clean-config', {
      params: { company_id: companyId },
    })
  )

/**
 * 创建或更新数据清洗配置
 */
export const saveDataCleanConfig = (data: {
  field_type: string
  standard_values: string[]
  company_id?: number
}) =>
  unwrap<{ id: number; field_type: string; message: string }>(
    client.post('/data-clean-config', data, {
      params: { company_id: data.company_id },
    })
  )

/**
 * 删除数据清洗配置
 */
export const deleteDataCleanConfig = (fieldType: string, companyId?: number) =>
  unwrap<{ message: string }>(
    client.delete(`/data-clean-config/${fieldType}`, {
      params: { company_id: companyId },
    })
  )
