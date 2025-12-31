import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

// 车辆信息
export interface Vehicle {
  plate_number: string
  tanker_vehicle_code?: string  // 自编车号（罐车）
  driver_id?: number
  driver_name?: string
  driver_phone?: string
  status: 'active' | 'warning' | 'expired' | 'inactive'
  doc_count: number
  expiring_docs: Array<{
    type: string
    expire_date: string
    days: number
  }>
  expired_docs: Array<{
    type: string
    expire_date: string
    days: number
  }>
}

// 车辆统计
export interface VehicleStatistics {
  total_vehicles: number
  active_vehicles: number
  inactive_vehicles: number
  utilization_rate: number
  expiring_docs_count: number
  expired_docs_count: number
}

// 车牌绑定历史
export interface PlateBindHistory {
  id: number
  user_id: number
  user_name?: string
  previous_plate?: string
  new_plate: string
  changed_by: number
  changed_at: string
}

// 车辆证件
export interface VehicleDocument {
  id: number
  doc_type: string
  doc_no: string
  expire_date?: string
  remark?: string
  created_at?: string
  updated_at?: string
}

// 司机信息
export interface VehicleDriver {
  id: number
  name?: string
  phone?: string
  nickname?: string
  position_type?: string
}

/**
 * 获取车辆列表
 */
export const fetchVehicles = (params?: {
  plateNumber?: string
  status?: string
  companyId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<{
    vehicles: Vehicle[]
    total: number
    page: number
    page_size: number
  }>(
    client.get('/vehicles/list', {
      params: {
        plate_number: params?.plateNumber,
        status: params?.status,
        company_id: params?.companyId,
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
      },
    }),
  )

/**
 * 获取车辆统计
 */
export const fetchVehicleStatistics = () => unwrap<VehicleStatistics>(client.get('/vehicles/statistics'))

/**
 * 获取可绑定的车牌列表
 */
export const fetchAvailablePlates = (params?: { includeDriverDocs?: boolean }) =>
  unwrap<{ plates: string[] }>(
    client.get('/vehicles/plates', {
      params: {
        include_driver_docs: params?.includeDriverDocs ?? true,
      },
    }),
  )

/**
 * 创建车辆
 */
export const createVehicle = (
  data: {
    plate_number: string
    tanker_vehicle_code?: string
    doc_type?: string
    doc_no?: string
    expire_date?: string
    remark?: string
  },
  companyId?: number,
) =>
  unwrap<{
    message: string
    vehicle: {
      plate_number: string
      tanker_vehicle_code?: string
      doc_id: number
    }
  }>(
    client.post('/vehicles/create', data, {
      params: companyId ? { company_id: companyId } : undefined,
    }),
  )

/**
 * 批量创建车辆
 */
export const batchCreateVehicles = (
  data: {
    vehicles: Array<{
      plate_number: string
      tanker_vehicle_code?: string
      doc_type?: string
      doc_no?: string
      expire_date?: string
      remark?: string
    }>
  },
  companyId?: number,
) =>
  unwrap<{
    message: string
    success_count: number
    failed_count: number
    created_vehicles: Array<{
      plate_number: string
      tanker_vehicle_code?: string
      doc_id: number
    }>
    failed_vehicles: Array<{
      plate_number: string
      reason: string
    }>
  }>(
    client.post('/vehicles/batch-create', data, {
      params: companyId ? { company_id: companyId } : undefined,
    }),
  )

/**
 * 绑定车牌
 */
export const bindPlate = (data: { plate_number: string }) =>
  unwrap<{ plateNumber: string }>(client.post('/vehicles/bind_plate', data))

/**
 * 获取车牌绑定历史
 */
export const fetchPlateHistory = (params?: {
  userId?: number
  companyId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<{
    records: PlateBindHistory[]
    total: number
    page: number
    page_size: number
  }>(
    client.get('/vehicles/plate_history', {
      params: {
        user_id: params?.userId,
        company_id: params?.companyId,
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
      },
    }),
  )

/**
 * 获取车辆证件列表
 */
export const fetchVehicleDocuments = (plateNumber: string) =>
  unwrap<{ documents: VehicleDocument[] }>(client.get(`/vehicles/${plateNumber}/documents`))

/**
 * 获取车辆绑定的司机信息
 */
export const fetchVehicleDriver = (plateNumber: string) =>
  unwrap<{ driver: VehicleDriver | null }>(client.get(`/vehicles/${plateNumber}/driver`))

/**
 * 车辆使用记录
 */
export interface VehicleUsageRecord {
  plate: string
  usage: Record<string, { driver_name: string; trip_count: number }>
}

/**
 * 获取车辆使用日历数据
 */
export const fetchVehicleUsageCalendar = async (params: {
  company_id?: number
  start_date: string
  end_date: string
}): Promise<ApiResponse<VehicleUsageRecord[]>> => {
  const response = await client.get('/vehicles/usage-calendar', { params })
  return response.data
}
