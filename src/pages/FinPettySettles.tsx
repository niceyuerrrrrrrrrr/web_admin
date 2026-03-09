import { useMemo, useState } from 'react'
import {
  App as AntdApp,
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  DatePicker,
  Form,
  Select,
  Empty,
  Statistic,
  Row,
  Col,
  Modal,
  Input,
  Drawer,
  Descriptions,
  Popconfirm,
} from 'antd'
import { PlusOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import client from '../api/client'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface PettySettleRecord {
  id: number
  code: string
  person_name: string
  settle_amount_cents: number
  settle_date: string
  remark: string
  status: string
  created_at: string
  grant_id?: number
  grant_code?: string
}

interface PettyGrantRecord {
  id: number
  code: string
  person_name: string
  grant_amount_cents: number
  remaining_amount_cents: number
  grant_date: string
  status: string
}

const statusColor = (status?: string) => {
  if (status === 'draft') return 'default'
  if (status === 'reviewing') return 'processing'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  return 'default'
}

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    draft: '草稿',
    reviewing: '审批中',
    approved: '已审批',
    rejected: '已拒绝',
  }
  return map[status || ''] || status || ''
}

const FinPettySettlesPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    status?: string
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<PettySettleRecord | null>(null)
  const [createForm] = Form.useForm()

  // 获取备用金发放列表
  const grantsQuery = useQuery({
    queryKey: ['fin', 'petty-grants', 'available', effectiveCompanyId],
    queryFn: async () => {
      const params: any = {
        page: 1,
        page_size: 200,
        status: 'approved', // 只获取已审批的发放单
      }
      if (effectiveCompanyId) params.company_id = effectiveCompanyId

      const response = await client.get('/fin/petty-grants', { params })
      if (!response.data.success) {
        throw new Error(response.data.message || '获取失败')
      }
      return response.data.data
    },
    enabled: (!isSuperAdmin || !!effectiveCompanyId) && createModalOpen,
  })

  const grants: PettyGrantRecord[] = grantsQuery.data?.records || []

  const listQuery = useQuery({
    queryKey: ['fin', 'petty-settles', filters, currentPage, pageSize, effectiveCompanyId],
    queryFn: async () => {
      const params: any = {
        page: currentPage,
        page_size: pageSize,
      }
      if (effectiveCompanyId) params.company_id = effectiveCompanyId
      if (filters.status) params.status = filters.status
      if (filters.dateRange) {
        params.begin_date = filters.dateRange[0].format('YYYY-MM-DD')
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD')
      }

      const response = await client.get('/fin/petty-settles', { params })
      if (!response.data.success) {
        throw new Error(response.data.message || '获取失败')
      }
      return response.data.data
    },
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const records: PettySettleRecord[] = listQuery.data?.records || []

  const statistics = useMemo(() => {
    const total = records.reduce((sum, r) => sum + (r.settle_amount_cents || 0), 0)
    const approved = records.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.settle_amount_cents || 0), 0)
    const reviewing = records.filter(r => r.status === 'reviewing').length
    
    return {
      total: total / 100,
      count: records.length,
      approved: approved / 100,
      reviewing,
    }
  }, [records])

  const quickFilters = [
    { label: '本月', days: 30 },
    { label: '本周', days: 7 },
    { label: '今日', days: 0 },
    { label: '待审批', status: 'reviewing' },
    { label: '已审批', status: 'approved' },
  ]

  const applyQuickFilter = (filter: typeof quickFilters[0]) => {
    if (filter.status) {
      setFilters({ ...filters, status: filter.status })
    } else if (filter.days !== undefined) {
      const end = dayjs()
      const start = filter.days === 0 ? dayjs() : dayjs().subtract(filter.days, 'day')
      setFilters({ ...filters, dateRange: [start, end] })
    }
    setCurrentPage(1)
  }

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const params: any = {}
      if (effectiveCompanyId) params.company_id = effectiveCompanyId
      
      const response = await client.post('/fin/petty-settles', {
        person_type: values.person_type || 'employee',
        person_name: values.person_name,
        settle_amount_cents: Math.round(Number(values.amount_yuan) * 100),
        settle_date: values.settle_date.format('YYYY-MM-DD'),
        remark: values.remark,
        grant_id: values.grant_id, // 关联备用金发放单
      }, { params })
      
      if (!response.data.success) {
        throw new Error(response.data.message || '创建失败')
      }
      return response.data.data
    },
    onSuccess: () => {
      message.success('备用金核销单已创建')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-settles'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-grants'] })
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败')
    },
  })

  const openDetail = (record: PettySettleRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  // 删除核销单
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const params: any = {}
      if (effectiveCompanyId) params.company_id = effectiveCompanyId
      
      const response = await client.delete(`/fin/petty-settles/${id}`, { params })
      
      if (!response.data.success) {
        throw new Error(response.data.message || '删除失败')
      }
      return response.data.data
    },
    onSuccess: () => {
      message.success('删除成功')
      setDetailDrawerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-settles'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-grants'] })
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败')
    },
  })

  // 撤回核销单
  const withdrawMutation = useMutation({
    mutationFn: async (id: number) => {
      const params: any = {}
      if (effectiveCompanyId) params.company_id = effectiveCompanyId
      
      const response = await client.post(`/fin/petty-settles/${id}/withdraw`, null, { params })
      
      if (!response.data.success) {
        throw new Error(response.data.message || '撤回失败')
      }
      return response.data.data
    },
    onSuccess: () => {
      message.success('撤回成功')
      setDetailDrawerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-settles'] })
    },
    onError: (error: any) => {
      message.error(error.message || '撤回失败')
    },
  })

  const columns: ColumnsType<PettySettleRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '单号',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: '核销人',
      dataIndex: 'person_name',
      key: 'person_name',
      width: 120,
    },
    {
      title: '核销金额(元)',
      dataIndex: 'settle_amount_cents',
      key: 'settle_amount_cents',
      width: 140,
      render: (v) => <Text strong>¥{((v || 0) / 100).toFixed(2)}</Text>,
    },
    {
      title: '核销日期',
      dataIndex: 'settle_date',
      key: 'settle_date',
      width: 120,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => <Tag color={statusColor(v)}>{statusText(v)}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: PettySettleRecord) => (
        <Space size="small">
          <Button size="small" onClick={() => openDetail(record)}>
            详情
          </Button>
          {record.status === 'draft' && (
            <Popconfirm
              title="确定删除此核销单？"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
          {record.status === 'reviewing' && (
            <Popconfirm
              title="确定撤回此核销单？"
              onConfirm={() => withdrawMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" icon={<RollbackOutlined />}>
                撤回
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleFilters = (values: any) => {
    setCurrentPage(1)
    setFilters({
      status: values.status,
      dateRange: values.dateRange,
    })
  }

  const handleReset = () => {
    setCurrentPage(1)
    setFilters({
      dateRange: [dayjs().subtract(29, 'day'), dayjs()],
    })
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              备用金核销
            </Title>
            {isSuperAdmin && !effectiveCompanyId ? (
              <Text type="warning">请先在右上角选择公司</Text>
            ) : null}
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={isSuperAdmin && !effectiveCompanyId}
          >
            新建核销单
          </Button>
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="核销总额"
                value={statistics.total}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="核销笔数"
                value={statistics.count}
                suffix="笔"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已审批金额"
                value={statistics.approved}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待审批"
                value={statistics.reviewing}
                suffix="笔"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space wrap>
            <Text strong>快速筛选：</Text>
            {quickFilters.map((filter, idx) => (
              <Button key={idx} size="small" onClick={() => applyQuickFilter(filter)}>
                {filter.label}
              </Button>
            ))}
          </Space>
        </Card>

        <Card>
          <Form layout="inline" onFinish={handleFilters} initialValues={filters}>
            <Form.Item label="状态" name="status">
              <Select
                allowClear
                style={{ width: 140 }}
                options={[
                  { label: '草稿', value: 'draft' },
                  { label: '审批中', value: 'reviewing' },
                  { label: '已审批', value: 'approved' },
                  { label: '已拒绝', value: 'rejected' },
                ]}
              />
            </Form.Item>
            <Form.Item label="日期" name="dateRange">
              <RangePicker />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card>
          {records.length === 0 && !listQuery.isLoading ? (
            <Empty description="暂无备用金核销记录" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={records}
              loading={listQuery.isLoading}
              scroll={{ x: 1100 }}
              pagination={{
                current: currentPage,
                pageSize,
                total: listQuery.data?.total || 0,
                onChange: (p, ps) => {
                  setCurrentPage(p)
                  setPageSize(ps)
                },
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
            />
          )}
        </Card>
      </Space>

      <Modal
        title="新建备用金核销单"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        width={600}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="关联备用金发放单"
            name="grant_id"
            rules={[{ required: true, message: '请选择备用金发放单' }]}
          >
            <Select
              placeholder="请选择备用金发放单"
              loading={grantsQuery.isLoading}
              onChange={(value) => {
                const grant = grants.find(g => g.id === value)
                if (grant) {
                  createForm.setFieldsValue({
                    person_name: grant.person_name,
                    amount_yuan: ((grant.remaining_amount_cents || 0) / 100).toFixed(2),
                  })
                }
              }}
            >
              {grants.map((grant) => (
                <Select.Option key={grant.id} value={grant.id}>
                  {grant.code} - {grant.person_name} (余额: ¥{((grant.remaining_amount_cents || 0) / 100).toFixed(2)})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="核销人姓名"
            name="person_name"
            rules={[{ required: true, message: '请输入核销人姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label="核销金额(元)"
            name="amount_yuan"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <Input type="number" placeholder="例如 1000.00" />
          </Form.Item>
          <Form.Item
            label="核销日期"
            name="settle_date"
            rules={[{ required: true, message: '请选择日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="请输入核销说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`备用金核销详情 #${selectedRecord?.id || ''}`}
        open={detailDrawerOpen}
        width={560}
        onClose={() => setDetailDrawerOpen(false)}
        extra={
          selectedRecord?.status === 'approved' ? null : (
            <Space>
              {selectedRecord?.status === 'draft' && (
                <Popconfirm
                  title="确定删除此核销单？"
                  onConfirm={() => {
                    if (selectedRecord?.id) {
                      deleteMutation.mutate(selectedRecord.id)
                    }
                  }}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              )}
              {selectedRecord?.status === 'reviewing' && (
                <Popconfirm
                  title="确定撤回此核销单？"
                  onConfirm={() => {
                    if (selectedRecord?.id) {
                      withdrawMutation.mutate(selectedRecord.id)
                    }
                  }}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button icon={<RollbackOutlined />} loading={withdrawMutation.isPending}>
                    撤回
                  </Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {selectedRecord && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedRecord.id}</Descriptions.Item>
            <Descriptions.Item label="单号">{selectedRecord.code || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联发放单">{selectedRecord.grant_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="核销人">{selectedRecord.person_name}</Descriptions.Item>
            <Descriptions.Item label="核销金额(元)">
              <Text strong>¥{((selectedRecord.settle_amount_cents || 0) / 100).toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="核销日期">{selectedRecord.settle_date}</Descriptions.Item>
            <Descriptions.Item label="备注">{selectedRecord.remark || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColor(selectedRecord.status)}>{statusText(selectedRecord.status)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedRecord.created_at ? dayjs(selectedRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}

export default FinPettySettlesPage
