import client from '../client'
import type {
  ApiResponse,
  FinAccountCashflowResponse,
  FinAccountRecord,
  FinCategoryRecord,
  FinCustomerRecord,
  FinSupplierRecord,
} from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchFinAccounts = (params?: { companyId?: number; activeOnly?: boolean }) =>
  unwrap<{ records: FinAccountRecord[] }>(
    client.get('/fin/accounts', {
      params: {
        company_id: params?.companyId,
        active_only: params?.activeOnly ?? true,
      },
    }),
  )

export const createFinAccount = (data: {
  name: string
  type?: string
  opening_balance_cents?: number
  is_active?: number
  remark?: string
  companyId?: number
}) =>
  unwrap<FinAccountRecord>(
    client.post(
      '/fin/accounts',
      {
        name: data.name,
        type: data.type,
        opening_balance_cents: data.opening_balance_cents,
        is_active: data.is_active,
        remark: data.remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const updateFinAccount = (
  id: number,
  data: {
    name?: string
    type?: string
    opening_balance_cents?: number
    is_active?: number
    remark?: string
    companyId?: number
  },
) =>
  unwrap<FinAccountRecord>(
    client.put(
      `/fin/accounts/${id}`,
      {
        name: data.name,
        type: data.type,
        opening_balance_cents: data.opening_balance_cents,
        is_active: data.is_active,
        remark: data.remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const toggleFinAccountActive = (id: number, data: { is_active: number; companyId?: number }) =>
  unwrap<{ id: number; is_active: number }>(
    client.post(
      `/fin/accounts/${id}/toggle-active`,
      { is_active: data.is_active },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const fetchFinAccountCashflows = (id: number, params?: { companyId?: number }) =>
  unwrap<FinAccountCashflowResponse>(
    client.get(`/fin/accounts/${id}/cashflows`, {
      params: {
        company_id: params?.companyId,
      },
    }),
  )

export const fetchFinCategories = (params?: { companyId?: number; parentId?: number | null; activeOnly?: boolean }) =>
  unwrap<{ records: FinCategoryRecord[] }>(
    client.get('/fin/categories', {
      params: {
        company_id: params?.companyId,
        parent_id: typeof params?.parentId === 'number' ? params?.parentId : undefined,
        active_only: params?.activeOnly ?? true,
      },
    }),
  )

export const createFinCategory = (data: {
  name: string
  parent_id?: number
  sort_order?: number
  is_active?: number
  companyId?: number
}) =>
  unwrap<FinCategoryRecord>(
    client.post(
      '/fin/categories',
      {
        name: data.name,
        parent_id: data.parent_id,
        sort_order: data.sort_order,
        is_active: data.is_active,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const updateFinCategory = (
  id: number,
  data: {
    name?: string
    sort_order?: number
    is_active?: number
    parent_id?: number | null
    companyId?: number
  },
) =>
  unwrap<FinCategoryRecord>(
    client.put(
      `/fin/categories/${id}`,
      {
        name: data.name,
        sort_order: data.sort_order,
        is_active: data.is_active,
        parent_id: data.parent_id,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const toggleFinCategoryActive = (id: number, data: { is_active: number; companyId?: number }) =>
  unwrap<{ id: number; is_active: number }>(
    client.post(
      `/fin/categories/${id}/toggle-active`,
      {
        is_active: data.is_active,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const fetchFinSuppliers = (params?: { companyId?: number; keyword?: string; activeOnly?: boolean }) =>
  unwrap<{ records: FinSupplierRecord[] }>(
    client.get('/fin/suppliers', {
      params: {
        company_id: params?.companyId,
        keyword: params?.keyword,
        active_only: params?.activeOnly ?? true,
      },
    }),
  )

export const createFinSupplier = (data: {
  name: string
  contact_name?: string
  contact_phone?: string
  settlement_terms?: string
  bank_info?: string
  is_active?: number
  remark?: string
  companyId?: number
}) =>
  unwrap<FinSupplierRecord>(
    client.post(
      '/fin/suppliers',
      {
        name: data.name,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        settlement_terms: data.settlement_terms,
        bank_info: data.bank_info,
        is_active: data.is_active,
        remark: data.remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const updateFinSupplier = (
  id: number,
  data: Partial<Omit<FinSupplierRecord, 'id' | 'company_id'>> & { companyId?: number },
) =>
  unwrap<FinSupplierRecord>(
    client.put(
      `/fin/suppliers/${id}`,
      {
        name: (data as any).name,
        contact_name: (data as any).contact_name,
        contact_phone: (data as any).contact_phone,
        settlement_terms: (data as any).settlement_terms,
        bank_info: (data as any).bank_info,
        is_active: (data as any).is_active,
        remark: (data as any).remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const toggleFinSupplierActive = (id: number, data: { is_active: number; companyId?: number }) =>
  unwrap<{ id: number; is_active: number }>(
    client.post(
      `/fin/suppliers/${id}/toggle-active`,
      { is_active: data.is_active },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const fetchFinCustomers = (params?: { companyId?: number; keyword?: string; activeOnly?: boolean }) =>
  unwrap<{ records: FinCustomerRecord[] }>(
    client.get('/fin/customers', {
      params: {
        company_id: params?.companyId,
        keyword: params?.keyword,
        active_only: params?.activeOnly ?? true,
      },
    }),
  )

export const createFinCustomer = (data: {
  name: string
  contact_name?: string
  contact_phone?: string
  billing_title?: string
  tax_no?: string
  settlement_terms?: string
  credit_limit_cents?: number | null
  is_active?: number
  remark?: string
  companyId?: number
}) =>
  unwrap<FinCustomerRecord>(
    client.post(
      '/fin/customers',
      {
        name: data.name,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        billing_title: data.billing_title,
        tax_no: data.tax_no,
        settlement_terms: data.settlement_terms,
        credit_limit_cents: data.credit_limit_cents,
        is_active: data.is_active,
        remark: data.remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const updateFinCustomer = (
  id: number,
  data: Partial<Omit<FinCustomerRecord, 'id' | 'company_id'>> & {
    billing_title?: string
    tax_no?: string
    settlement_terms?: string
    credit_limit_cents?: number | null
    remark?: string
    companyId?: number
  },
) =>
  unwrap<FinCustomerRecord>(
    client.put(
      `/fin/customers/${id}`,
      {
        name: (data as any).name,
        contact_name: (data as any).contact_name,
        contact_phone: (data as any).contact_phone,
        billing_title: (data as any).billing_title,
        tax_no: (data as any).tax_no,
        settlement_terms: (data as any).settlement_terms,
        credit_limit_cents: (data as any).credit_limit_cents,
        is_active: (data as any).is_active,
        remark: (data as any).remark,
      },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )

export const toggleFinCustomerActive = (id: number, data: { is_active: number; companyId?: number }) =>
  unwrap<{ id: number; is_active: number }>(
    client.post(
      `/fin/customers/${id}/toggle-active`,
      { is_active: data.is_active },
      {
        params: {
          company_id: data.companyId,
        },
      },
    ),
  )
