import client from '../client'
import type {
  ApiResponse,
  FinCashInDetail,
  FinCashInListResponse,
  FinCashOutDetail,
  FinCashOutListResponse,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const CASH_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

export const fetchCashInList = (params?: {
  companyId?: number
  status?: string
  beginDate?: string
  endDate?: string
  accountId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<FinCashInListResponse>(
    client.get('/fin/cash-in', {
      params: {
        company_id: params?.companyId,
        status: params?.status,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        account_id: params?.accountId,
        page: params?.page ?? 1,
        page_size: params?.pageSize ?? 20,
      },
    }),
  )

export const fetchCashOutList = (params?: {
  companyId?: number
  status?: string
  beginDate?: string
  endDate?: string
  accountId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<FinCashOutListResponse>(
    client.get('/fin/cash-out', {
      params: {
        company_id: params?.companyId,
        status: params?.status,
        begin_date: params?.beginDate,
        end_date: params?.endDate,
        account_id: params?.accountId,
        page: params?.page ?? 1,
        page_size: params?.pageSize ?? 20,
      },
    }),
  )

export const fetchCashInDetail = (id: number, params?: { companyId?: number }) =>
  unwrap<FinCashInDetail>(
    client.get(`/fin/cash-in/${id}`, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const fetchCashOutDetail = (id: number, params?: { companyId?: number }) =>
  unwrap<FinCashOutDetail>(
    client.get(`/fin/cash-out/${id}`, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const createCashIn = (data: {
  account_id: number
  payer_type?: string
  payer_id?: number
  amount_cents: number
  cash_date: string
  method?: string
  biz_type?: string
  biz_id?: number
  remark?: string
  attachments?: string[]
  companyId?: number
}) =>
  unwrap<{ id: number; status: string }>(
    client.post('/fin/cash-in', data, {
      params: {
        company_id: data.companyId,
      },
    }),
  )

export const createCashOut = (data: {
  account_id: number
  payee_type?: string
  payee_id?: number
  amount_cents: number
  cash_date: string
  method?: string
  biz_type?: string
  biz_id?: number
  remark?: string
  attachments?: string[]
  companyId?: number
}) =>
  unwrap<{ id: number; status: string }>(
    client.post('/fin/cash-out', data, {
      params: {
        company_id: data.companyId,
      },
    }),
  )

export const submitCashIn = (id: number, params?: { companyId?: number }) =>
  unwrap<{ id: number; status: string }>(
    client.post(`/fin/cash-in/${id}/submit`, null, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const submitCashOut = (id: number, params?: { companyId?: number }) =>
  unwrap<{ id: number; status: string }>(
    client.post(`/fin/cash-out/${id}/submit`, null, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )
