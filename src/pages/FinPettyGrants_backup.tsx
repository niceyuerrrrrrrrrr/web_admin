import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Tabs,
  Timeline,
  Typography,
  Statistic,
  Row,
  Col,
  Dropdown,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  DownloadOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinAccountRecord, FinCashInRecord, FinCustomerRecord } from '../api/types'
import { fetchFinAccounts, fetchFinCustomers } from '../api/services/finBase'
import {
  CASH_STATUS_OPTIONS,
  createCashIn,
  fetchCashInDetail,
  fetchCashInList,
  submitCashIn,
} from '../api/services/finCash'
import { fetchApprovalTimeline } from '../api/services/approval'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const statusColor = (status?: string) => {
  if (status === 'draft') return 'default'
  if (status === 'reviewing') return 'processing'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  return 'default'
}

const statusText = (status?: string) => {
  const found = CASH_STATUS_OPTIONS.find((x) => x.value === status)
  return found?.label || status || ''
}

const centsToYuan = (cents?: number | null) => {
  const v = Number(cents || 0)
  return (v / 100).toFixed(2)
}

const parseStringArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return (val as unknown[]).filter(Boolean).map((x) => String(x))
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return []
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
      } catch {
        return []
      }
    }
    return [s]
  }
  return []
}

const FinCashInPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    status?: string
    accountId?: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
    keyword?: string
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const [selectedRecord, setSelectedRecord] = useState<FinCashInRecord | null>(null)
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

  const [payerType, setPayerType] = useState<string>('other')

  useEffect(() => {
    if (createModalOpen) {
      createForm.setFieldsValue({
        cash_date: dayjs(),
        payer_type: 'other',
        method: 'bank',
      })
      setPayerType('other')
    }
  }, [createModalOpen, createForm])

  const accountsQuery = useQuery({
    queryKey: ['fin', 'accounts', effectiveCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const customersQuery = useQuery({
    queryKey: ['fin', 'customers', effectiveCompanyId],
    queryFn: () => fetchFinCustomers({ companyId: effectiveCompanyId, activeOnly: true }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const accountOptions = (accountsQuery.data?.records || []).map((a: FinAccountRecord) => ({
    label: a.name,
    value: a.id,
  }))

  const customerOptions = (customersQuery.data?.records || []).map((c: FinCustomerRecord) => ({
    label: c.name,
    value: c.id,
  }))

  const listQuery = useQuery({
    queryKey: ['fin', 'cash-in', filters, currentPage, pageSize, effectiveCompanyId],
    queryFn: () =>
      fetchCashInList({
        companyId: effectiveCompanyId,
        status: filters.status,
        accountId: filters.accountId,
        beginDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        page: currentPage,
        pageSize,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const detailQuery = useQuery({
    queryKey: ['fin', 'cash-in', 'detail', selectedRecord?.id, effectiveCompanyId],
    queryFn: () => fetchCashInDetail(selectedRecord!.id, { companyId: effectiveCompanyId }),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const timelineQuery = useQuery({
    queryKey: ['fin', 'cash-in', 'timeline', selectedRecord?.id],
    queryFn: () => fetchApprovalTimeline('fin_cash_in', selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createCashIn,
    onSuccess: () => {
      message.success('收款单已创建')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'cash-in'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => submitCashIn(id, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['fin', 'cash-in'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'cash-in', 'detail', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '提交失败')
    },
  })

  const openDetail = (record: FinCashInRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const records = listQuery.data?.records || []

  const columns: ColumnsType<FinCashInRecord> = useMemo(
    () =>
      addResizableToColumns<FinCashInRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '日期',
          dataIndex: 'cash_date',
          key: 'cash_date',
          width: 120,
        },
        {
          title: '账户',
          dataIndex: 'account_id',
          key: 'account_id',
          width: 160,
          render: (v) => {
            const found = (accountsQuery.data?.records || []).find((a) => a.id === v)
            return found?.name || v
          },
        },
        {
          title: '金额(元)',
          dataIndex: 'amount_cents',
          key: 'amount_cents',
          width: 140,
          render: (v) => <Text strong>{centsToYuan(v)}</Text>,
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
          width: 120,
          fixed: 'right',
          render: (_v, r) => (
            <Space>
              <Button size="small" onClick={() => openDetail(r)}>
                详情
              </Button>
            </Space>
          ),
        },
      ]),
    [addResizableToColumns, accountsQuery.data?.records],
  )

  const handleFilters = (values: any) => {
    setCurrentPage(1)
    setFilters({
      status: values.status,
      accountId: values.accountId,
      dateRange: values.dateRange,
    })
  }

  const handleReset = () => {
    setCurrentPage(1)
    setFilters({
      dateRange: [dayjs().subtract(29, 'day'), dayjs()],
    })
  }

  const canCreate = true
  const canSubmit = true

  // 统计数据
  const statistics = useMemo(() => {
    const total = records.reduce((sum, r) => sum + (r.amount_cents || 0), 0)
    const draftCount = records.filter(r => r.status === 'draft').length
    const reviewingCount = records.filter(r => r.status === 'reviewing').length
    const approvedCount = records.filter(r => r.status === 'approved').length
    return {
      total: total / 100,
      count: records.length,
      draftCount,
      reviewingCount,
      approvedCount,
    }
  }, [records])

  // 批量操作菜单
  const batchMenuItems: MenuProps['items'] = [
    {
      key: 'export',
      label: '批量导出',
      icon: <DownloadOutlined />,
      onClick: () => {
        message.info('批量导出功能开发中...')
      },
    },
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`,
          onOk: () => {
            message.info('批量删除功能开发中...')
            setSelectedRowKeys([])
          },
        })
      },
    },
  ]

  // 快速筛选
  const quickFilters = [
    { label: '今日', value: 'today', dateRange: [dayjs(), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '本周', value: 'week', dateRange: [dayjs().startOf('week'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '本月', value: 'month', dateRange: [dayjs().startOf('month'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '待审批', value: 'reviewing', status: 'reviewing' },
    { label: '已审批', value: 'approved', status: 'approved' },
  ]

  const applyQuickFilter = (filter: typeof quickFilters[0]) => {
    setCurrentPage(1)
    setFilters(prev => ({
      ...prev,
      dateRange: filter.dateRange || prev.dateRange,
      status: filter.status,
    }))
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              收款单
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
                title="收款总额"
                value={statistics.total}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="收款笔数"
                value={statistics.count}
                suffix="笔"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待审批"
                value={statistics.reviewingCount}
                suffix="笔"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已审批"
                value={statistics.approvedCount}
                suffix="笔"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 快速筛选 */}
        <Card>
          <Space wrap>
            <Text type="secondary">快速筛选：</Text>
            {quickFilters.map(qf => (
              <Button
                key={qf.value}
                size="small"
                onClick={() => applyQuickFilter(qf)}
              >
                {qf.label}
              </Button>
            ))}
          </Space>
        </Card>

        <Card>
          <Form layout="inline" onFinish={handleFilters} initialValues={filters}>
            <Form.Item label="状态" name="status">
              <Select allowClear style={{ width: 140 }} options={CASH_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item label="账户" name="accountId">
              <Select allowClear style={{ width: 200 }} options={accountOptions} />
            </Form.Item>
            <Form.Item label="日期" name="dateRange">
              <RangePicker />
            </Form.Item>
            <Form.Item label="关键词" name="keyword">
              <Input placeholder="搜索备注、ID等" style={{ width: 200 }} />
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
          {/* 批量操作工具栏 */}
          {selectedRowKeys.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Text>已选择 {selectedRowKeys.length} 条</Text>
                <Dropdown menu={{ items: batchMenuItems }}>
                  <Button>
                    批量操作 <DownOutlined />
                  </Button>
                </Dropdown>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>
                  取消选择
                </Button>
              </Space>
            </div>
          )}
          <Table
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
              ],
            }}
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
            columns={columns}
            dataSource={records}
            loading={listQuery.isLoading}
            scroll={{ x: 980 }}
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
        title={`收款单详情 #${selectedRecord?.id || ''}`}
        open={detailDrawerOpen}
        width={560}
        onClose={() => setDetailDrawerOpen(false)}
        extra={
          <Space>
            <Button
              type="primary"
              onClick={() => {
                if (!selectedRecord?.id) return
                submitMutation.mutate(selectedRecord.id)
              }}
              disabled={!canSubmit || !selectedRecord || selectedRecord.status !== 'draft'}
              loading={submitMutation.isPending}
            >
              提交审批
            </Button>
          </Space>
        }
      >
        <Tabs
          items={[
            {
              key: 'detail',
              label: '详情',
              children: (() => {
                const d = detailQuery.data || selectedRecord
                if (!d) return <Empty description="暂无数据" />
                const accountName = (accountsQuery.data?.records || []).find((a) => a.id === d.account_id)?.name
                const attachments = parseStringArray((d as any).attachments)
                return (
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="ID">{d.id}</Descriptions.Item>
                    <Descriptions.Item label="日期">{d.cash_date}</Descriptions.Item>
                    <Descriptions.Item label="账户">{accountName || d.account_id}</Descriptions.Item>
                    <Descriptions.Item label="金额(元)">{centsToYuan(d.amount_cents)}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={statusColor(d.status)}>{statusText(d.status)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="方式">{(d as any).method || ''}</Descriptions.Item>
                    <Descriptions.Item label="收款方类型">{(d as any).payer_type || ''}</Descriptions.Item>
                    <Descriptions.Item label="收款方ID">{(d as any).payer_id ?? ''}</Descriptions.Item>
                    <Descriptions.Item label="备注">{(d as any).remark || ''}</Descriptions.Item>
                    <Descriptions.Item label="附件">
                      {attachments.length ? (
                        <Space direction="vertical" size={4}>
                          {attachments.map((u) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer">
                              {u}
                            </a>
                          ))}
                        </Space>
                      ) : (
                        ''
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="提交人ID">{(d as any).created_by ?? ''}</Descriptions.Item>
                    <Descriptions.Item label="审批人ID">{(d as any).approved_by ?? ''}</Descriptions.Item>
                    <Descriptions.Item label="审批时间">{(d as any).approved_at ?? ''}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{(d as any).created_at ?? ''}</Descriptions.Item>
                    <Descriptions.Item label="更新时间">{(d as any).updated_at ?? ''}</Descriptions.Item>
                  </Descriptions>
                )
              })(),
            },
            {
              key: 'timeline',
              label: '审批流程',
              children: (() => {
                if (timelineQuery.isLoading) return <Text type="secondary">加载中...</Text>
                const t = timelineQuery.data
                if (!t || !t.nodes || !t.nodes.length) {
                  return <Empty description="暂无审批流程（可能尚未提交审批）" />
                }
                return (
                  <Timeline
                    items={t.nodes
                      .slice()
                      .sort((a, b) => (a.node_order || 0) - (b.node_order || 0))
                      .map((n) => {
                        const status = n.status || ''
                        const color = status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'blue'
                        const title = `${n.node_order}. ${n.node_name}`
                        const approver = n.approver_name || n.approver_role || ''
                        const time = n.approved_at || n.updated_at || n.created_at || ''
                        const comment = n.comment || ''
                        return {
                          color,
                          children: (
                            <div>
                              <div>
                                <Text strong>{title}</Text>
                                {approver ? <Text type="secondary">（{approver}）</Text> : null}
                              </div>
                              <div>
                                <Text type="secondary">状态：</Text>
                                <Text>{status || '-'}</Text>
                              </div>
                              {time ? (
                                <div>
                                  <Text type="secondary">时间：</Text>
                                  <Text>{time}</Text>
                                </div>
                              ) : null}
                              {comment ? (
                                <div>
                                  <Text type="secondary">意见：</Text>
                                  <Text>{comment}</Text>
                                </div>
                              ) : null}
                            </div>
                          ),
                        }
                      })}
                  />
                )
              })(),
            },
          ]}
        />
      </Drawer>

      <Modal
        title="新建收款单"
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
              account_id: values.account_id,
              payer_type: values.payer_type,
              payer_id: values.payer_id ? Number(values.payer_id) : undefined,
              amount_cents: amountCents,
              cash_date: values.cash_date.format('YYYY-MM-DD'),
              method: values.method,
              remark: values.remark,
            })
          }}
        >
          <Form.Item label="账户" name="account_id" rules={[{ required: true, message: '请选择账户' }]}>
            <Select options={accountOptions} />
          </Form.Item>
          <Form.Item label="收款方类型" name="payer_type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'customer', label: '客户' },
                { value: 'employee', label: '员工' },
                { value: 'other', label: '其他' },
              ]}
              onChange={(v) => {
                setPayerType(v)
                createForm.setFieldValue('payer_id', undefined)
              }}
            />
          </Form.Item>
          {payerType === 'customer' ? (
            <Form.Item label="客户" name="payer_id" rules={[{ required: true, message: '请选择客户' }]}>
              <Select
                showSearch
                placeholder="请选择客户"
                options={customerOptions}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          ) : (
            <Form.Item label="收款方ID" name="payer_id">
              <Input placeholder="可选" />
            </Form.Item>
          )}
          <Form.Item label="金额(元)" name="amount_yuan" rules={[{ required: true, message: '请输入金额' }]}>
            <Input placeholder="例如 123.45" />
          </Form.Item>
          <Form.Item label="收款日期" name="cash_date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="方式" name="method">
            <Select
              allowClear
              options={[
                { value: 'bank', label: '银行转账' },
                { value: 'cash', label: '现金' },
                { value: 'alipay', label: '支付宝' },
                { value: 'wechat', label: '微信' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FinCashInPage
