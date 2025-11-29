import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
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
      nickname: user.nickname,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      plate: user.plate || user.plateNumber,
      positionType: user.position_type,
      role: user.role,
      status: user.status === 'active',
      company: user.company,
      company_name: user.company_name,
      company_business_type: user.company_business_type,
      bank_card: user.bank_card,
      bank_name: user.bank_name,
      card_holder: user.card_holder,
      onboard_date: user.onboard_date ? dayjs(user.onboard_date) : null,
      app_lang: user.app_lang,
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
        fixed: 'left',
      },
      {
        title: '姓名/昵称',
        dataIndex: 'nickname',
        width: 120,
        fixed: 'left',
        render: (value, record) => record.name || value || '-',
      },
      {
        title: '用户名',
        dataIndex: 'username',
        width: 120,
        render: (value) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '手机号',
        dataIndex: 'phone',
        width: 130,
      },
      {
        title: '邮箱',
        dataIndex: 'email',
        width: 180,
        render: (value) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '车牌号',
        dataIndex: 'plate',
        width: 120,
        render: (value, record) => value || record.plateNumber || <Text type="secondary">-</Text>,
      },
      {
        title: '职位类型',
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
            超级管理员: 'purple',
          }
          return <Tag color={colorMap[value] || 'default'}>{value}</Tag>
        },
      },
      {
        title: '系统角色',
        dataIndex: 'role',
        width: 120,
        render: (value) => {
          if (!value) return <Text type="secondary">-</Text>
          const colorMap: Record<string, string> = {
            super_admin: 'purple',
            admin: 'red',
            manager: 'orange',
            user: 'blue',
            driver: 'default',
          }
          return <Tag color={colorMap[value] || 'default'}>{value}</Tag>
        },
      },
      {
        title: '公司',
        dataIndex: 'company_name',
        width: 150,
        render: (value, record) => value || record.company || <Text type="secondary">-</Text>,
      },
      {
        title: '业务类型',
        dataIndex: 'company_business_type',
        width: 100,
        render: (value) => {
          if (!value) return <Text type="secondary">-</Text>
          return <Tag color={value === '罐车' ? 'blue' : 'green'}>{value}</Tag>
        },
      },
      {
        title: '银行卡',
        dataIndex: 'bank_card',
        width: 150,
        render: (value) => value ? `****${value.slice(-4)}` : <Text type="secondary">-</Text>,
      },
      {
        title: '开户行',
        dataIndex: 'bank_name',
        width: 120,
        render: (value) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '持卡人',
        dataIndex: 'card_holder',
        width: 100,
        render: (value) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '微信OpenID',
        dataIndex: 'wx_openid',
        width: 120,
        render: (value) => value ? `${value.slice(0, 8)}...` : <Text type="secondary">-</Text>,
      },
      {
        title: '入职日期',
        dataIndex: 'onboard_date',
        width: 120,
        render: (value) => value ? dayjs(value).format('YYYY-MM-DD') : <Text type="secondary">-</Text>,
      },
      {
        title: '最后登录',
        dataIndex: 'last_login_at',
        width: 150,
        render: (value, record) => {
          const loginTime = value || record.lastLoginAt
          return loginTime ? dayjs(loginTime).format('MM-DD HH:mm') : <Text type="secondary">-</Text>
        },
      },
      {
        title: '登录次数',
        dataIndex: 'login_count',
        width: 100,
        render: (value, record) => (value || record.loginCount || 0),
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
        title: '创建时间',
        dataIndex: 'created_at',
        width: 150,
        render: (value, record) => {
          const createTime = value || record.registerTime
          return createTime ? dayjs(createTime).format('MM-DD HH:mm') : <Text type="secondary">-</Text>
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
        // 基础信息
        nickname: values.nickname,
        username: values.username,
        name: values.name,
        phone: values.phone,
        email: values.email,
        app_lang: values.app_lang,
        status: values.status ? 'active' : 'inactive',
        
        // 业务信息
        plate: values.plate,
        plateNumber: values.plate, // 兼容字段
        position_type: values.positionType,
        positionType: values.positionType, // 兼容字段
        role: values.role,
        onboard_date: values.onboard_date ? values.onboard_date.format('YYYY-MM-DD') : null,
        
        // 公司信息
        company: values.company,
        company_name: values.company_name,
        company_business_type: values.company_business_type,
        
        // 银行信息
        bank_card: values.bank_card,
        bank_name: values.bank_name,
        card_holder: values.card_holder,
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
            scroll={{ x: 2400 }}
          />
        </Space>
      </Card>

      {/* 详情Drawer */}
      <Drawer
        title={`用户详情 - ${selectedUser?.name || selectedUser?.nickname || selectedUser?.id}`}
        width={800}
        open={detailDrawerOpen}
        onClose={closeDetail}
        loading={userDetailQuery.isLoading}
      >
        {userDetail && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基础信息 */}
            <Card title="基础信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="用户ID">{userDetail.id}</Descriptions.Item>
                <Descriptions.Item label="用户名">{userDetail.username || '-'}</Descriptions.Item>
                <Descriptions.Item label="昵称">{userDetail.nickname || '-'}</Descriptions.Item>
                <Descriptions.Item label="姓名">{userDetail.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="手机号">{userDetail.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{userDetail.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={userDetail.status === 'active' ? 'success' : 'error'}>
                    {userDetail.status === 'active' ? '启用' : '禁用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="语言设置">{userDetail.app_lang || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 业务信息 */}
            <Card title="业务信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="车牌号">{userDetail.plate || userDetail.plateNumber || '-'}</Descriptions.Item>
                <Descriptions.Item label="职位类型">
                  <Tag color="blue">{userDetail.position_type || '未设置'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="系统角色">
                  <Tag color="purple">{userDetail.role || '未设置'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="入职日期">
                  {userDetail.onboard_date ? dayjs(userDetail.onboard_date).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="微信OpenID">
                  {userDetail.wx_openid ? (
                    <Text copyable={{ text: userDetail.wx_openid }}>
                      {userDetail.wx_openid.slice(0, 12)}...
                    </Text>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="头像">
                  {userDetail.avatar ? (
                    <img src={userDetail.avatar} alt="头像" style={{ width: 40, height: 40, borderRadius: 4 }} />
                  ) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 公司信息 */}
            <Card title="公司信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="公司ID">{userDetail.company_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="公司名称">{userDetail.company_name || userDetail.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="业务类型" span={2}>
                  {userDetail.company_business_type ? (
                    <Tag color={userDetail.company_business_type === '罐车' ? 'blue' : 'green'}>
                      {userDetail.company_business_type}
                    </Tag>
                  ) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 银行信息 */}
            <Card title="银行信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="银行卡号">
                  {userDetail.bank_card ? (
                    <Text copyable={{ text: userDetail.bank_card }}>
                      ****{userDetail.bank_card.slice(-4)}
                    </Text>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="开户银行">{userDetail.bank_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="持卡人姓名" span={2}>{userDetail.card_holder || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 系统信息 */}
            <Card title="系统信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="最后登录时间">
                  {userDetail.last_login_at || (userDetail as any).lastLoginAt
                    ? dayjs(userDetail.last_login_at || (userDetail as any).lastLoginAt).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="登录次数">
                  {userDetail.login_count || (userDetail as any).loginCount || 0}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {userDetail.created_at || (userDetail as any).registerTime
                    ? dayjs(userDetail.created_at || (userDetail as any).registerTime).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {userDetail.updated_at ? dayjs(userDetail.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建者ID">{userDetail.created_by_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="更新者ID">{userDetail.updated_by_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="排序">{userDetail.sort || '-'}</Descriptions.Item>
                <Descriptions.Item label="密码修改时区">{userDetail.password_change_tz || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 系统设置 */}
            {userDetail.system_settings && (
              <Card title="系统设置" size="small">
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, fontSize: 12 }}>
                  {JSON.stringify(userDetail.system_settings, null, 2)}
                </pre>
              </Card>
            )}
          </Space>
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
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基础信息 */}
            <Card title="基础信息" size="small">
              <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
                <Input placeholder="请输入昵称" />
              </Form.Item>
              <Form.Item name="username" label="用户名">
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item name="name" label="真实姓名">
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
              <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
                <Input placeholder="请输入手机号" />
              </Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入正确的邮箱格式' }]}>
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              <Form.Item name="app_lang" label="语言设置">
                <Select placeholder="请选择语言" options={[
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'en-US', label: 'English' },
                ]} />
              </Form.Item>
              <Form.Item name="status" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Card>

            {/* 业务信息 */}
            <Card title="业务信息" size="small">
              <Form.Item name="plate" label="车牌号">
                <Input placeholder="请输入车牌号" />
              </Form.Item>
              <Form.Item name="positionType" label="职位类型">
                <Select placeholder="请选择职位类型" options={POSITION_TYPES} />
              </Form.Item>
              <Form.Item name="role" label="系统角色">
                <Select placeholder="请选择系统角色" options={[
                  { value: 'super_admin', label: '超级管理员' },
                  { value: 'admin', label: '管理员' },
                  { value: 'manager', label: '经理' },
                  { value: 'user', label: '普通用户' },
                  { value: 'driver', label: '司机' },
                ]} />
              </Form.Item>
              <Form.Item name="onboard_date" label="入职日期">
                <DatePicker placeholder="请选择入职日期" style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            {/* 公司信息 */}
            <Card title="公司信息" size="small">
              <Form.Item name="company" label="公司名称（旧字段）">
                <Input placeholder="请输入公司名称" />
              </Form.Item>
              <Form.Item name="company_name" label="公司名称">
                <Input placeholder="请输入公司名称" />
              </Form.Item>
              <Form.Item name="company_business_type" label="业务类型">
                <Select placeholder="请选择业务类型" options={[
                  { value: '罐车', label: '罐车' },
                  { value: '挂车', label: '挂车' },
                ]} />
              </Form.Item>
            </Card>

            {/* 银行信息 */}
            <Card title="银行信息" size="small">
              <Form.Item name="bank_card" label="银行卡号">
                <Input placeholder="请输入银行卡号" />
              </Form.Item>
              <Form.Item name="bank_name" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
              <Form.Item name="card_holder" label="持卡人姓名">
                <Input placeholder="请输入持卡人姓名" />
              </Form.Item>
            </Card>
          </Space>
        </Form>
      </Drawer>
    </Space>
  )
}

export default UsersPage
