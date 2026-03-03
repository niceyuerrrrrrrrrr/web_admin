import client from '../client'
import type { ApiResponse } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const { data } = await promise
  if (data.code !== 200) {
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

export interface FinARReceiptRecord {
  id: number
  code?: string
  company_id: number
  ar_id: number
  customer_id?: number
  receipt_amount_cents: number
  receipt_date: string
  receipt_method?: string
  account_id: number
  status: string
  cash_in_id?: number
  created_at?: string
}

export interface FinAPPaymentRecord {
  id: number
  code?: string
  company_id: number
  ap_id: number
  supplier_id?: number
  pay_amount_cents: number
  pay_date: string
  pay_method?: string
  account_id: number
  status: string
  cash_out_id?: number
  created_at?: string
}

export const RECEIPT_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'void', label: '已作废' },
]

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'reviewing', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'void', label: '已作废' },
]

// 应收回款列表
export const fetchARReceiptList = async (params: {
  companyId?: number
  arId?: number
  status?: string
  beginDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) => {
  return unwrap<{ records: FinARReceiptRecord[]; total: number; page: number; page_size: number }>(
    client.get('/fin/ar-receipts', {
      params: {
        company_id: params.companyId,
        ar_id: params.arId,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    })
  )
}

// 应收回款详情
export const fetchARReceiptDetail = async (id: number, params?: { companyId?: number }) => {
  return unwrap<FinARReceiptRecord>(
    client.get(`/fin/ar-receipts/${id}`, {
      params: { company_id: params?.companyId },
    })
  )
}

// 创建应收回款
export const createARReceipt = async (data: {
  companyId?: number
  ar_id: number
  customer_id?: number
  receipt_amount_cents: number
  receipt_date: string
  receipt_method?: string
  account_id: number
  remark?: string
  attachments?: any
}) => {
  return unwrap<{ id: number }>(
    client.post(
      '/fin/ar-receipts',
      {
        ar_id: data.ar_id,
        customer_id: data.customer_id,
        receipt_amount_cents: data.receipt_amount_cents,
        receipt_date: data.receipt_date,
        receipt_method: data.receipt_method,
        account_id: data.account_id,
        remark: data.remark,
        attachments: data.attachments,
      },
      { params: { company_id: data.companyId } }
    )
  )
}

// 提交应收回款审批
export const submitARReceipt = async (id: number, params?: { companyId?: number }) => {
  return unwrap<{ id: number }>(
    client.post(`/fin/ar-receipts/${id}/submit`, {}, { params: { company_id: params?.companyId } })
  )
}

// 应付实付列表
export const fetchAPPaymentList = async (params: {
  companyId?: number
  apId?: number
  status?: string
  beginDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) => {
  return unwrap<{ records: FinAPPaymentRecord[]; total: number; page: number; page_size: number }>(
    client.get('/fin/ap-payments', {
      params: {
        company_id: params.companyId,
        ap_id: params.apId,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        page: params.page || 1,
        page_size: params.pageSize || 20,
      },
    })
  )
}

// 应付实付详情
export const fetchAPPaymentDetail = async (id: number, params?: { companyId?: number }) => {
  return unwrap<FinAPPaymentRecord>(
    client.get(`/fin/ap-payments/${id}`, {
      params: { company_id: params?.companyId },
    })
  )
}

// 创建应付实付
export const createAPPayment = async (data: {
  companyId?: number
  ap_id: number
  supplier_id?: number
  pay_amount_cents: number
  pay_date: string
  pay_method?: string
  account_id: number
  remark?: string
  attachments?: any
}) => {
  return unwrap<{ id: number }>(
    client.post(
      '/fin/ap-payments',
      {
        ap_id: data.ap_id,
        supplier_id: data.supplier_id,
        pay_amount_cents: data.pay_amount_cents,
        pay_date: data.pay_date,
        pay_method: data.pay_method,
        account_id: data.account_id,
        remark: data.remark,
        attachments: data.attachments,
      },
      { params: { company_id: data.companyId } }
    )
  )
}

// 提交应付实付审批
export const submitAPPayment = async (id: number, params?: { companyId?: number }) => {
  return unwrap<{ id: number }>(
    client.post(`/fin/ap-payments/${id}/submit`, {}, { params: { company_id: params?.companyId } })
  )
}
