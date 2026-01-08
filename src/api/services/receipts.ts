import client from '../client'
import type { ApiResponse } from '../types'
import type {
  ChargingReceipt,
  LoadingReceipt,
  Receipt,
  ReceiptListParams,
  ReceiptType,
  UnloadingReceipt,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const RECEIPT_TYPES: Array<{ value: ReceiptType; label: string }> = [
  { value: 'loading', label: '装料单' },
  { value: 'unloading', label: '卸货单' },
  { value: 'charging', label: '充电单' },
  { value: 'water', label: '水票' },
  { value: 'departure', label: '出厂单' },
]

/**
 * 获取票据列表
 * user_id 可选，不传则查询所有票据（需要管理员权限）
 * scope: 'mine' 只获取当前用户数据，'all' 获取全部数据
 * department_id 可选，按部门筛选
 */
export const fetchReceipts = (params: ReceiptListParams & { userId?: number; scope?: 'mine' | 'all'; departmentId?: number }) =>
  unwrap<Receipt[]>(
    client.get('/receipts', {
      params: {
        user_id: params.userId,
        receipt_type: params.receiptType,
        start_date: params.startDate,
        end_date: params.endDate,
        vehicle_no: params.vehicleNo,
        tanker_vehicle_code: params.tankerVehicleCode,
        company_id: params.companyId,
        department_id: params.departmentId,
        scope: params.scope || 'all', // 默认获取全部数据
        deleted_status: params.deletedStatus || 'normal', // 默认只显示正常票据
      },
    }),
  )

/**
 * 获取所有票据（管理端使用，需要后端支持或通过用户列表遍历）
 * 暂时使用当前用户ID，后续可扩展为获取所有用户的票据
 */
export const fetchAllReceipts = (params: Omit<ReceiptListParams, 'userId'>) =>
  unwrap<Receipt[]>(
    client.get('/receipts', {
      params: {
        user_id: 0, // 占位符，实际需要后端支持管理端查询所有票据
        receipt_type: params.receiptType,
        start_date: params.startDate,
        end_date: params.endDate,
        company_id: params.companyId,
      },
    }),
  )

/**
 * 获取水票列表
 */
export const fetchWaterTickets = (params: { userId: number; startDate?: string; endDate?: string }) =>
  unwrap<{ tickets: Receipt[] }>(
    client.get('/receipts/water_tickets', {
      params: {
        user_id: params.userId,
        start_date: params.startDate,
        end_date: params.endDate,
      },
    }),
  )

/**
 * 创建装料单
 */
export const createLoadingReceipt = (data: {
  user_id: number
  company?: string
  driver_name?: string
  vehicle_no?: string
  material_name?: string
  material_spec?: string
  gross_weight?: number
  net_weight?: number
  tare_weight?: number
  loading_time?: string
  unloading_time?: string
  thumb_url?: string
}) => unwrap<LoadingReceipt>(client.post('/receipts/loading', data))

/**
 * 创建卸货单
 */
export const createUnloadingReceipt = (data: {
  user_id: number
  company?: string
  driver_name?: string
  vehicle_no?: string
  material_name?: string
  material_spec?: string
  gross_weight?: number
  net_weight?: number
  tare_weight?: number
  loading_time?: string
  unloading_time?: string
  task_id?: string
  thumb_url?: string
}) => unwrap<UnloadingReceipt>(client.post('/receipts/unloading', data))

/**
 * 创建充电单
 */
export const createChargingReceipt = (data: {
  user_id: number
  receipt_number?: string
  vehicle_no?: string
  charging_station?: string
  charging_pile?: string
  energy_kwh?: number
  amount?: number
  start_time?: string
  end_time?: string
  duration_min?: number
  thumb_url?: string
}) => unwrap<ChargingReceipt>(client.post('/receipts/charging', data))

/**
 * 更新充电单
 */
export const updateChargingReceipt = (
  receiptId: number,
  data: {
    receipt_number?: string
    vehicle_no?: string
    charging_station?: string
    charging_pile?: string
    energy_kwh?: number
    amount?: number
    start_time?: string
    end_time?: string
    duration_min?: number
    thumb_url?: string
  },
) => unwrap<ChargingReceipt>(client.put(`/receipts/charging/${receiptId}`, data))

/**
 * 创建水票
 */
export const createWaterTicket = (data: {
  user_id: number
  company_name?: string
  vehicle_no?: string
  ticket_date?: string
  image_path?: string
}) => unwrap<{ id: number }>(client.post('/receipts/water_tickets', data))

/**
 * 更新水票
 */
export const updateWaterTicket = (
  ticketId: number,
  data: {
    company_name?: string
    vehicle_no?: string
    ticket_date?: string
    image_path?: string
  },
) => unwrap<{ id: number }>(client.put(`/receipts/water_tickets/${ticketId}`, data))

/**
 * 删除水票
 */
export const deleteWaterTicket = (ticketId: number) =>
  unwrap(client.delete(`/receipts/water_tickets/${ticketId}`))

/**
 * 更新装料单
 */
export const updateLoadingReceipt = (
  receiptId: number,
  data: {
    company?: string
    driver_name?: string
    vehicle_no?: string
    material_name?: string
    material_spec?: string
    gross_weight?: number
    net_weight?: number
    tare_weight?: number
    loading_time?: string
    unloading_time?: string
    thumb_url?: string
  },
) => unwrap<LoadingReceipt>(client.put(`/receipts/loading/${receiptId}`, data))

/**
 * 删除装料单
 */
export const deleteLoadingReceipt = (receiptId: number) =>
  unwrap(client.delete(`/receipts/loading/${receiptId}`))

/**
 * 更新卸货单
 */
export const updateUnloadingReceipt = (
  receiptId: number,
  data: {
    company?: string
    driver_name?: string
    vehicle_no?: string
    material_name?: string
    material_spec?: string
    gross_weight?: number
    net_weight?: number
    tare_weight?: number
    loading_time?: string
    unloading_time?: string
    thumb_url?: string
  },
) => unwrap<UnloadingReceipt>(client.put(`/receipts/unloading/${receiptId}`, data))

/**
 * 删除卸货单
 */
export const deleteUnloadingReceipt = (receiptId: number) =>
  unwrap(client.delete(`/receipts/unloading/${receiptId}`))

/**
 * 删除充电单
 */
export const deleteChargingReceipt = (receiptId: number) =>
  unwrap(client.delete(`/receipts/charging/${receiptId}`))

/**
 * 更新出厂单
 */
export const updateDepartureReceipt = (
  receiptId: number,
  data: {
    driver_name?: string
    vehicle_no?: string
    tanker_vehicle_code?: string
    loading_company?: string
    project_name?: string
    construction_location?: string
    customer_name?: string
    construction_unit?: string
    concrete_strength?: string
    slump?: string
    concrete_volume?: string
    settlement_volume?: string
    total_volume?: string
    total_vehicles?: string
    bill_no?: string
    loading_time?: string
    exit_time?: string
    production_date?: string
  },
) => unwrap(client.put(`/receipts/departure/${receiptId}`, data))

/**
 * 删除出厂单
 */
export const deleteDepartureReceipt = (receiptId: number) =>
  unwrap(client.delete(`/receipts/departure/${receiptId}`))

/**
 * 获取已匹配的装卸数据列表
 */
export const fetchMatchedReceipts = (params: {
  userId?: number
  startDate?: string
  endDate?: string
  companyId?: number
  scope?: 'mine' | 'all'
}) =>
  unwrap<Array<{
    id: number
    task_id: string
    status: string
    loadBill: any
    unloadBill: any
    created_at?: string
    finished_at?: string
    updated_at?: string
  }>>(
    client.get('/receipts/matched-receipts', {
      params: {
        user_id: params.userId,
        start_date: params.startDate,
        end_date: params.endDate,
        company_id: params.companyId,
        scope: params.scope || 'all', // 默认获取全部数据
      },
    }),
  )

/**
 * 删除运输任务（装卸匹配）
 */
export const deleteTransportTask = (taskId: string) =>
  unwrap(client.delete(`/transport-match/${taskId}`))

/**
 * 交票（单张）
 */
export const submitReceiptToFinance = (receiptType: string, receiptId: number) =>
  unwrap(client.post(`/receipts/submit-to-finance/single?receipt_type=${receiptType}&receipt_id=${receiptId}`))

/**
 * 批量交票
 */
export const submitReceiptsToFinance = (receiptType: string, receiptIds: number[]) =>
  unwrap(client.post(`/receipts/submit-to-finance?receipt_type=${receiptType}`, { receipt_ids: receiptIds }))

/**
 * 恢复票据
 */
export const restoreReceipt = (receiptType: string, receiptId: number) => {
  const typeMap: Record<string, string> = {
    loading: 'loading',
    unloading: 'unloading',
    charging: 'charging',
    water: 'water_tickets',
    departure: 'departure',
  }
  const path = typeMap[receiptType] || receiptType
  return unwrap(client.post(`/receipts/${path}/${receiptId}/restore`))
}

