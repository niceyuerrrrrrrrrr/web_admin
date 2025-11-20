import client from '../client'
import type { ApiResponse, MaterialIncomeCalculation, MaterialType } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchMaterialTypes = (params?: { is_active?: boolean; companyId?: number }) =>
  unwrap<MaterialType[]>(
    client.get('/material-pricing/types', {
      params: {
        is_active: params?.is_active,
        company_id: params?.companyId,
      },
    }),
  )

export const createMaterialType = (data: {
  name: string
  spec?: string
  unit_price: number
  freight_price: number
  description?: string
  is_active?: boolean
}) => unwrap<MaterialType>(client.post('/material-pricing/types', data))

export const updateMaterialType = (
  id: number,
  data: Partial<{
    name: string
    spec: string
    unit_price: number
    freight_price: number
    description: string
    is_active: boolean
  }>,
) => unwrap<MaterialType>(client.put(`/material-pricing/types/${id}`, data))

export const deleteMaterialType = (id: number) => unwrap(client.delete(`/material-pricing/types/${id}`))

export const calculateMaterialIncome = (data: {
  task_id?: number
  unloading_receipt_id?: number
  material_name?: string
  net_weight?: number
}) => unwrap<MaterialIncomeCalculation>(client.post('/material-pricing/calculate', data))

