import { Select, type SelectProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLinkedAccounts, switchAccount, type LinkedAccount } from '../api/services/me'
import useAuthStore from '../store/auth'
import type { CSSProperties } from 'react'

interface AccountSwitcherProps extends Omit<SelectProps, 'options' | 'onChange' | 'value'> {
  style?: CSSProperties
}

function formatLabel(acc: LinkedAccount): string {
  const company = acc.companyName || (acc.companyId ? `公司#${acc.companyId}` : '未知公司')
  const role = acc.positionType || acc.role || '未知角色'
  const phone = acc.phone ? `(${acc.phone})` : ''
  return `${company} - ${role} ${phone}`.trim()
}

export default function AccountSwitcher(props: AccountSwitcherProps) {
  const queryClient = useQueryClient()
  const { user, setAuth } = useAuthStore()

  const linkedQuery = useQuery({
    queryKey: ['me', 'linked-accounts'],
    queryFn: fetchLinkedAccounts,
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  const accounts = linkedQuery.data?.linked_accounts || []
  const currentId = linkedQuery.data?.current_user_id

  const hasMultiple = accounts.filter((a) => a.id).length > 1

  const switchMutation = useMutation({
    mutationFn: (id: number) => switchAccount(id),
    onSuccess: (data) => {
      setAuth({
        token: data.token,
        user: {
          name: data.user.name || data.user.phone || '管理员',
          role: data.user.role || data.user.positionType || '管理员',
          positionType: data.user.positionType,
          email: data.user.phone,
          companyId: data.user.companyId,
          companyBusinessType: data.user.companyBusinessType,
        },
      })

      // 清掉所有缓存，让页面重新按新 token 拉数据
      queryClient.clear()
      window.location.reload()
    },
  })

  if (!user || !hasMultiple) {
    return null
  }

  const options: SelectProps['options'] = accounts.map((acc) => ({
    label: formatLabel(acc),
    value: acc.id,
  }))

  return (
    <Select
      {...props}
      style={{ width: 260, ...props.style }}
      placeholder="切换公司/账号"
      options={options}
      value={currentId}
      loading={linkedQuery.isLoading || switchMutation.isPending}
      onChange={(val) => {
        const id = Number(val)
        if (!Number.isFinite(id)) return
        switchMutation.mutate(id)
      }}
    />
  )
}
