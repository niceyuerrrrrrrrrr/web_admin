import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const { data } = await promise
  if (data.code !== 200) {
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

export interface FinARRecord {
  id: number
  code?: string
  company_id: number
  customer_id: number
  source_type?: string
  source_id?: number
  ar_type?: string
  ar_amount_cents: number
  received_amount_cents: number
  occur_date: string
  due_date?: string
  status: string
  remark?: string
  created_at?: string
}

export interface FinAPRecord {
  id: number
  code?: string
  company_id: number
  supplier_id: number
  source_type?: string
  source_id?: number
  ap_type?: string
  ap_amount_cents: number
  paid_amount_cents: number
  occur_date: string
  due_date?: string
  status: string
  remark?: string
  created_at?: string
}

export const AR_STATUS_OPTIONS = [
  { value: 'unpaid', label: '未收款' },
  { value: 'partial', label: '部分收款' },
  { value: 'settled', label: '已结清' },
  { value: 'void', label: '已作废' },
]

export const AP_STATUS_OPTIONS = [
  { value: 'unpaid', label: '未付款' },
  { value: 'partial', label: '部分付款' },
  { value: 'settled', label: '已结清' },
  { value: 'void', label: '已作废' },
]

// 应收单列表
export const fetchARList = async (params: {
  companyId?: number
  customerId?: number
  status?: string
  beginDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) => {
  return unwrap<{ records: FinARRecord[]; total: number; page: number; page_size: number }>(
    client.get('/fin/ar', {
      params: {
        company_id: params.companyId,
        customer_id: params.customerId,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    })
  )
}

// 应收单详情
export const fetchARDetail = async (id: number, params?: { companyId?: number }) => {
  return unwrap<FinARRecord>(
    client.get(`/fin/ar/${id}`, {
      params: { company_id: params?.companyId },
    })
  )
}

// 创建应收单
export const createAR = async (data: {
  companyId?: number
  customer_id: number
  source_type?: string
  source_id?: number
  ar_type?: string
  ar_amount_cents: number
  occur_date: string
  due_date?: string
  remark?: string
  attachments?: any
}) => {
  return unwrap<{ id: number }>(
    client.post(
      '/fin/ar',
      {
        customer_id: data.customer_id,
        source_type: data.source_type,
        source_id: data.source_id,
        ar_type: data.ar_type,
        ar_amount_cents: data.ar_amount_cents,
        occur_date: data.occur_date,
        due_date: data.due_date,
        remark: data.remark,
        attachments: data.attachments,
      },
      { params: { company_id: data.companyId } }
    )
  )
}

// 应付单列表
export const fetchAPList = async (params: {
  companyId?: number
  supplierId?: number
  status?: string
  beginDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) => {
  return unwrap<{ records: FinAPRecord[]; total: number; page: number; page_size: number }>(
    client.get('/fin/ap', {
      params: {
        company_id: params.companyId,
        supplier_id: params.supplierId,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    })
  )
}

// 应付单详情
export const fetchAPDetail = async (id: number, params?: { companyId?: number }) => {
  return unwrap<FinAPRecord>(
    client.get(`/fin/ap/${id}`, {
      params: { company_id: params?.companyId },
    })
  )
}

// 创建应付单
export const createAP = async (data: {
  companyId?: number
  supplier_id: number
  source_type?: string
  source_id?: number
  ap_type?: string
  ap_amount_cents: number
  occur_date: string
  due_date?: string
  remark?: string
  attachments?: any
}) => {
  return unwrap<{ id: number }>(
    client.post(
      '/fin/ap',
      {
        supplier_id: data.supplier_id,
        source_type: data.source_type,
        source_id: data.source_id,
        ap_type: data.ap_type,
        ap_amount_cents: data.ap_amount_cents,
        occur_date: data.occur_date,
        due_date: data.due_date,
        remark: data.remark,
        attachments: data.attachments,
      },
      { params: { company_id: data.companyId } }
    )
  )
}

// 从应付单创建付款单
export const createAPPayment = async (data: {
  apId: number
  companyId?: number
  pay_amount: number
  pay_date: string
  pay_method: string
  account_id: number
  remark?: string
}) => {
  return unwrap<{ payment_code: string; status: string }>(
    client.post(
      `/fin/ap/${data.apId}/create-payment`,
      {
        pay_amount: data.pay_amount,
        pay_date: data.pay_date,
        pay_method: data.pay_method,
        account_id: data.account_id,
        remark: data.remark,
      },
      { params: { company_id: data.companyId } }
    )
  )
}
