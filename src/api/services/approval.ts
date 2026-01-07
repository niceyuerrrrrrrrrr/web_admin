import client from '../client'
import type { ApiResponse } from '../types'

export const APPROVAL_TYPES = [
  { value: 'reimbursement', label: '报销' },
  { value: 'purchase', label: '采购' },
  { value: 'leave', label: '请假' },
  { value: 'material', label: '物品领用' },
  { value: 'report', label: '故障上报' },
  { value: 'makeup', label: '补卡' },
  { value: 'regularization', label: '转正' },
  { value: 'offboarding', label: '离职' },
]

export type ApprovalCoreFields = {
  approval_type: string
  type_name: string
  id: number
  user_id: number
  user_name: string
  title?: string
  date?: string
  status: string
  created_at?: string | null
  updated_at?: string | null
  can_approve?: boolean
  amount?: number
  days?: number
  quantity?: number
  images?: string[]
  latest_comment?: string
  comment_images?: string[]
  comment_time?: string | null
  comment_user?: string
  current_approver?: string
}

export type ApprovalPendingResponse = {
  records: ApprovalCoreFields[]
  total: number
}

export type ApprovalHistoryResponse = {
  records: ApprovalCoreFields[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export type ApprovalStats = {
  total_pending: number
  stats: Record<
    string,
    {
      type_name: string
      pending_count: number
    }
  >
}

export type ApprovalDetailResponse = {
  approval_type: string
  type_name: string
  detail: Record<string, unknown>
}

export interface ApprovalActionPayload {
  action: 'approve' | 'reject'
  comment?: string
}

export interface ApprovalTimelineNode {
  id: number
  node_order: number
  node_name: string
  approver_role: string | null
  approver_user_id: number | null
  approver_name: string | null
  status: string | null
  comment: string | null
  created_at: string | null
  updated_at: string | null
  approved_at: string | null
}

export interface ApprovalTimelineResponse {
  instance: {
    id: number
    workflow_id: number | null
    workflow_name: string | null
    current_node_order: number | null
    status: string
    created_at: string | null
    updated_at: string | null
  } | null
  nodes: ApprovalTimelineNode[]
}

export interface ManagerStatusStat {
  status: string
  text: string
  count: number
}

export interface ManagerTypeStat {
  key: string
  type_name: string
  total: number
  status: ManagerStatusStat[]
  metric_field?: string | null
  metric_total?: number | null
}

export interface ApprovalManagerStats {
  begin_date: string
  end_date: string
  scope: string
  types: ManagerTypeStat[]
  overall: {
    total: number
    status: ManagerStatusStat[]
  }
}

export interface TrendDataPoint {
  date: string
  type: string
  type_name: string
  statuses: Record<string, number>
}

export interface ApprovalTrendStats {
  begin_date: string
  end_date: string
  group_by: string
  trend: TrendDataPoint[]
}

export interface WorkflowNodePayload {
  node_order: number
  node_name: string
  approver_role: string
  approver_user_id: number
  is_required?: boolean
  can_reject?: boolean
}

export interface WorkflowNode extends WorkflowNodePayload {
  id: number
  approver_user_name?: string
  created_at?: string | null
  updated_at?: string | null
}

export interface WorkflowPayload {
  approval_type: string
  name: string
  description?: string
  is_active: boolean
  nodes: WorkflowNodePayload[]
  companyId?: number
  departmentId?: number | null
}

export interface Workflow extends WorkflowPayload {
  id: number
  company_id?: number | null
  department_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  nodes: WorkflowNode[]
}

export interface RoleUserOption {
  id: number
  name: string
  role: string
}

export type RoleUsersMap = Record<string, RoleUserOption[]>

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export const fetchApprovalStats = (params?: { companyId?: number }) =>
  unwrap<ApprovalStats>(
    client.get('/approval/stats', {
      params: {
        company_id: params?.companyId,
      },
    })
  )

export const fetchPendingApprovals = (params?: { approvalType?: string; companyId?: number }) =>
  unwrap<ApprovalPendingResponse>(
    client.get('/approval/pending', {
      params: {
        approval_type: params?.approvalType,
        company_id: params?.companyId,
      },
    }),
  )

export const fetchApprovalHistory = (params: {
  approvalType?: string
  status?: string
  beginDate?: string
  endDate?: string
  companyId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<ApprovalHistoryResponse>(
    client.get('/approval/list', {
      params: {
        approval_type: params.approvalType,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        company_id: params.companyId,
        page: params.page,
        page_size: params.pageSize,
      },
    }),
  )

export const fetchMyApprovedApprovals = (params: {
  approvalType?: string
  status?: string
  beginDate?: string
  endDate?: string
  companyId?: number
  page?: number
  pageSize?: number
}) =>
  unwrap<ApprovalHistoryResponse>(
    client.get('/approval/my-approved', {
      params: {
        approval_type: params.approvalType,
        status: params.status,
        begin_date: params.beginDate,
        end_date: params.endDate,
        company_id: params.companyId,
        page: params.page,
        page_size: params.pageSize,
      },
    }),
  )

export const fetchApprovalDetail = (approvalType: string, id: number) =>
  unwrap<ApprovalDetailResponse>(
    client.get(`/approval/pending/${approvalType}/${id}`),
  )

export const fetchApprovalTimeline = (approvalType: string, id: number) =>
  unwrap<ApprovalTimelineResponse>(
    client.get(`/approval/pending/${approvalType}/${id}/timeline`),
  )

export const submitApprovalAction = (
  approvalType: string,
  id: number,
  payload: ApprovalActionPayload,
) =>
  unwrap(client.post(`/approval/pending/${approvalType}/${id}/approve`, payload))

export const fetchManagerStats = (params: {
  approvalType?: string
  beginDate?: string
  endDate?: string
  companyId?: number
}) =>
  unwrap<ApprovalManagerStats>(
    client.get('/approval/stats/manager', {
      params: {
        approval_type: params.approvalType,
        begin_date: params.beginDate,
        end_date: params.endDate,
        company_id: params.companyId,
      },
    }),
  )

export const fetchTrendStats = (params: {
  approvalType?: string
  beginDate?: string
  endDate?: string
  groupBy?: 'day' | 'week' | 'month'
  companyId?: number
}) =>
  unwrap<ApprovalTrendStats>(
    client.get('/approval/stats/trend', {
      params: {
        approval_type: params.approvalType,
        begin_date: params.beginDate,
        end_date: params.endDate,
        group_by: params.groupBy || 'day',
        company_id: params.companyId,
      },
    }),
  )

export const fetchWorkflows = (params?: { approvalType?: string; companyId?: number }) =>
  unwrap<{ workflows: Workflow[] }>(
    client.get('/approval/workflows', {
      params: {
        approval_type: params?.approvalType,
        company_id: params?.companyId,
      },
    }),
  )

export const fetchWorkflowDetail = (id: number) =>
  unwrap<{ workflow: Workflow }>(client.get(`/approval/workflows/${id}`))

const transformWorkflowPayload = (payload: WorkflowPayload) => {
  const { companyId, departmentId, ...rest } = payload
  return {
    ...rest,
    company_id: companyId,
    department_id: departmentId,
  }
}

export const createWorkflow = (payload: WorkflowPayload) =>
  unwrap(client.post('/approval/workflows', transformWorkflowPayload(payload)))

export const updateWorkflow = (id: number, payload: WorkflowPayload) =>
  unwrap(client.put(`/approval/workflows/${id}`, transformWorkflowPayload(payload)))

export const deleteWorkflow = (id: number) =>
  unwrap(client.delete(`/approval/workflows/${id}`))

export const fetchRoleUsers = (params?: { role?: string; companyId?: number }) =>
  unwrap<{ role_users: RoleUsersMap }>(
    client.get('/approval/role_users', {
      params: {
        role: params?.role,
        company_id: params?.companyId,
      },
    }),
  )

export interface ApprovalEfficiencyResponse {
  avg_process_time: number
  fastest_type: string
  slowest_type: string
  details: {
    type: string
    type_name: string
    avg_hours: number
    count: number
  }[]
}

export interface ApprovalRankingResponse {
  applicant_ranking: {
    user_id: number
    user_name: string
    count: number
    amount: number
  }[]
  amount_ranking: {
    user_id: number
    user_name: string
    count: number
    amount: number
  }[]
}

export const fetchApprovalEfficiency = (params: { beginDate?: string; endDate?: string; companyId?: number }) =>
  unwrap<ApprovalEfficiencyResponse>(
    client.get('/approval/stats/efficiency', {
      params: {
        begin_date: params.beginDate,
        end_date: params.endDate,
        company_id: params.companyId,
      },
    }),
  )

export const fetchApprovalRanking = (params: { beginDate?: string; endDate?: string; companyId?: number }) =>
  unwrap<ApprovalRankingResponse>(
    client.get('/approval/stats/ranking', {
      params: {
        begin_date: params.beginDate,
        end_date: params.endDate,
        company_id: params.companyId,
      },
    }),
  )

export interface BatchDeletePayload {
  items: Array<{
    approval_type: string
    id: number
  }>
}

export const batchDeleteApprovals = (payload: BatchDeletePayload) =>
  unwrap(client.post('/approval/batch-delete', payload))
