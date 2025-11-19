import client from '../client'
import type {
  ApiResponse,
  ChargingCostResult,
  ChargingPriceRule,
  ChargingStation,
  ChargingStatistics,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchChargingStations = (params?: { is_active?: boolean }) =>
  unwrap<ChargingStation[]>(
    client.get('/charging-pricing/stations', {
      params: {
        is_active: params?.is_active,
      },
    }),
  )

export const createChargingStation = (data: {
  station_name: string
  station_code?: string
  location?: string
  contact_person?: string
  contact_phone?: string
  description?: string
}) => unwrap<{ id: number }>(client.post('/charging-pricing/stations', data))

export const updateChargingStation = (stationId: number, data: Partial<ChargingStation>) =>
  unwrap(client.put(`/charging-pricing/stations/${stationId}`, data))

export const deleteChargingStation = (stationId: number) =>
  unwrap(client.delete(`/charging-pricing/stations/${stationId}`))

export const fetchChargingRules = (stationId: number) =>
  unwrap<ChargingPriceRule[]>(client.get(`/charging-pricing/stations/${stationId}/rules`))

export const createChargingRule = (stationId: number, data: {
  time_period_start: string
  time_period_end: string
  price_per_kwh: number
  priority?: number
  description?: string
  effective_date?: string
  expiry_date?: string
  is_active?: boolean
}) => unwrap<{ id: number }>(client.post(`/charging-pricing/stations/${stationId}/rules`, data))

export const updateChargingRule = (ruleId: number, data: Partial<{
  time_period_start: string
  time_period_end: string
  price_per_kwh: number
  priority: number
  description: string
  effective_date: string
  expiry_date: string
  is_active: boolean
}>) => unwrap(client.put(`/charging-pricing/rules/${ruleId}`, data))

export const deleteChargingRule = (ruleId: number) => unwrap(client.delete(`/charging-pricing/rules/${ruleId}`))

export const fetchChargingRuleHistory = (ruleId: number) =>
  unwrap<
    Array<{
      id: number
      version: number
      action: string
      time_period_start: string
      time_period_end: string
      price_per_kwh: number
      priority: number
      description?: string
      effective_date?: string
      expiry_date?: string
      is_active: boolean
      changed_by_id?: number
      changed_at?: string
    }>
  >(client.get(`/charging-pricing/rules/${ruleId}/history`))

export interface ChargingRuleTableRow {
  id?: number
  time_period_start: string
  time_period_end: string
  price_per_kwh: number
  priority?: number
  description?: string
  effective_date?: string
  expiry_date?: string
  is_active?: boolean
}

export const saveRuleTable = (stationId: number, rows: ChargingRuleTableRow[]) =>
  unwrap(client.put(`/charging-pricing/stations/${stationId}/rule-table`, { rows }))

export const fetchChargingStatistics = (params?: {
  stationId?: number
  beginDate?: string
  endDate?: string
}) =>
  unwrap<ChargingStatistics>(
    client.get('/charging-pricing/statistics/overview', {
      params: {
        station_id: params?.stationId,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
      },
    }),
  )

export const calculateChargingCost = (data: {
  station_id?: number
  station_name?: string
  charging_time?: string
  time_slot?: string
  energy_kwh: number
  fallback_price?: number
  charging_receipt_id?: number
}) => unwrap<ChargingCostResult>(client.post('/charging-pricing/calculate', data))

