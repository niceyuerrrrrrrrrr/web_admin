import { useEffect, useState } from 'react'
import { Modal, Checkbox, Space, Alert, Spin, message as antdMessage } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserSysRoles, getAvailableSysRoles, updateUserSysRoles, type SysRole } from '../api/services/users'

interface UserSysRolesModalProps {
  open: boolean
  onClose: () => void
  userId: number
  userName?: string
}

export const UserSysRolesModal = ({ open, onClose, userId, userName }: UserSysRolesModalProps) => {
  const queryClient = useQueryClient()
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])

  // 获取用户当前的系统角色
  const userRolesQuery = useQuery({
    queryKey: ['users', userId, 'sys-roles'],
    queryFn: () => getUserSysRoles(userId),
    enabled: open && !!userId,
  })

  // 获取所有可用的系统角色
  const availableRolesQuery = useQuery({
    queryKey: ['sys-roles', 'available'],
    queryFn: getAvailableSysRoles,
    enabled: open,
  })

  // 更新用户系统角色
  const updateRolesMutation = useMutation({
    mutationFn: (roleIds: number[]) => updateUserSysRoles(userId, roleIds),
    onSuccess: () => {
      antdMessage.success('系统角色更新成功')
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'sys-roles'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      onClose()
    },
    onError: (error) => {
      antdMessage.error((error as Error).message || '更新失败')
    },
  })

  // 当用户角色数据加载完成后，初始化选中的角色
  useEffect(() => {
    if (userRolesQuery.data?.roles) {
      setSelectedRoleIds(userRolesQuery.data.roles.map((r) => r.id))
    }
  }, [userRolesQuery.data])

  const handleOk = () => {
    updateRolesMutation.mutate(selectedRoleIds)
  }

  const handleRoleChange = (roleId: number, checked: boolean) => {
    if (checked) {
      setSelectedRoleIds([...selectedRoleIds, roleId])
    } else {
      setSelectedRoleIds(selectedRoleIds.filter((id) => id !== roleId))
    }
  }

  const isLoading = userRolesQuery.isLoading || availableRolesQuery.isLoading

  return (
    <Modal
      title={`管理系统角色 - ${userName || `用户${userId}`}`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={updateRolesMutation.isPending}
      width={500}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="加载中..." />
        </div>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="系统角色说明"
            description="系统角色用于控制小程序的功能权限，如首页显示、导航权限等。一个用户可以拥有多个系统角色。"
            type="info"
            showIcon
          />

          <div style={{ padding: '16px 0' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {availableRolesQuery.data?.roles.map((role: SysRole) => (
                <Checkbox
                  key={role.id}
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                >
                  <Space direction="vertical" size={0}>
                    <strong>{role.name}</strong>
                    {role.description && (
                      <span style={{ fontSize: '12px', color: '#666' }}>{role.description}</span>
                    )}
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </div>

          {selectedRoleIds.length === 0 && (
            <Alert
              message="未选择任何角色"
              description="用户将无法使用小程序的大部分功能，建议至少选择一个系统角色。"
              type="warning"
              showIcon
            />
          )}
        </Space>
      )}
    </Modal>
  )
}
