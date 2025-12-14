import { useCallback, useEffect, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  createDepartment,
  deleteDepartment,
  fetchDepartmentDetail,
  fetchDepartments,
  updateDepartment,
  type Department,
} from '../api/services/departments'
import { fetchUsers, updateUser, type User } from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Text } = Typography

const DepartmentsPage = () => {
  const queryClient = useQueryClient()
  const { message: messageApi } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  // 如果是超级管理员但没有选择公司，使用用户的公司ID作为默认值
  const effectiveCompanyId = isSuperAdmin 
    ? (selectedCompanyId ?? user?.company_id) 
    : user?.company_id

  // 调试信息
  useEffect(() => {
    console.log('部门管理页面调试信息:', {
      isSuperAdmin,
      selectedCompanyId,
      userCompanyId: user?.company_id,
      effectiveCompanyId,
      queryEnabled: !!effectiveCompanyId,
    })
  }, [isSuperAdmin, selectedCompanyId, user?.company_id, effectiveCompanyId])

  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [departmentForm] = Form.useForm()
  const [updatingUserDepartment, setUpdatingUserDepartment] = useState<number | null>(null)

  // 获取部门列表
  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', effectiveCompanyId],
    queryFn: () => fetchDepartments({ company_id: effectiveCompanyId }),
    enabled: !!effectiveCompanyId,
  })

  // 获取部门详情
  const departmentDetailQuery = useQuery({
    queryKey: ['departments', 'detail', selectedDepartment?.id],
    queryFn: () => fetchDepartmentDetail(selectedDepartment!.id),
    enabled: !!selectedDepartment && detailDrawerOpen,
  })

  // 获取部门用户列表
  const departmentUsersQuery = useQuery({
    queryKey: ['users', 'list', 'department', selectedDepartment?.id, effectiveCompanyId],
    queryFn: () =>
      fetchUsers({
        page: 1,
        size: 1000,
        department_id: selectedDepartment!.id,
        company_id: effectiveCompanyId,
      }),
    enabled: !!selectedDepartment && detailDrawerOpen && !!selectedDepartment.id,
  })

  const departments = departmentsQuery.data?.records || []
  const departmentDetail = departmentDetailQuery.data
  const departmentUsers = departmentUsersQuery.data?.items || []

  // 调试信息：检查查询状态
  useEffect(() => {
    if (departmentsQuery.isError) {
      console.error('部门列表查询错误:', departmentsQuery.error)
      messageApi.error(`获取部门列表失败: ${departmentsQuery.error?.message || '未知错误'}`)
    }
    if (departmentsQuery.data) {
      console.log('部门列表数据:', departmentsQuery.data)
    }
  }, [departmentsQuery.isError, departmentsQuery.error, departmentsQuery.data, messageApi])

  const openDetail = useCallback((department: Department) => {
    setSelectedDepartment(department)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedDepartment(null)
  }

  const openEdit = useCallback((department: Department) => {
    setEditingDepartment(department)
    departmentForm.setFieldsValue({
      title: department.title,
      sort: department.sort || 1,
    })
    setDepartmentModalOpen(true)
  }, [departmentForm])

  const openCreate = () => {
    setEditingDepartment(null)
    departmentForm.resetFields()
    departmentForm.setFieldsValue({
      sort: 1,
    })
    setDepartmentModalOpen(true)
  }

  const closeModal = () => {
    setDepartmentModalOpen(false)
    setEditingDepartment(null)
    departmentForm.resetFields()
  }

  // 创建部门
  const createMutation = useMutation({
    mutationFn: (data: { title: string; sort?: number }) =>
      createDepartment({
        ...data,
        company_id: effectiveCompanyId,
      }),
    onSuccess: () => {
      messageApi.success('部门创建成功')
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: (error: Error) => {
      messageApi.error(error.message || '创建部门失败')
    },
  })

  // 更新部门
  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; sort?: number }) =>
      updateDepartment(editingDepartment!.id, data),
    onSuccess: () => {
      messageApi.success('部门更新成功')
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      if (detailDrawerOpen) {
        queryClient.invalidateQueries({ queryKey: ['departments', 'detail', selectedDepartment?.id] })
      }
    },
    onError: (error: Error) => {
      messageApi.error(error.message || '更新部门失败')
    },
  })

  // 删除部门
  const deleteMutation = useMutation({
    mutationFn: (departmentId: number) => deleteDepartment(departmentId),
    onSuccess: () => {
      messageApi.success('部门删除成功')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      if (detailDrawerOpen) {
        closeDetail()
      }
    },
    onError: (error: Error) => {
      messageApi.error(error.message || '删除部门失败')
    },
  })

  // 更新用户部门
  const updateUserDepartmentMutation = useMutation({
    mutationFn: ({ userId, departmentId }: { userId: number; departmentId: number | undefined }) =>
      updateUser(userId, { department_id: departmentId }),
    onSuccess: () => {
      messageApi.success('用户部门更新成功')
      setUpdatingUserDepartment(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: (error: Error) => {
      messageApi.error(error.message || '更新用户部门失败')
      setUpdatingUserDepartment(null)
    },
  })

  const handleUserDepartmentChange = (userId: number, newDepartmentId: number | undefined) => {
    setUpdatingUserDepartment(userId)
    updateUserDepartmentMutation.mutate(
      { userId, departmentId: newDepartmentId },
      {
        onSuccess: () => {
          // 如果用户被移出当前部门，从列表中移除
          if (newDepartmentId !== selectedDepartment?.id) {
            queryClient.setQueryData(
              ['users', 'list', 'department', selectedDepartment?.id, effectiveCompanyId],
              (oldData: any) => {
                if (!oldData) return oldData
                return {
                  ...oldData,
                  items: oldData.items.filter((u: User) => u.id !== userId),
                  total: oldData.total - 1,
                }
              }
            )
          }
        },
      }
    )
  }

  const handleSubmit = (values: { title: string; sort?: number }) => {
    if (editingDepartment) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const handleDelete = (department: Department) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除部门"${department.title}"吗？如果该部门下有用户，请先转移用户后再删除。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteMutation.mutate(department.id)
      },
    })
  }

  const columns: ColumnsType<Department> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '部门名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '用户数量',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count || 0}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            disabled={record.user_count && record.user_count > 0}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  if (!effectiveCompanyId) {
    return (
      <Card>
        <Text type="secondary">请先选择公司</Text>
      </Card>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined /> 部门管理
          </Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['departments'] })}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建部门
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={departments}
          rowKey="id"
          loading={departmentsQuery.isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个部门`,
          }}
        />
      </Card>

      {/* 部门详情抽屉 */}
      <Drawer
        title="部门详情"
        placement="right"
        width={800}
        open={detailDrawerOpen}
        onClose={closeDetail}
      >
        {departmentDetailQuery.isLoading ? (
          <div>加载中...</div>
        ) : departmentDetail ? (
          <>
            <Descriptions column={1} bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label="部门ID">{departmentDetail.id}</Descriptions.Item>
              <Descriptions.Item label="部门名称">{departmentDetail.title}</Descriptions.Item>
              <Descriptions.Item label="公司名称">{departmentDetail.company_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户数量">
                <Tag color="blue">{departmentDetail.user_count || 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="排序">{departmentDetail.sort || 1}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {departmentDetail.created_at
                  ? dayjs(departmentDetail.created_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {departmentDetail.updated_at
                  ? dayjs(departmentDetail.updated_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 部门用户列表 */}
            <Card title="部门成员" style={{ marginTop: 16 }}>
              {departmentUsersQuery.isLoading ? (
                <div>加载中...</div>
              ) : departmentUsers.length > 0 ? (
                <Table
                  dataSource={departmentUsers}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  size="small"
                  columns={[
                    {
                      title: '姓名',
                      dataIndex: 'nickname',
                      key: 'nickname',
                      render: (value) => value || '-',
                    },
                    {
                      title: '手机号',
                      dataIndex: 'phone',
                      key: 'phone',
                    },
                    {
                      title: '职位',
                      dataIndex: 'position_type',
                      key: 'position_type',
                      render: (value) => value ? <Tag>{value}</Tag> : '-',
                    },
                    {
                      title: '车牌号',
                      dataIndex: 'plate',
                      key: 'plate',
                      render: (value) => value || '-',
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (value) => {
                        const color = value === 'active' ? 'green' : 'red'
                        return <Tag color={color}>{value === 'active' ? '正常' : '禁用'}</Tag>
                      },
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 200,
                      render: (_, record: User) => (
                        <Select
                          style={{ width: 150 }}
                          placeholder="调整部门"
                          value={record.department_id || undefined}
                          loading={updatingUserDepartment === record.id}
                          onChange={(value) => handleUserDepartmentChange(record.id, value)}
                          onClear={() => handleUserDepartmentChange(record.id, undefined)}
                          options={departments
                            .filter((d) => d.company_id === departmentDetail.company_id)
                            .map((d) => ({
                              label: d.title,
                              value: d.id,
                            }))}
                          allowClear
                          disabled={updatingUserDepartment === record.id}
                        />
                      ),
                    },
                  ]}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  该部门暂无成员
                </div>
              )}
            </Card>
          </>
        ) : (
          <div>暂无数据</div>
        )}
      </Drawer>

      {/* 创建/编辑部门模态框 */}
      <Modal
        title={editingDepartment ? '编辑部门' : '新建部门'}
        open={departmentModalOpen}
        onCancel={closeModal}
        onOk={() => departmentForm.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={departmentForm}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item
            name="sort"
            label="排序"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DepartmentsPage

