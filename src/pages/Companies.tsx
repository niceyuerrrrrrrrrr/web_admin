import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  createCompany,
  fetchCompanies,
  fetchCompanyDetail,
  fetchCompanyStatistics,
  fetchCompanyUsers,
  updateCompany,
  updateCompanyStatus,
  type Company,
} from '../api/services/companies'
import useAuthStore from '../store/auth'

const { Title, Paragraph, Text } = Typography

const CompaniesPage = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()
  const { user } = useAuthStore()
  
  // 检查是否为超级管理员
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  
  // 如果不是超级管理员，重定向到首页
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const [filters, setFilters] = useState<{ status?: string }>({})
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companyForm] = Form.useForm()

  // 获取公司列表
  const companiesQuery = useQuery({
    queryKey: ['companies', 'list', filters],
    queryFn: () => fetchCompanies({ status: filters.status }),
  })

  useEffect(() => {
    if (companiesQuery.data?.records) {
      // 调试接口返回，确认是否带有 invitation_code
      const sample = companiesQuery.data.records.slice(0, 3)
      // eslint-disable-next-line no-console
      console.debug('[companies] sample', sample)
      sample.forEach((c: any, i: number) => {
        // eslint-disable-next-line no-console
        console.debug(`[companies] item ${i}:`, {
          id: c.id,
          name: c.name,
          invitation_code: c.invitation_code,
          has_invitation_code: 'invitation_code' in c,
          all_keys: Object.keys(c),
        })
      })
    }
  }, [companiesQuery.data])

  // 获取公司详情
  const companyDetailQuery = useQuery({
    queryKey: ['companies', 'detail', selectedCompany?.id],
    queryFn: () => fetchCompanyDetail(selectedCompany!.id),
    enabled: !!selectedCompany && detailDrawerOpen,
  })

  // 获取公司统计
  const companyStatsQuery = useQuery({
    queryKey: ['companies', 'statistics', selectedCompany?.id],
    queryFn: () => fetchCompanyStatistics(selectedCompany!.id),
    enabled: !!selectedCompany && detailDrawerOpen,
  })

  // 获取公司用户
  const companyUsersQuery = useQuery({
    queryKey: ['companies', 'users', selectedCompany?.id],
    queryFn: () => fetchCompanyUsers({ companyId: selectedCompany!.id, page: 1, pageSize: 100 }),
    enabled: !!selectedCompany && detailDrawerOpen,
  })

  const companies = companiesQuery.data?.records || []
  const companyDetail = companyDetailQuery.data
  const companyStats = companyStatsQuery.data
  const companyUsers = companyUsersQuery.data?.users || []

  const handleSearch = (values: { status?: string }) => {
    setFilters({
      status: values.status,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = useCallback((company: Company) => {
    setSelectedCompany(company)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedCompany(null)
  }

  const openEdit = useCallback((company: Company) => {
    setEditingCompany(company)
    companyForm.setFieldsValue({
      name: company.name,
      business_type: company.business_type,
      status: company.status,
    })
    setCompanyModalOpen(true)
  }, [companyForm])

  const openCreate = () => {
    setEditingCompany(null)
    companyForm.resetFields()
    setCompanyModalOpen(true)
  }

  const closeModal = () => {
    setCompanyModalOpen(false)
    setEditingCompany(null)
    companyForm.resetFields()
  }

  // 创建/更新公司
  const saveCompanyMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingCompany) {
        return updateCompany(editingCompany.id, data)
      }
      return createCompany(data)
    },
    onSuccess: () => {
      message.success(editingCompany ? '公司更新成功' : '公司创建成功')
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '操作失败')
    },
  })

  // 更新状态
  const updateStatusMutation = useMutation({
    mutationFn: ({ companyId, status }: { companyId: number; status: 'active' | 'inactive' }) =>
      updateCompanyStatus(companyId, status),
    onSuccess: () => {
      message.success('状态更新成功')
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  // 公司列表列定义
  const companyColumns: ColumnsType<Company> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '公司名称',
        dataIndex: 'name',
        width: 200,
        render: (value) => <Text strong>{value}</Text>,
      },
      {
        title: '邀请码',
        dataIndex: 'invitation_code',
        width: 160,
        render: (value) =>
          value ? (
            <Space>
              <Text code>{value}</Text>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  navigator.clipboard.writeText(value)
                  message.success('已复制')
                }}
              >
                复制
              </Button>
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: '业务类型',
        dataIndex: 'business_type',
        width: 120,
        render: (value) => {
          if (!value) return <Text type="secondary">-</Text>
          // 罐车显示蓝色，挂车、侧翻、水泥罐车显示绿色
          const color = value === '罐车' ? 'blue' : 'green'
          return <Tag color={color}>{value}</Tag>
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value) => {
          const isActive = value === 'active'
          return <Tag color={isActive ? 'success' : 'error'}>{isActive ? '启用' : '禁用'}</Tag>
        },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              onClick={() => {
                const newStatus = record.status === 'active' ? 'inactive' : 'active'
                modal.confirm({
                  title: '确认操作',
                  content: `确定要${newStatus === 'active' ? '启用' : '禁用'}该公司吗？`,
                  onOk: () => updateStatusMutation.mutate({ companyId: record.id, status: newStatus }),
                })
              }}
              loading={updateStatusMutation.isPending}
            >
              {record.status === 'active' ? '禁用' : '启用'}
            </Button>
          </Space>
        ),
      },
    ],
    [openDetail, openEdit, updateStatusMutation],
  )

  const handleSaveCompany = () => {
    companyForm.validateFields().then((values) => {
      if (editingCompany) {
        saveCompanyMutation.mutate({
          name: values.name,
          business_type: values.business_type,
          status: values.status,
        })
      } else {
        saveCompanyMutation.mutate({
          name: values.name,
          business_type: values.business_type,
          status: values.status || 'active',
        })
      }
    })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            公司管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理多公司/多租户，配置公司信息和数据隔离。
          </Paragraph>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['companies'] })}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建公司
          </Button>
        </Space>
      </Flex>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
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

          {companiesQuery.error && (
            <Alert
              type="error"
              showIcon
              message={(companiesQuery.error as Error).message || '数据加载失败'}
            />
          )}

          <Table
            rowKey="id"
            columns={companyColumns}
            dataSource={companies}
            loading={companiesQuery.isLoading}
            pagination={{
              total: companiesQuery.data?.total || 0,
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 家公司`,
            }}
            scroll={{ x: 1000 }}
          />
        </Space>
      </Card>

      {/* 详情Drawer */}
      <Drawer
        title={`公司详情 - ${selectedCompany?.name || ''}`}
        width={800}
        open={detailDrawerOpen}
        onClose={closeDetail}
      >
        {companyDetail && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基本信息 */}
            <Card title="基本信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="公司ID">{companyDetail.id}</Descriptions.Item>
                <Descriptions.Item label="公司名称">{companyDetail.name}</Descriptions.Item>
                <Descriptions.Item label="业务类型">
                  {companyDetail.business_type ? (
                    <Tag color={companyDetail.business_type === '罐车' ? 'blue' : 'green'}>
                      {companyDetail.business_type}
                    </Tag>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={companyDetail.status === 'active' ? 'success' : 'error'}>
                    {companyDetail.status === 'active' ? '启用' : '禁用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {companyDetail.created_at
                    ? dayjs(companyDetail.created_at).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {companyDetail.updated_at
                    ? dayjs(companyDetail.updated_at).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 统计信息 */}
            {companyStats && (
              <Card title="统计信息" size="small">
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="总用户数"
                      value={companyStats.total_users}
                      prefix={<TeamOutlined />}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="活跃用户"
                      value={companyStats.active_users}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="禁用用户"
                      value={companyStats.inactive_users}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Col>
                </Row>
                {Object.keys(companyStats.role_distribution).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>角色分布：</Text>
                    <Space wrap style={{ marginTop: 8 }}>
                      {Object.entries(companyStats.role_distribution).map(([role, count]) => (
                        <Tag key={role}>
                          {role}: {count}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </Card>
            )}

            {/* 用户列表 */}
            <Card title="用户列表" size="small" loading={companyUsersQuery.isLoading}>
              {companyUsers.length > 0 ? (
                <Table
                  rowKey="id"
                  columns={[
                    { title: 'ID', dataIndex: 'id', width: 80 },
                    { title: '姓名', dataIndex: 'name', width: 120 },
                    { title: '手机号', dataIndex: 'phone', width: 130 },
                    {
                      title: '角色',
                      dataIndex: 'position_type',
                      width: 120,
                      render: (value) => <Tag>{value || '未设置'}</Tag>,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (value) => (
                        <Tag color={value === 'active' ? 'success' : 'error'}>
                          {value === 'active' ? '启用' : '禁用'}
                        </Tag>
                      ),
                    },
                  ]}
                  dataSource={companyUsers}
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无用户" />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      {/* 创建/编辑Modal */}
      <Modal
        title={editingCompany ? '编辑公司' : '新建公司'}
        open={companyModalOpen}
        onCancel={closeModal}
        onOk={handleSaveCompany}
        confirmLoading={saveCompanyMutation.isPending}
      >
        <Form form={companyForm} layout="vertical">
          <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item
            name="business_type"
            label="业务类型"
            rules={[{ required: true, message: '请选择业务类型' }]}
          >
            <Select
              placeholder="请选择业务类型"
              options={[
                { value: '侧翻', label: '侧翻' },
                { value: '水泥罐车', label: '水泥罐车' },
                { value: '挂车', label: '挂车' },
                { value: '罐车', label: '罐车' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '禁用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default CompaniesPage

