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

export const fetchChargingStations = (params?: { is_active?: boolean; companyId?: number }) =>
  unwrap<ChargingStation[]>(
    client.get('/charging-pricing/stations', {
      params: {
        is_active: params?.is_active,
        company_id: params?.companyId,
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

export const deleteChargingStation = (stationId: number, force: boolean = true) =>
  unwrap(client.delete(`/charging-pricing/stations/${stationId}`, {
    params: { force }
  }))

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

export const deleteChargingRule = (ruleId: number, hardDelete: boolean = false) => 
  unwrap(client.delete(`/charging-pricing/rules/${ruleId}`, {
    params: { hard_delete: hardDelete }
  }))

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
  companyId?: number
}) =>
  unwrap<ChargingStatistics>(
    client.get('/charging-pricing/statistics/overview', {
      params: {
        station_id: params?.stationId,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        company_id: params?.companyId,
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

export interface ChargingStatsOverview {
  summary: {
    total_energy: number
    total_amount: number
    avg_price: number
  }
  by_driver: Array<{
    id: number
    name: string
    energy: number
    amount: number
    count: number
    avg_price: number
  }>
  by_vehicle: Array<{
    vehicle_no: string
    energy: number
    amount: number
    count: number
    avg_price: number
  }>
}

export const fetchChargingStatsOverview = (params: { timeRange: string; companyId?: number }) =>
  unwrap<ChargingStatsOverview>(
    client.get('/statistics/charging/overview', {
      params: {
        time_range: params.timeRange,
        company_id: params.companyId,
      },
    }),
  )

export interface ChargingTrendData {
  daily_trend: Array<{
    date: string
    energy: number
    amount: number
    count: number
  }>
}

export const fetchChargingTrend = (params: { timeRange: string; companyId?: number }) =>
  unwrap<ChargingTrendData>(
    client.get('/statistics/charging/trend', {
      params: {
        time_range: params.timeRange,
        company_id: params.companyId,
      },
    }),
  )

export interface ChargingHourlyDistribution {
  hourly_distribution: Array<{
    time: string
    count: number
    minute: number
  }>
  statistics: {
    max_count: number
    avg_count: number
    peak_hours: number[]
    valley_hours: number[]
  }
}

export const fetchChargingHourlyDistribution = (params: { timeRange: string; companyId?: number }) =>
  unwrap<ChargingHourlyDistribution>(
    client.get('/statistics/charging/hourly-distribution', {
      params: {
        time_range: params.timeRange,
        company_id: params.companyId,
      },
    }),
  )

