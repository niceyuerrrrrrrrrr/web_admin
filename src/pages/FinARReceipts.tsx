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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinAccountRecord } from '../api/types'
import { fetchFinAccounts } from '../api/services/finBase'
import { fetchARList, type FinARRecord } from '../api/services/finArAp'
import {
  RECEIPT_STATUS_OPTIONS,
  createARReceipt,
  fetchARReceiptDetail,
  fetchARReceiptList,
  submitARReceipt,
  type FinARReceiptRecord,
} from '../api/services/finReceiptsPayments'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const statusColor = (status?: string) => {
  if (status === 'draft') return 'default'
  if (status === 'submitted' || status === 'reviewing') return 'processing'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  if (status === 'void') return 'default'
  return 'default'
}

const statusText = (status?: string) => {
  const found = RECEIPT_STATUS_OPTIONS.find((x) => x.value === status)
  return found?.label || status || ''
}

const centsToYuan = (cents?: number | null) => {
  const v = Number(cents || 0)
  return (v / 100).toFixed(2)
}

const FinARReceiptsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    status?: string
    arId?: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })

  const [selectedRecord, setSelectedRecord] = useState<FinARReceiptRecord | null>(null)
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

  const accountsQuery = useQuery({
    queryKey: ['fin', 'accounts', effectiveCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const arListQuery = useQuery({
    queryKey: ['fin', 'ar', 'unpaid', effectiveCompanyId],
    queryFn: () => fetchARList({ companyId: effectiveCompanyId, status: 'unpaid', page: 1, pageSize: 100 }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const accountOptions = (accountsQuery.data?.records || []).map((a: FinAccountRecord) => ({
    label: a.name,
    value: a.id,
  }))

  const arOptions = (arListQuery.data?.records || []).map((ar: FinARRecord) => ({
    label: `#${ar.id} - 应收 ${centsToYuan(ar.ar_amount_cents)} 元`,
    value: ar.id,
  }))

  const listQuery = useQuery({
    queryKey: ['fin', 'ar-receipts', filters, currentPage, pageSize, effectiveCompanyId],
    queryFn: () =>
      fetchARReceiptList({
        companyId: effectiveCompanyId,
        arId: filters.arId,
        status: filters.status,
        beginDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        page: currentPage,
        pageSize,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const detailQuery = useQuery({
    queryKey: ['fin', 'ar-receipts', 'detail', selectedRecord?.id, effectiveCompanyId],
    queryFn: () => fetchARReceiptDetail(selectedRecord!.id, { companyId: effectiveCompanyId }),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createARReceipt,
    onSuccess: () => {
      message.success('回款记录已创建')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'ar-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'ar'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => submitARReceipt(id, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['fin', 'ar-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'ar-receipts', 'detail', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '提交失败')
    },
  })

  const openDetail = (record: FinARReceiptRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const records = listQuery.data?.records || []

  const columns: ColumnsType<FinARReceiptRecord> = useMemo(
    () =>
      addResizableToColumns<FinARReceiptRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '应收单ID',
          dataIndex: 'ar_id',
          key: 'ar_id',
          width: 120,
        },
        {
          title: '回款金额(元)',
          dataIndex: 'receipt_amount_cents',
          key: 'receipt_amount_cents',
          width: 140,
          render: (v) => <Text strong>{centsToYuan(v)}</Text>,
        },
        {
          title: '回款日期',
          dataIndex: 'receipt_date',
          key: 'receipt_date',
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
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (v) => <Tag color={statusColor(v)}>{statusText(v)}</Tag>,
        },
        {
          title: '收款单ID',
          dataIndex: 'cash_in_id',
          key: 'cash_in_id',
          width: 120,
          render: (v) => v || '-',
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
      arId: values.arId,
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
  const canSubmit = canCreate

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              应收回款管理
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

        <Card>
          <Form layout="inline" onFinish={handleFilters} initialValues={filters}>
            <Form.Item label="状态" name="status">
              <Select allowClear style={{ width: 140 }} options={RECEIPT_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item label="应收单" name="arId">
              <Select allowClear showSearch style={{ width: 200 }} options={arOptions} />
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
        title={`回款记录详情 #${selectedRecord?.id || ''}`}
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
        {(() => {
          const d = detailQuery.data || selectedRecord
          if (!d) return <Empty description="暂无数据" />
          const accountName = (accountsQuery.data?.records || []).find((a) => a.id === d.account_id)?.name
          return (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{d.id}</Descriptions.Item>
              <Descriptions.Item label="单号">{d.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="应收单ID">{d.ar_id}</Descriptions.Item>
              <Descriptions.Item label="回款金额(元)">{centsToYuan(d.receipt_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="回款日期">{d.receipt_date}</Descriptions.Item>
              <Descriptions.Item label="回款方式">{d.receipt_method || '-'}</Descriptions.Item>
              <Descriptions.Item label="账户">{accountName || d.account_id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor(d.status)}>{statusText(d.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="收款单ID">{d.cash_in_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{(d as any).remark || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{d.created_at || '-'}</Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>

      <Modal
        title="新建回款记录"
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
              ar_id: values.ar_id,
              receipt_amount_cents: amountCents,
              receipt_date: values.receipt_date.format('YYYY-MM-DD'),
              receipt_method: values.receipt_method,
              account_id: values.account_id,
              remark: values.remark,
            })
          }}
        >
          <Form.Item label="应收单" name="ar_id" rules={[{ required: true, message: '请选择应收单' }]}>
            <Select showSearch placeholder="请选择应收单" options={arOptions} />
          </Form.Item>
          <Form.Item label="回款金额(元)" name="amount_yuan" rules={[{ required: true, message: '请输入金额' }]}>
            <Input placeholder="例如 123.45" />
          </Form.Item>
          <Form.Item label="回款日期" name="receipt_date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="回款方式" name="receipt_method">
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
          <Form.Item label="账户" name="account_id" rules={[{ required: true, message: '请选择账户' }]}>
            <Select options={accountOptions} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FinARReceiptsPage
