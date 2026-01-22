/**
 * 业务类型工具函数
 * 用于统一处理业务类型的判断和映射
 */

/**
 * 业务类型常量
 */
export const BUSINESS_TYPES = {
  TRAILER: '挂车',
  SIDE_DUMP: '侧翻',
  CEMENT_TANKER: '水泥罐车',
  TANKER: '罐车',
} as const

/**
 * 判断是否为挂车类业务（挂车、侧翻、水泥罐车）
 * @param businessType 业务类型
 * @returns 是否为挂车类业务
 */
export const isTrailerBusiness = (businessType: string | null | undefined): boolean => {
  if (!businessType) return false
  return businessType === '挂车' || businessType === '侧翻' || businessType === '水泥罐车'
}

/**
 * 判断是否为罐车业务
 * @param businessType 业务类型
 * @returns 是否为罐车业务
 */
export const isTankerBusiness = (businessType: string | null | undefined): boolean => {
  return businessType === '罐车'
}

/**
 * 获取业务类型的标签颜色
 * @param businessType 业务类型
 * @returns Ant Design Tag 颜色
 */
export const getBusinessTypeColor = (businessType: string | null | undefined): string => {
  return isTankerBusiness(businessType) ? 'blue' : 'green'
}

/**
 * 标准化业务类型（将别称映射到标准类型）
 * @param businessType 业务类型
 * @returns 标准化后的业务类型
 */
export const normalizeBusinessType = (businessType: string | null | undefined): '挂车' | '罐车' => {
  if (isTrailerBusiness(businessType)) return '挂车'
  if (isTankerBusiness(businessType)) return '罐车'
  return '挂车' // 默认为挂车
}

/**
 * 获取所有业务类型选项（用于下拉选择）
 * @returns 业务类型选项数组
 */
export const getBusinessTypeOptions = () => [
  { value: '挂车', label: '挂车' },
  { value: '侧翻', label: '侧翻' },
  { value: '水泥罐车', label: '水泥罐车' },
  { value: '罐车', label: '罐车' },
]

/**
 * 获取车牌号字段名
 * 挂车类业务使用用户绑定的车牌号(user_plate)，罐车使用OCR识别的车牌号(vehicle_no)
 * @param businessType 业务类型
 * @returns 车牌号字段名
 */
export const getVehiclePlateField = (businessType: string | null | undefined): 'user_plate' | 'vehicle_no' => {
  return isTrailerBusiness(businessType) ? 'user_plate' : 'vehicle_no'
}


