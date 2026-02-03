import client from '../client'

export interface DistancePriceRule {
  min_distance: number
  max_distance?: number
  tax_rate: number  // 税率（%）
  price_with_tax: number  // 含税价格（元/方）
}

export interface PriceConfig {
  id?: number
  company_id?: number  // 公司ID
  loading_company: string
  distance_price_rules: DistancePriceRule[]  // 分段定价规则
  tax_rate?: number  // 递增定价的税率（%）
  base_price?: number  // 递增定价的底价（元/方）
  increment_per_km?: number  // 超出基础运距后每公里增加价格（元）
  base_distance?: number  // 基础运距（km）
  small_volume_price?: number
  water_ticket_price?: number
  water_ticket_company?: string  // 关联的水票公司名称
  full_return_price?: number
  effective_date: string
  expiry_date?: string
  reconciliation_cycle_type?: string  // 对账周期类型: monthly, natural_month, weekly
  reconciliation_start_day?: number  // 开始日期
  reconciliation_start_time?: string  // 开始时间 HH:MM:SS
  reconciliation_end_day?: number  // 结束日期
  reconciliation_end_time?: string  // 结束时间 HH:MM:SS
  is_active?: string
  remarks?: string
  created_at?: string
}

export interface SettlementItem {
  project_name: string  // 工程名称（项目名称）
  loading_company: string
  trips: number  // 趟次
  volume: number  // 总方量
  distance: number  // 平均运距
  price: number  // 单价（元/方）
  amount: number  // 金额
  amount_without_tax: number  // 不含税金额
}

export interface SettlementSummaryItem {
  item_type: string  // 类型：small_volume（小方量/砂浆）、water（水票）、full_return（整车退料）
  trips: number  // 趟次
  volume: number  // 总方量（水票无方量）
  price: number  // 单价（元/趟）
  amount: number  // 金额
}

export interface SettlementStatement {
  start_date: string
  end_date: string
  department_name?: string
  items: SettlementItem[]  // 按工程分组的正常方量明细
  summary_items: SettlementSummaryItem[]  // 汇总项：小方量、水票、整车退料
  total_amount: number
  generated_at: string
}

export interface GenerateSettlementRequest {
  start_date: string
  end_date: string
  loading_company: string  // 装料公司名称（必选）
  company_id?: number  // 公司ID（超级管理员需要传递）
  department_id?: number
}

// 创建单价配置
export const createPriceConfig = (data: Omit<PriceConfig, 'id' | 'created_at'>) => {
  return client.post('/settlement/price-configs', data)
}

// 获取单价配置列表
export const getPriceConfigs = (params: {
  company_id?: number
  loading_company?: string
  is_active?: string
  page?: number
  page_size?: number
}) => {
  return client.get('/settlement/price-configs', { params })
}

// 更新单价配置
export const updatePriceConfig = (id: number, data: Partial<PriceConfig>) => {
  return client.put(`/settlement/price-configs/${id}`, data)
}

// 删除单价配置
export const deletePriceConfig = (id: number) => {
  return client.delete(`/settlement/price-configs/${id}`)
}

// 生成结算单
export const generateSettlement = (data: GenerateSettlementRequest) => {
  return client.post('/settlement/generate', data)
}
