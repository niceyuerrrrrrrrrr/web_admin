export interface ApiResponse<T> {
  success: boolean
  code: number
  message: string
  data: T
}

// 票据相关类型
export type ReceiptType = 'loading' | 'unloading' | 'charging' | 'water'

export interface LoadingReceipt {
  id: number
  user_id: number
  type: 'loading'
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
  task_id?: string
  created_at?: string
}

export interface UnloadingReceipt {
  id: number
  user_id: number
  type: 'unloading'
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
  created_at?: string
}

export interface ChargingReceipt {
  id: number
  type: 'charging'
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
  raw_data?: Record<string, unknown>
  created_at?: string
}

export interface WaterTicket {
  id: number
  type: 'water'
  company?: string
  company_name?: string
  vehicle_no?: string
  ticket_date?: string
  thumb_url?: string
  image_path?: string
  created_at?: string
}

export type Receipt = LoadingReceipt | UnloadingReceipt | ChargingReceipt | WaterTicket

export interface ReceiptListParams {
  userId?: number
  receiptType?: ReceiptType
  startDate?: string
  endDate?: string
  companyId?: number
  vehicleNo?: string
  driverName?: string
  page?: number
  pageSize?: number
}

export interface ReceiptListResponse {
  records: Receipt[]
  total: number
  page?: number
  page_size?: number
  total_pages?: number
}

export interface ReceiptStats {
  total: number
  by_type: Record<ReceiptType, number>
  by_vehicle: Record<string, number>
  by_driver: Record<string, number>
  total_amount?: number
  total_energy?: number
  total_weight?: number
}

// 仓库与库存
export interface Warehouse {
  id: number
  name: string
  code?: string
  address?: string
  manager_id?: number
  description?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface InventoryItem {
  id: number
  warehouse_id: number
  warehouse_name?: string
  material_name: string
  material_code?: string
  quantity: number
  unit: string
  min_stock?: number
  max_stock?: number | null
  location?: string
  notes?: string
  created_at?: string
}

export interface StockOperationRecord {
  id: number
  warehouse_id: number
  warehouse_name?: string
  inventory_id: number
  material_name?: string
  material_code?: string
  operation_type: 'inbound' | 'outbound'
  quantity: number
  unit: string
  operator_id?: number
  operation_date: string
  reason?: string
  status: string
  related_request_id?: number
  images?: string[]
  created_at?: string
}

export interface InventoryStats {
  stats: {
    totalInbound: number
    totalOutbound: number
    totalItems: number
    lowStockItems: number
    turnoverRate: number
  }
  trend: {
    inbound: number[]
    outbound: number[]
    dates: string[]
  }
  top_items: Array<{
    id: number
    material_name: string
    material_code?: string
    quantity: number
    unit: string
    operation_count: number
    isLowStock: boolean
  }>
}

// 充电站与价格
export interface ChargingStation {
  id: number
  station_name: string
  station_code?: string
  location?: string
  contact_person?: string
  contact_phone?: string
  is_active?: boolean
  description?: string
  created_at?: string
  updated_at?: string
}

export interface ChargingPriceRule {
  id: number
  station_id: number
  time_period_start: string
  time_period_end: string
  price_per_kwh: number
  priority: number
  description?: string
  effective_date?: string
  expiry_date?: string
  is_active: boolean
}

export interface ChargingStatistics {
  summary: {
    total_energy: number
    total_amount: number
    total_sessions: number
    avg_price: number
  }
  stations: Array<{
    station_name: string
    total_energy: number
    total_amount: number
    sessions: number
  }>
  daily_trend: Array<{
    date: string | null
    energy: number
    amount: number
  }>
}

export interface ChargingCostResult {
  price_per_kwh: number
  amount: number
}

// 报销相关类型
export type ReimbursementStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected'

export interface ReimbursementRecord {
  id: number
  user_id: number
  applicant_name?: string
  approver_name?: string
  amount: number
  category: string
  subcategory?: string
  merchant?: string
  date: string
  remark?: string
  project?: string
  status: ReimbursementStatus
  images?: string[]
  created_at?: string
  updated_at?: string
}

export interface ReimbursementListResponse {
  records: ReimbursementRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ReimbursementDetail extends ReimbursementRecord {
  user_name?: string
}

export interface ReimbursementStats {
  total_amount: number
  total_count: number
  average_amount: number
  status_summary: Record<
    ReimbursementStatus,
    {
      count: number
      amount: number
    }
  >
  category_stats: Array<{ category: string; count: number; amount: number }>
  user_stats: Array<{ user_id: number; user_name: string; count: number; amount: number }>
  monthly_trend: Array<{ month: string; count: number; amount: number }>
  time_range: {
    begin_date?: string
    end_date?: string
  }
}

export interface ReimbursementApprovalNode {
  id: number
  approver_name: string
  role: string
  status: string
  status_text: string
  approval_time?: string
  comment?: string
}

export interface ReimbursementComment {
  id: number
  user_name: string
  content: string
  images?: string[]
  created_at?: string
}

// 采购管理
export type PurchaseStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected'

export interface PurchaseRecord {
  id: number
  user_id: number
  applicant_name?: string
  approver_name?: string
  amount: number
  category: string
  supplier?: string
  date: string
  remark?: string
  project?: string
  status: PurchaseStatus
  images?: string[]
  created_at?: string
  updated_at?: string
}

export interface PurchaseListResponse {
  records: PurchaseRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PurchaseDetail extends PurchaseRecord {
  user_name?: string
}

export interface PurchaseApprovalNode {
  id: number
  approver_name: string
  role: string
  status: string
  status_text: string
  approval_time?: string
  comment?: string
}

export interface PurchaseComment {
  id: number
  user_name: string
  content: string
  images?: string[]
  created_at?: string
}

// 物品领用
export type MaterialRequestStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected'

export interface MaterialRequestRecord {
  id: number
  user_id: number
  material_name: string
  material_code?: string
  quantity: number
  unit: string
  purpose?: string
  request_date: string
  warehouse_id?: number
  images?: string[]
  status: MaterialRequestStatus
  applicant_name?: string
  user_name?: string
  approver_name?: string
  synced_to_inventory?: string
  stock_operation_id?: number
  created_at?: string
  updated_at?: string
}

export interface MaterialRequestListResponse {
  records: MaterialRequestRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface MaterialRequestStats {
  total_count: number
  approved_count: number
  pending_count: number
  rejected_count: number
  usage_by_material: Array<{ material_name: string; amount: number }>
  usage_by_user: Array<{ user_name: string; count: number }>
}

export interface MaterialComment {
  id: number
  user_name: string
  content: string
  images?: string[]
  created_at?: string
}

// 材料价格
export interface MaterialType {
  id: number
  name: string
  spec?: string
  unit_price: number
  freight_price: number
  total_price: number
  is_active: boolean
  description?: string
  created_at?: string
  updated_at?: string
}

export interface MaterialIncomeCalculation {
  material_type_id?: number
  material_name: string
  net_weight: number
  unit_price: number
  freight_price: number
  total_price: number
  total_income: number
}

// 人事管理
export type HRFormType = 'onboarding' | 'offboarding'
export type HRFormStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed'

export interface HRSignatureTask {
  provider?: string
  signer_email?: string
  redirect_url?: string
  task_id?: string
  status?: string
  file_url?: string
}

export interface HRFormRecord {
  form_id: string
  user_id: number
  form_type: HRFormType
  name: string
  phone: string
  status: HRFormStatus
  pdf_url?: string
  created_at?: string
  attachments?: Record<string, any>
}

export interface HRFormDetail extends HRFormRecord {
  id_card?: string
  email?: string
  gender?: string
  birth_date?: string
  address?: string
  emergency_contact?: string
  emergency_phone?: string
  position?: string
  department?: string
  hire_date?: string
  salary?: number
  work_location?: string
  probation_period?: number
  leave_date?: string
  leave_reason?: string
  handover_status?: string
  signature_image_url?: string
  attachments?: Record<string, any>
}

export interface HRFormListResponse {
  forms: HRFormRecord[]
  total: number
  page: number
  page_size: number
}

export interface OnboardingFormPayload {
  name: string
  id_card?: string
  phone: string
  email?: string
  gender?: string
  birth_date?: string
  address?: string
  emergency_contact?: string
  emergency_phone?: string
  position: string
  department: string
  hire_date: string
  salary?: number
  work_location?: string
  probation_period?: number
  signature_image?: string
  save_as_draft?: boolean
  approver_ids?: number[]
  signature_provider?: string
  signature_reference?: string
  attachments?: Record<string, any>
}

export interface OffboardingFormPayload {
  name: string
  phone: string
  leave_date: string
  leave_reason: string
  handover_status?: string
  signature_image?: string
  save_as_draft?: boolean
  approver_ids?: number[]
  signature_provider?: string
  signature_reference?: string
  attachments?: Record<string, any>
}

export interface HRApprovalRequest {
  approved: boolean
  comment?: string
}

export interface DraftUpdatePayload {
  form_type: HRFormType
  payload: Record<string, any>
  submit?: boolean
}

export interface ProbationEmployee {
  form_id: string
  user_id: number
  name: string
  phone?: string
  position?: string
  department?: string
  hire_date?: string
  probation_period?: number
  probation_end_date?: string
  salary?: number
  employee_status?: string
  days_until_end?: number
  status_text?: string
}

export interface RegularizationRequestPayload {
  regularized_date: string
  regular_salary?: number
  comment?: string
}

export interface SignatureInitiatePayload {
  provider: string
  signer_email: string
  redirect_url?: string
}

export interface HRPdfPreviewResponse {
  image_url?: string
  images?: string[]
  total_pages: number
  page?: number
}

// 请假管理
export type LeaveStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected'

export interface LeaveRecord {
  id: number
  user_id: number
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason?: string
  images?: string[]
  status: LeaveStatus
  applicant_name?: string
  approver_name?: string
  created_at?: string
  updated_at?: string
}

export interface LeaveListResponse {
  records: LeaveRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface LeaveDetail extends LeaveRecord {}

export interface LeaveApprovalHistoryEntry {
  id: number
  approver_id: number
  approver_name: string
  action: string
  comment?: string
  created_at?: string
}

export interface LeaveCommentRecord {
  id: number
  user_name: string
  content: string
  images?: string[]
  created_at?: string
}

export interface LeaveStats {
  summary: {
    total_requests: number
    total_days: number
  }
  by_type: Array<{
    leave_type: string
    count: number
    days: number
  }>
  by_status: Array<{
    status: string
    count: number
  }>
  top_users: Array<{
    user_id: number
    user_name: string
    count: number
    days: number
  }>
}

// 故障管理
export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'processing'
  | 'resolved'
  | 'rejected'
  | 'closed'

export interface ReportRecord {
  id: number
  user_id: number
  type: string
  title: string
  description?: string
  location?: string
  priority: string
  images?: string[]
  status: ReportStatus
  applicant_name?: string
  approver_name?: string
  created_at?: string
  updated_at?: string
  submit_time?: string
}

export interface ReportListResponse {
  records: ReportRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ReportDetail extends ReportRecord {}

export interface ReportApprovalHistoryEntry {
  id: number
  approver_id: number
  approver_name: string
  action: string
  comment?: string
  created_at?: string
}

export interface ReportCommentRecord {
  id: number
  user_name: string
  content: string
  images?: string[]
  created_at?: string
}

export interface ReportStats {
  summary: {
    total: number
    resolved: number
    processing: number
  }
  by_type: Array<{ type: string; count: number }>
  by_status: Array<{ status: string; count: number }>
  by_priority: Array<{ priority: string; count: number }>
  pending_list: Array<{
    id: number
    title: string
    priority: string
    status: string
    applicant_name?: string
    created_at?: string
  }>
}

// 通知公告
export type NoticeStatus = 'draft' | 'published' | 'archived'

export interface NoticeRecord {
  id: number
  title: string
  content: string
  notice_type: string
  target_roles?: string
  is_urgent: boolean
  status: NoticeStatus
  created_by?: number
  creator_name?: string
  created_at?: string
  updated_at?: string
  read_count?: number
  is_read?: boolean
}

export interface NoticeListResponse {
  records: NoticeRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface NoticeDetail extends NoticeRecord {}

export interface NoticeStats {
  summary: {
    total: number
    published: number
    draft: number
    urgent: number
    read_count: number
  }
  by_type: Array<{ notice_type: string; count: number }>
  by_status: Array<{ status: string; count: number }>
  recent: Array<{ date: string; count: number }>
  top_notices: Array<{ id: number; title: string; notice_type: string; is_urgent: boolean; read_count: number }>
}

// 文档管理
export interface DocumentAsset {
  id: number
  file_url: string
  file_thumb?: string
  file_name?: string
  created_at?: string
}

export interface DocumentRecord {
  id: number
  category: string
  doc_type: string
  doc_no: string
  subject_identifier?: string
  subject_display?: string
  expire_date?: string
  remark?: string
  owner_user_id?: number
  company_id?: number
  visible_scope?: string
  sync_version?: number
  created_at?: string
  updated_at?: string
  assets: DocumentAsset[]
}

export interface DocumentListResponse {
  records: DocumentRecord[]
  total: number
  page: number
  page_size: number
}

export interface DocumentStats {
  summary: {
    total: number
    expired: number
    expiring: number
  }
  by_category: Array<{ category: string; count: number }>
  top_types: Array<{ doc_type: string; count: number }>
  expiring_soon: Array<{ id: number; doc_type: string; subject_display?: string; expire_date?: string }>
}

export interface SystemBaseConfig {
  system_name: string
  logo_url?: string
  default_company_id?: number | null
  theme_color?: string
}

export interface SystemApprovalConfig {
  reminder_channel: string[]
  auto_remind_hours?: number
  enable_auto_escalation: boolean
}

export interface SystemAttendanceConfig {
  workdays: string[]
  work_start: string
  work_end: string
  fence_radius: number
  fence_center?: { lat: number; lng: number }
}

export interface SystemNotificationConfig {
  sms_enabled: boolean
  sms_channel?: string
  email_enabled: boolean
  email_sender?: string
  wecom_enabled: boolean
  wecom_webhook?: string
}

export interface SystemConfigResponse {
  base: SystemBaseConfig
  approval: SystemApprovalConfig
  attendance: SystemAttendanceConfig
  notification: SystemNotificationConfig
}

export interface ReportModuleField {
  field?: string
  name?: string
  alias?: string
  type?: string
}

export interface ReportModule {
  module: string
  label: string
  fields: string[]
}

export interface CustomReportRecord {
  id: number
  name: string
  module: string
  fields: ReportModuleField[]
  filters: Record<string, any>
  schedule_cron?: string
  export_formats?: string[]
  created_at?: string
}

export interface ReportHistoryRecord {
  id: number
  status: string
  generated_rows: number
  export_url?: string
  created_at?: string
}

export interface ExportTemplateRecord {
  id: number
  name: string
  module: string
  fields: string[]
  filters: Record<string, any>
  created_at?: string
}

export interface ExportJobRecord {
  id: number
  module: string
  params: Record<string, any>
  status: string
  file_name?: string
  created_at?: string
  completed_at?: string
}

export interface LoginPayload {
  phone: string
  password: string
}

export interface LoginUserInfo {
  id: number
  name?: string
  nickname?: string
  phone?: string
  plateNumber?: string
  positionType?: string
  position_type?: string
  status?: string
  companyName?: string
  companyId?: number
  companyBusinessType?: string
  role?: string
}

export interface LoginResponse {
  token: string
  user: LoginUserInfo
}
