import client from '../client'

export interface SmallVolumeRule {
  id: number
  company_id: number
  rule_type: 'loading_company' | 'department'
  loading_company?: string
  department_id?: number
  department_name?: string
  threshold: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SmallVolumeRuleCreate {
  rule_type: 'loading_company' | 'department'
  loading_company?: string
  department_id?: number
  threshold: number
}

export interface SmallVolumeRuleUpdate {
  rule_type?: 'loading_company' | 'department'
  loading_company?: string
  department_id?: number
  threshold?: number
  is_active?: boolean
}

export const fetchSmallVolumeRules = async (companyId?: number, ruleType?: string) => {
  const params = new URLSearchParams()
  if (companyId) params.append('company_id', companyId.toString())
  if (ruleType) params.append('rule_type', ruleType)
  
  const response = await client.get(`/receipts/small-volume-rules?${params.toString()}`)
  return response.data.data as SmallVolumeRule[]
}

export const createSmallVolumeRule = async (data: SmallVolumeRuleCreate, companyId?: number) => {
  const params = companyId ? `?company_id=${companyId}` : ''
  const response = await client.post(`/receipts/small-volume-rules${params}`, data)
  return response.data.data as SmallVolumeRule
}

export const updateSmallVolumeRule = async (ruleId: number, data: SmallVolumeRuleUpdate) => {
  const response = await client.put(`/receipts/small-volume-rules/${ruleId}`, data)
  return response.data.data as SmallVolumeRule
}

export const deleteSmallVolumeRule = async (ruleId: number) => {
  await client.delete(`/receipts/small-volume-rules/${ruleId}`)
}
