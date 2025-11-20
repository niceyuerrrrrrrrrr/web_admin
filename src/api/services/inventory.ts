import client from '../client'
import type {
  ApiResponse,
  InventoryItem,
  InventoryStats,
  StockOperationRecord,
  Warehouse,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchWarehouses = (params?: { status?: string; companyId?: number }) =>
  unwrap<{ records: Warehouse[] }>(
    client.get('/inventory/warehouses', {
      params: {
        status: params?.status,
        company_id: params?.companyId,
      },
    }),
  )

export const createWarehouse = (data: {
  name: string
  code?: string
  address?: string
  manager_id?: number
  description?: string
}) => unwrap<Warehouse>(client.post('/inventory/warehouses', data))

export const updateWarehouse = (warehouseId: number, data: Partial<Warehouse>) =>
  unwrap<Warehouse>(client.put(`/inventory/warehouses/${warehouseId}`, data))

export const fetchInventoryItems = (params?: { warehouseId?: number; materialCode?: string; keyword?: string; companyId?: number }) =>
  unwrap<{ records: InventoryItem[] }>(
    client.get('/inventory/items', {
      params: {
        warehouse_id: params?.warehouseId,
        material_code: params?.materialCode,
        keyword: params?.keyword,
        company_id: params?.companyId,
      },
    }),
  )

export const createInventoryItem = (data: {
  warehouse_id: number
  material_name: string
  material_code?: string
  quantity?: number
  unit?: string
  min_stock?: number
  max_stock?: number
  location?: string
  notes?: string
}) => unwrap(client.post('/inventory/items', data))

export const updateInventoryItem = (itemId: number, data: Partial<InventoryItem>) =>
  unwrap(client.put(`/inventory/items/${itemId}`, data))

export const fetchStockOperations = (params?: {
  warehouseId?: number
  inventoryId?: number
  operationType?: string
  status?: string
  beginDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  companyId?: number
}) =>
  unwrap<{
    records: StockOperationRecord[]
    total: number
    page: number
    page_size: number
    total_pages: number
  }>(
    client.get('/inventory/operations', {
      params: {
        warehouse_id: params?.warehouseId,
        inventory_id: params?.inventoryId,
        operation_type: params?.operationType,
        status: params?.status,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        page: params?.page || 1,
        page_size: params?.pageSize || 20,
        company_id: params?.companyId,
      },
    }),
  )

export const createStockOperation = (data: {
  warehouse_id: number
  inventory_id: number
  operation_type: 'inbound' | 'outbound'
  quantity: number
  unit: string
  operation_date: string
  reason?: string
  related_request_id?: number
  images?: string[]
}) => unwrap(client.post('/inventory/operations', data))

export const fetchInventoryStatistics = (params?: { warehouseId?: number; beginDate?: string; endDate?: string }) =>
  unwrap<InventoryStats>(
    client.get('/inventory/statistics', {
      params: {
        warehouse_id: params?.warehouseId,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
      },
    }),
  )

export const syncOperationFromMaterialRequest = (requestId: number, warehouseId?: number) =>
  unwrap(
    client.post(`/inventory/sync-from-material-request/${requestId}`, null, {
      params: {
        warehouse_id: warehouseId,
      },
    }),
  )

export const uploadInventoryImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return unwrap<{ url: string; filename: string }>(
    client.post('/inventory/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

