import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  batchOperateUsers,
  deleteUser,
  fetchUserDetail,
  fetchUsers,
  resetUserPassword,
  updateUser,
  type User,
} from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import CompanySelector from '../components/CompanySelector'

const { Title, Paragraph, Text } = Typography

const POSITION_TYPES = [
  { value: '司机', label: '司机' },
  { value: '统计', label: '统计' },
  { value: '统计员', label: '统计员' },
  { value: '车队长', label: '车队长' },
  { value: '财务', label: '财务' },
  { value: '总经理', label: '总经理' },
]

const UsersPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    phone?: string
    name?: string
    status?: string
  }>({})
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editForm] = Form.useForm()

  // 当公司选择变化时，更新查询
  useEffect(() => {
    if (isSuperAdmin) {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
    }
  }, [selectedCompanyId, isSuperAdmin, queryClient])

  // 获取用户列表
  const usersQuery = useQuery({
    queryKey: ['users', 'list', filters, effectiveCompanyId],
    queryFn: () =>
      fetchUsers({
        page: 1,
        size: 100,
        phone: filters.phone,
        name: filters.name,
        status: filters.status,
        company_id: effectiveCompanyId,
      }),
  })

  // 获取用户详情
  const userDetailQuery = useQuery({
    queryKey: ['users', 'detail', selectedUser?.id],
    queryFn: () => fetchUserDetail(selectedUser!.id),
    enabled: !!selectedUser && detailDrawerOpen,
  })

  const users = usersQuery.data?.items || []
  const userDetail = userDetailQuery.data?.user

  const handleSearch = (values: { phone?: string; name?: string; status?: string }) => {
    setFilters({
      phone: values.phone,
      name: values.name,
      status: values.status,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = useCallback((user: User) => {
    setSelectedUser(user)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedUser(null)
  }

  const openEdit = useCallback((user: User) => {
    setSelectedUser(user)
    editForm.setFieldsValue({
      name: user.name || user.nickname,
      phone: user.phone,
      plateNumber: user.plateNumber,
      positionType: user.position_type,
      status: user.status === 'active',
    })
    setEditDrawerOpen(true)
  }, [editForm])

  const closeEdit = () => {
    setEditDrawerOpen(false)
    setSelectedUser(null)
    editForm.resetFields()
  }

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: (data: any) => updateUser(selectedUser!.id, data),
    onSuccess: () => {
      message.success('用户信息更新成功')
      closeEdit()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      message.success('用户删除成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 重置密码
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: number) => resetUserPassword(userId),
    onSuccess: (data) => {
      message.success(data.message || '密码重置成功')
    },
    onError: (error) => {
      message.error((error as Error).message || '重置失败')
    },
  })

  // 批量操作
  const batchOperateMutation = useMutation({
    mutationFn: (params: {
      operation: 'delete' | 'update_status' | 'assign_role'
      user_ids: number[]
      data?: any
    }) => batchOperateUsers(params),
    onSuccess: (data) => {
      message.success(data.message || '批量操作成功')
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '批量操作失败')
    },
  })

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的用户')
      return
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个用户吗？`,
      onOk: () => {
        batchOperateMutation.mutate({
          operation: 'delete',
          user_ids: selectedRowKeys as number[],
        })
      },
    })
  }

  const handleBatchUpdateStatus = (status: 'active' | 'inactive') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要操作的用户')
      return
    }
    batchOperateMutation.mutate({
      operation: 'update_status',
      user_ids: selectedRowKeys as number[],
      data: { status },
    })
  }

  const handleBatchAssignRole = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要分配角色的用户')
      return
    }
    Modal.confirm({
      title: '批量分配角色',
      content: (
        <Select
          placeholder="选择角色"
          style={{ width: '100%', marginTop: 16 }}
          options={POSITION_TYPES}
          id="batch-role-select"
        />
      ),
      onOk: () => {
        const select = document.getElementById('batch-role-select') as HTMLSelectElement
        const role = select?.value
        if (!role) {
          message.warning('请选择角色')
          return
        }
        batchOperateMutation.mutate({
          operation: 'assign_role',
          user_ids: selectedRowKeys as number[],
          data: { position_type: role },
        })
      },
    })
  }

  // 用户列表列定义
  const userColumns: ColumnsType<User> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '姓名',
        dataIndex: 'name',
        width: 120,
        render: (value, record) => value || record.nickname || '-',
      },
      {
        title: '手机号',
        dataIndex: 'phone',
        width: 130,
      },
      {
        title: '车牌号',
        dataIndex: 'plateNumber',
        width: 120,
        render: (value) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '角色',
        dataIndex: 'position_type',
        width: 120,
        render: (value) => {
          if (!value) return <Text type="secondary">-</Text>
          const colorMap: Record<string, string> = {
            总经理: 'red',
            财务: 'orange',
            统计: 'blue',
            统计员: 'blue',
            车队长: 'green',
            司机: 'default',
          }
          return <Tag color={colorMap[value] || 'default'}>{value}</Tag>
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value) => {
          const isActive = value === 'active'
          return (
            <Tag color={isActive ? 'success' : 'error'}>{isActive ? '启用' : '禁用'}</Tag>
          )
        },
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<UserOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              icon={<KeyOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认重置密码',
                  content: '确定要将该用户密码重置为默认密码（123456）吗？',
                  onOk: () => resetPasswordMutation.mutate(record.id),
                })
              }}
              loading={resetPasswordMutation.isPending}
            >
              重置密码
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: '确定要删除该用户吗？',
                  onOk: () => deleteUserMutation.mutate(record.id),
                })
              }}
              loading={deleteUserMutation.isPending}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [openDetail, openEdit, resetPasswordMutation, deleteUserMutation],
  )

  const handleEditSubmit = () => {
    editForm.validateFields().then((values) => {
      updateUserMutation.mutate({
        name: values.name,
        phone: values.phone,
        plateNumber: values.plateNumber,
        positionType: values.positionType,
        status: values.status ? 'active' : 'inactive',
      })
    })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            用户与角色管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理用户账号、角色分配、权限配置等。
          </Paragraph>
        </div>
        <Space>
          {isSuperAdmin && (
            <CompanySelector
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              allowClear
              placeholder="选择公司（留空查看所有）"
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          >
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
                loading={batchOperateMutation.isPending}
              >
                批量删除 ({selectedRowKeys.length})
              </Button>
              <Button
                onClick={() => handleBatchUpdateStatus('active')}
                loading={batchOperateMutation.isPending}
              >
                批量启用 ({selectedRowKeys.length})
              </Button>
              <Button
                onClick={() => handleBatchUpdateStatus('inactive')}
                loading={batchOperateMutation.isPending}
              >
                批量禁用 ({selectedRowKeys.length})
              </Button>
              <Button onClick={handleBatchAssignRole} loading={batchOperateMutation.isPending}>
                批量分配角色 ({selectedRowKeys.length})
              </Button>
            </>
          )}
        </Space>
      </Flex>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {isSuperAdmin && !selectedCompanyId && (
            <Alert
              message="提示"
              description="当前显示所有公司的用户。请选择公司以查看特定公司的用户。"
              type="info"
              showIcon
              closable
            />
          )}
          <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
            <Form.Item name="name" label="姓名">
              <Input placeholder="请输入姓名" allowClear style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input placeholder="请输入手机号" allowClear style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                placeholder="请选择状态"
                allowClear
                style={{ width: 150 }}
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '禁用' },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
                <Button htmlType="reset">重置</Button>
              </Space>
            </Form.Item>
          </Form>

          {usersQuery.error && (
            <Alert
              type="error"
              showIcon
              message={(usersQuery.error as Error).message || '数据加载失败'}
            />
          )}

          <Table
            rowKey="id"
            columns={userColumns}
            dataSource={users}
            loading={usersQuery.isLoading}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              total: usersQuery.data?.total || 0,
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个用户`,
            }}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>

      {/* 详情Drawer */}
      <Drawer
        title={`用户详情 - ${selectedUser?.name || selectedUser?.nickname || selectedUser?.id}`}
        width={600}
        open={detailDrawerOpen}
        onClose={closeDetail}
        loading={userDetailQuery.isLoading}
      >
        {userDetail && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="用户ID">{userDetail.id}</Descriptions.Item>
            <Descriptions.Item label="姓名">{userDetail.name || userDetail.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{userDetail.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="车牌号">{userDetail.plateNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag>{userDetail.position_type || '未设置'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={userDetail.status === 'active' ? 'success' : 'error'}>
                {userDetail.status === 'active' ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后登录时间">
              {(userDetail as any).lastLoginAt
                ? dayjs((userDetail as any).lastLoginAt).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="登录次数">{(userDetail as any).loginCount || 0}</Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {(userDetail as any).registerTime
                ? dayjs((userDetail as any).registerTime).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 编辑Drawer */}
      <Drawer
        title={`编辑用户 - ${selectedUser?.name || selectedUser?.nickname || selectedUser?.id}`}
        width={600}
        open={editDrawerOpen}
        onClose={closeEdit}
        extra={
          <Space>
            <Button onClick={closeEdit}>取消</Button>
            <Button type="primary" onClick={handleEditSubmit} loading={updateUserMutation.isPending}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="plateNumber" label="车牌号">
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="positionType" label="角色">
            <Select placeholder="请选择角色" options={POSITION_TYPES} />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}

export default UsersPage
