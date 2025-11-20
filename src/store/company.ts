import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CompanyState {
  selectedCompanyId: number | undefined
  setSelectedCompanyId: (id: number | undefined) => void
}

/**
 * 全局公司选择状态
 * 用于超级管理员切换查看不同公司的数据
 */
const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      selectedCompanyId: undefined,
      setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
    }),
    {
      name: 'company-selection', // localStorage key
    }
  )
)

export default useCompanyStore

