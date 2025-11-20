import { Select, type SelectProps } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { fetchCompanies } from '../api/services/companies'
import useAuthStore from '../store/auth'

interface CompanySelectorProps extends Omit<SelectProps, 'options'> {
  onChange?: (value: number | undefined) => void
}

/**
 * 公司选择器组件
 * 仅超级管理员可见，用于切换查看不同公司的数据
 */
export default function CompanySelector({ onChange, value, ...props }: CompanySelectorProps) {
  const { user } = useAuthStore()

  // 获取公司列表
  const { data: companiesResponse, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => fetchCompanies({ status: 'active' }),
    enabled: (user as any)?.role === 'super_admin' || (user as any)?.position_type === '超级管理员',
  })

  const companies = companiesResponse?.records || []

  // 构建选项
  const options: SelectProps['options'] = [
    { label: '全部公司', value: -1 }, // 特殊值 -1 表示不过滤公司
    ...companies.map((company: any) => ({
      label: company.name || company.company_name,
      value: company.id,
    })),
  ]

  const handleChange = (val: number) => {
    // -1 表示全部公司，传递 undefined 给父组件
    onChange?.(val === -1 ? undefined : val)
  }

  // 非超级管理员不显示
  if ((user as any)?.role !== 'super_admin' && (user as any)?.position_type !== '超级管理员') {
    return null
  }

  return (
    <Select
      {...props}
      style={{ width: 200, ...props.style }}
      placeholder="选择公司"
      options={options}
      loading={isLoading}
      value={value === undefined ? -1 : value}
      onChange={handleChange}
      allowClear={false}
    />
  )
}
