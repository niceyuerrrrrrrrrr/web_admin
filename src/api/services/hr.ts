import client from '../client'
import type {
  ApiResponse,
  DraftUpdatePayload,
  HRApprovalRequest,
  HRFormDetail,
  HRFormListResponse,
  HRPdfPreviewResponse,
  OnboardingFormPayload,
  OffboardingFormPayload,
  ProbationEmployee,
  RegularizationRequestPayload,
  SignatureInitiatePayload,
} from '../types'
import type { HRFormStatus, HRFormType } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface HRFormQuery {
  form_type?: HRFormType
  status?: HRFormStatus
  user_id?: number
  has_pdf?: boolean
  page?: number
  page_size?: number
}

export const fetchHRForms = (params: HRFormQuery) =>
  unwrap<HRFormListResponse>(
    client.get('/hr/forms', {
      params: {
        form_type: params.form_type,
        status: params.status,
        user_id: params.user_id,
        has_pdf: params.has_pdf,
        page: params.page,
        page_size: params.page_size,
      },
    }),
  )

export const fetchHRFormDetail = (formId: string) => unwrap<HRFormDetail>(client.get(`/hr/forms/${formId}`))

export const createOnboardingForm = (payload: OnboardingFormPayload) => unwrap(client.post('/hr/onboarding', payload))

export const createOffboardingForm = (payload: OffboardingFormPayload) => unwrap(client.post('/hr/offboarding', payload))

export const approveHRForm = (formId: string, data: HRApprovalRequest) =>
  unwrap(client.post(`/hr/forms/${formId}/approve`, data))

export const generateHRPdf = (formId: string) => unwrap(client.post(`/hr/forms/${formId}/generate-pdf`, {}))

export const fetchProbationEmployees = () => unwrap<{ employees: ProbationEmployee[] }>(client.get('/hr/employees/probation'))

export const fetchExpiringProbationEmployees = (days = 7) =>
  unwrap<{ employees: ProbationEmployee[] }>(
    client.get('/hr/employees/probation/expiring', {
      params: { days },
    }),
  )

export const regularizeEmployee = (formId: string, payload: RegularizationRequestPayload) =>
  unwrap(client.post(`/hr/employees/${formId}/regularize`, payload))

export const freezeEmployeeAccount = (userId: number) => unwrap(client.post(`/hr/account/${userId}/freeze`, {}))

export const activateEmployeeAccount = (userId: number) => unwrap(client.post(`/hr/account/${userId}/activate`, {}))

export const fetchHRPdfPreview = (formId: string, options?: { page?: number; allPages?: boolean }) =>
  unwrap<HRPdfPreviewResponse>(
    client.get(`/hr/forms/${formId}/pdf-preview`, {
      params: {
        page: options?.page ?? 1,
        all_pages: options?.allPages ?? false,
      },
    }),
  )

export const assignHRApprover = (formId: string, approverId: number) =>
  unwrap(client.post(`/hr/forms/${formId}/assign-approver`, { approver_id: approverId }))

export const initiateHRSignature = (formId: string, payload: SignatureInitiatePayload) =>
  unwrap<{ sign_url: string; task_id: string }>(client.post(`/hr/forms/${formId}/signature`, payload))

export const updateHRDraft = (formId: string, payload: DraftUpdatePayload) =>
  unwrap(client.put(`/hr/forms/${formId}/draft`, payload))

export const exportOffboardingForms = (formIds: string[]) =>
  client
    .post('/hr/offboarding/export', { form_ids: formIds }, { responseType: 'blob' })
    .then((response) => response.data)

