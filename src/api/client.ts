import axios from 'axios'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 30000, // 增加到30秒，避免编辑证件时超时
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const selectedCompanyId = useCompanyStore.getState().selectedCompanyId
  const requestUrl = config.url || ''
  const isTiresApi = requestUrl.startsWith('/tires')

  if (isTiresApi && selectedCompanyId !== undefined && selectedCompanyId !== null) {
    const params = (config.params || {}) as Record<string, any>
    if (params.company_id === undefined || params.company_id === null) {
      config.params = {
        ...params,
        company_id: selectedCompanyId,
      }
    }
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default client
