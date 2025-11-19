import client from '../client'
import type { ApiResponse, NoticeDetail, NoticeListResponse, NoticeStats } from '../types'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>) => {
  const response = await promise
  if (!response.data.success) {
    throw new Error(response.data.message || '请求失败')
  }
  return response.data.data
}

export interface NoticeListParams {
  status?: string
  notice_type?: string
  is_urgent?: boolean
  page?: number
  page_size?: number
}

export interface NoticePayload {
  title: string
  content: string
  notice_type?: string
  target_roles?: string[]
  is_urgent?: boolean
}

export interface NoticeUpdatePayload extends Partial<NoticePayload> {
  status?: string
}

export const fetchNoticeRoles = () => unwrap<{ roles: string[] }>(client.get('/notice/roles'))

export const fetchNotices = (params: NoticeListParams) =>
  unwrap<NoticeListResponse>(
    client.get('/notice/list', {
      params: {
        status: params.status,
        notice_type: params.notice_type,
        is_urgent: params.is_urgent,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      },
    }),
  )

export const fetchNoticeDetail = (noticeId: number) => unwrap<NoticeDetail>(client.get(`/notice/${noticeId}`))

export const createNotice = (payload: NoticePayload) =>
  unwrap(
    client.post('/notice/create', {
      ...payload,
      target_roles: payload.target_roles?.join(',') || null,
    }),
  )

export const updateNotice = (noticeId: number, payload: NoticeUpdatePayload) =>
  unwrap(
    client.put(`/notice/${noticeId}`, {
      ...payload,
      target_roles: payload.target_roles ? payload.target_roles.join(',') : undefined,
    }),
  )

export const deleteNotice = (noticeId: number) => unwrap(client.delete(`/notice/${noticeId}`))

export const markNoticeRead = (noticeId: number) => unwrap(client.post(`/notice/${noticeId}/read`, {}))

export const fetchNoticeStats = (params?: { begin_date?: string; end_date?: string }) =>
  unwrap<NoticeStats>(
    client.get('/notice/stats/overview', {
      params: {
        begin_date: params?.begin_date,
        end_date: params?.end_date,
      },
    }),
  )

