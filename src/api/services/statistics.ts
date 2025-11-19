import client from '../client'

const unwrap = async (promise: Promise<{ data: any }>) => {
  const response = await promise
  // 统计API可能返回不同的格式，需要兼容处理
  if (response.data.success === false) {
    throw new Error(response.data.message || '请求失败')
  }
  // 如果直接返回数据，直接返回
  if (response.data.data) {
    return response.data.data
  }
  // 如果没有data字段，直接返回整个response.data
  return response.data
}

/**
 * 获取司机个人统计数据
 */
export const fetchDriverStatistics = (params?: { timeRange?: string }) =>
  unwrap(
    client.get('/statistics/driver', {
      params: {
        time_range: params?.timeRange || 'month',
      },
    }),
  )

/**
 * 获取统计员统计数据
 */
export const fetchStatisticianStatistics = (params?: {
  timeRange?: string
  driverId?: number
  vehicleNo?: string
}) =>
  unwrap(
    client.get('/statistics/statistician', {
      params: {
        time_range: params?.timeRange || 'month',
        driver_id: params?.driverId,
        vehicle_no: params?.vehicleNo,
      },
    }),
  )

/**
 * 获取车队长统计数据
 */
export const fetchFleetManagerStatistics = (params?: { timeRange?: string }) =>
  unwrap(
    client.get('/statistics/fleet-manager', {
      params: {
        time_range: params?.timeRange || 'month',
      },
    }),
  )

/**
 * 获取总经理统计数据
 */
export const fetchCEOStatistics = (params?: { timeRange?: string }) =>
  unwrap(
    client.get('/statistics/ceo', {
      params: {
        time_range: params?.timeRange || 'month',
      },
    }),
  )

