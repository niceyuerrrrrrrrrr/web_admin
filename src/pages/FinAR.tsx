import { useCallback, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Statistic,
  Row,
  Col,
  Progress,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Column } from '@ant-design/plots'
import {
  WarningOutlined,
  BellOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinCustomerRecord } from '../api/types'
import { fetchFinCustomers } from '../api/services/finBase'
import { AR_STATUS_OPTIONS, createAR, fetchARDetail, fetchARList, type FinARRecord } from '../api/services/finArAp'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const statusColor = (status?: string) => {
  if (status === 'unpaid') return 'error'
  if (status === 'partial') return 'warning'
  if (status === 'settled') return 'success'
  if (status === 'void') return 'default'
  return 'default'
}

const statusText = (status?: string) => {
  const found = AR_STATUS_OPTIONS.find((x) => x.value === status)
  return found?.label || status || ''
}

const centsToYuan = (cents?: number | null) => {
  const v = Number(cents || 0)
  return (v / 100).toFixed(2)
}

// 计算账龄（天数）
const calculateAgeDays = (dueDate?: string) => {
  if (!dueDate) return 0
  const due = dayjs(dueDate)
  const today = dayjs()
  return today.diff(due, 'day')
}

// 账龄分类
const getAgeCategory = (days: number) => {
  if (days < 0) return '未到期'
  if (days <= 30) return '0-30天'
  if (days <= 60) return '31-60天'
  if (days <= 90) return '61-90天'
  return '90天以上'
}

const FinARPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    status?: string
    customerId?: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })

  const [selectedRecord, setSelectedRecord] = useState<FinARRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const handleResize = useCallback(
    (key: string) =>
      (_e: any, { size }: any) => {
        setColumnWidths((prev) => ({ ...prev, [key]: size.width }))
      },
    [],
  )

  const addResizableToColumns = useCallback(
    <T,>(columns: ColumnsType<T>): ColumnsType<T> => {
      return columns.map((col: any) => {
        if (!col.width || col.fixed === 'right') return col
        const key = col.key || (typeof col.dataIndex === 'string' ? col.dataIndex : String(col.title || 'unknown'))
        return {
          ...col,
          width: columnWidths[key] || col.width,
          onHeaderCell: () => ({
            width: columnWidths[key] || col.width,
            onResize: handleResize(key),
          }),
        }
      }) as ColumnsType<T>
    },
    [columnWidths, handleResize],
  )

  const customersQuery = useQuery({
    queryKey: ['fin', 'customers', effectiveCompanyId],
    queryFn: () => fetchFinCustomers({ companyId: effectiveCompanyId, activeOnly: true }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const customerOptions = (customersQuery.data?.records || []).map((c: FinCustomerRecord) => ({
    label: c.name,
    value: c.id,
  }))

  const listQuery = useQuery({
    queryKey: ['fin', 'ar', filters, currentPage, pageSize, effectiveCompanyId],
    queryFn: () =>
      fetchARList({
        companyId: effectiveCompanyId,
        customerId: filters.customerId,
        status: filters.status,
        beginDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        page: currentPage,
        pageSize,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const detailQuery = useQuery({
    queryKey: ['fin', 'ar', 'detail', selectedRecord?.id, effectiveCompanyId],
    queryFn: () => fetchARDetail(selectedRecord!.id, { companyId: effectiveCompanyId }),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createAR,
    onSuccess: () => {
      message.success('应收单已创建')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'ar'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const openDetail = (record: FinARRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const records = listQuery.data?.records || []

  // 统计数据
  const statistics = useMemo(() => {
    const total = records.reduce((sum, r) => sum + ((r.ar_amount_cents || 0) - (r.received_amount_cents || 0)), 0)
    const received = records.reduce((sum, r) => sum + (r.received_amount_cents || 0), 0)
    const unreceived = records.reduce((sum, r) => sum + ((r.ar_amount_cents || 0) - (r.received_amount_cents || 0)), 0)
    
    // 计算逾期金额
    const today = dayjs()
    const overdue = records
      .filter(r => r.due_date && dayjs(r.due_date).isBefore(today) && r.status !== 'settled')
      .reduce((sum, r) => sum + ((r.ar_amount_cents || 0) - (r.received_amount_cents || 0)), 0)
    
    return {
      total: total / 100,
      received: received / 100,
      unreceived: unreceived / 100,
      overdue: overdue / 100,
      count: records.length,
    }
  }, [records])

  // 账龄分析数据
  const ageAnalysis = useMemo(() => {
    const categories = {
      '未到期': 0,
      '0-30天': 0,
      '31-60天': 0,
      '61-90天': 0,
      '90天以上': 0,
    }
    
    records.forEach(r => {
      if (r.status === 'settled') return
      const days = calculateAgeDays(r.due_date)
      const category = getAgeCategory(days)
      const amount = ((r.ar_amount_cents || 0) - (r.received_amount_cents || 0)) / 100
      categories[category] += amount
    })
    
    return Object.entries(categories).map(([name, value]) => ({
      category: name,
      value: Number(value.toFixed(2)),
    }))
  }, [records])

  // 催收功能
  const handleCollect = (_record: FinARRecord) => {
    Modal.confirm({
      title: '发送催收通知',
      content: `确定要向客户发送催收通知吗？`,
      onOk: () => {
        message.info('催收功能开发中...')
      },
    })
  }

  const columns: ColumnsType<FinARRecord> = useMemo(
    () =>
      addResizableToColumns<FinARRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '客户',
          dataIndex: 'customer_id',
          key: 'customer_id',
          width: 160,
          render: (v) => {
            const found = (customersQuery.data?.records || []).find((c) => c.id === v)
            return found?.name || v
          },
        },
        {
          title: '应收金额(元)',
          dataIndex: 'ar_amount_cents',
          key: 'ar_amount_cents',
          width: 140,
          render: (v) => <Text strong>{centsToYuan(v)}</Text>,
        },
        {
          title: '已收金额(元)',
          dataIndex: 'received_amount_cents',
          key: 'received_amount_cents',
          width: 140,
          render: (v) => <Text>{centsToYuan(v)}</Text>,
        },
        {
          title: '发生日期',
          dataIndex: 'occur_date',
          key: 'occur_date',
          width: 120,
        },
        {
          title: '到期日期',
          dataIndex: 'due_date',
          key: 'due_date',
          width: 120,
          render: (v, r) => {
            if (!v) return '-'
            const days = calculateAgeDays(v)
            const isOverdue = days > 0 && r.status !== 'settled'
            return (
              <Space>
                <span>{v}</span>
                {isOverdue && (
                  <Tag color="error" icon={<WarningOutlined />}>
                    逾期{days}天
                  </Tag>
                )}
              </Space>
            )
          },
        },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (v) => <Tag color={statusColor(v)}>{statusText(v)}</Tag>,
        },
        {
          title: '操作',
          key: 'actions',
          width: 160,
          fixed: 'right',
          render: (_v, r) => {
            const isOverdue = r.due_date && calculateAgeDays(r.due_date) > 0 && r.status !== 'settled'
            return (
              <Space>
                <Button size="small" onClick={() => openDetail(r)}>
                  详情
                </Button>
                {isOverdue && (
                  <Button 
                    size="small" 
                    danger
                    icon={<BellOutlined />}
                    onClick={() => handleCollect(r)}
                  >
                    催收
                  </Button>
                )}
              </Space>
            )
          },
        },
      ]),
    [addResizableToColumns, customersQuery.data?.records],
  )

  const handleFilters = (values: any) => {
    setCurrentPage(1)
    setFilters({
      status: values.status,
      customerId: values.customerId,
      dateRange: values.dateRange,
    })
  }

  const handleReset = () => {
    setCurrentPage(1)
    setFilters({
      dateRange: [dayjs().subtract(29, 'day'), dayjs()],
    })
  }

  const canCreate = user?.role === 'super_admin' || user?.positionType === '超级管理员' || user?.positionType === '财务' || user?.positionType === '总经理'

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              应收单管理
            </Title>
            {isSuperAdmin && !effectiveCompanyId ? (
              <Text type="warning">请先在右上角选择公司</Text>
            ) : null}
          </div>
          <Space>
            <Button
              type="primary"
              onClick={() => setCreateModalOpen(true)}
              disabled={!canCreate || (isSuperAdmin && !effectiveCompanyId)}
            >
              新建
            </Button>
          </Space>
        </div>

        {/* 统计卡片 */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="应收总额"
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
                title="已收金额"
                value={statistics.received}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="未收金额"
                value={statistics.unreceived}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="逾期金额"
                value={statistics.overdue}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#cf1322' }}
                suffix={
                  statistics.overdue > 0 ? (
                    <WarningOutlined style={{ fontSize: 16 }} />
                  ) : null
                }
              />
            </Card>
          </Col>
        </Row>

        {/* 账龄分析 */}
        <Card title="账龄分析">
          <Column
            data={ageAnalysis}
            xField="category"
            yField="value"
            label={{
              position: 'top' as const,
              formatter: (datum: any) => `¥${datum.value.toFixed(2)}`,
            }}
            meta={{
              category: { alias: '账龄' },
              value: { alias: '金额（元）' },
            }}
            color={({ category }: any) => {
              if (category === '未到期') return '#52c41a'
              if (category === '0-30天') return '#1890ff'
              if (category === '31-60天') return '#faad14'
              if (category === '61-90天') return '#ff7a45'
              return '#cf1322'
            }}
            height={250}
          />
        </Card>

        <Card>
          <Form layout="inline" onFinish={handleFilters} initialValues={filters}>
            <Form.Item label="状态" name="status">
              <Select allowClear style={{ width: 140 }} options={AR_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item label="客户" name="customerId">
              <Select allowClear showSearch style={{ width: 200 }} options={customerOptions} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
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
          <Table
            rowKey="id"
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
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
        </Card>
      </Space>

      <Drawer
        title={`应收单详情 #${selectedRecord?.id || ''}`}
        open={detailDrawerOpen}
        width={560}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {(() => {
          const d = detailQuery.data || selectedRecord
          if (!d) return <Empty description="暂无数据" />
          const customerName = (customersQuery.data?.records || []).find((c) => c.id === d.customer_id)?.name
          return (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{d.id}</Descriptions.Item>
              <Descriptions.Item label="单号">{d.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户">{customerName || d.customer_id}</Descriptions.Item>
              <Descriptions.Item label="应收金额(元)">{centsToYuan(d.ar_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="已收金额(元)">{centsToYuan(d.received_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="发生日期">{d.occur_date}</Descriptions.Item>
              <Descriptions.Item label="到期日期">{d.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor(d.status)}>{statusText(d.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源类型">{d.source_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源ID">{d.source_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="应收类型">{d.ar_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{d.remark || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{d.created_at || '-'}</Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>

      <Modal
        title="新建应收单"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => {
            const amountYuan = Number(values.amount_yuan)
            const amountCents = Math.round(amountYuan * 100)
            createMutation.mutate({
              companyId: effectiveCompanyId,
              customer_id: values.customer_id,
              ar_type: values.ar_type,
              ar_amount_cents: amountCents,
              occur_date: values.occur_date.format('YYYY-MM-DD'),
              due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
              remark: values.remark,
            })
          }}
        >
          <Form.Item label="客户" name="customer_id" rules={[{ required: true, message: '请选择客户' }]}>
            <Select showSearch placeholder="请选择客户" options={customerOptions} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item label="应收类型" name="ar_type">
            <Input placeholder="例如：货款、服务费等" />
          </Form.Item>
          <Form.Item label="应收金额(元)" name="amount_yuan" rules={[{ required: true, message: '请输入金额' }]}>
            <Input placeholder="例如 123.45" />
          </Form.Item>
          <Form.Item label="发生日期" name="occur_date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="到期日期" name="due_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FinARPage
