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
import type { FinSupplierRecord } from '../api/types'
import { fetchFinSuppliers } from '../api/services/finBase'
import { AP_STATUS_OPTIONS, createAP, fetchAPDetail, fetchAPList, type FinAPRecord } from '../api/services/finArAp'

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
  const found = AP_STATUS_OPTIONS.find((x) => x.value === status)
  return found?.label || status || ''
}

const centsToYuan = (cents?: number | null) => {
  const v = Number(cents || 0)
  return (v / 100).toFixed(2)
}

const FinAPPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    status?: string
    supplierId?: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })

  const [selectedRecord, setSelectedRecord] = useState<FinAPRecord | null>(null)
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

  const suppliersQuery = useQuery({
    queryKey: ['fin', 'suppliers', effectiveCompanyId],
    queryFn: () => fetchFinSuppliers({ companyId: effectiveCompanyId, activeOnly: true }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const supplierOptions = (suppliersQuery.data?.records || []).map((s: FinSupplierRecord) => ({
    label: s.name,
    value: s.id,
  }))

  const listQuery = useQuery({
    queryKey: ['fin', 'ap', filters, currentPage, pageSize, effectiveCompanyId],
    queryFn: () =>
      fetchAPList({
        companyId: effectiveCompanyId,
        supplierId: filters.supplierId,
        status: filters.status,
        beginDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        page: currentPage,
        pageSize,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const detailQuery = useQuery({
    queryKey: ['fin', 'ap', 'detail', selectedRecord?.id, effectiveCompanyId],
    queryFn: () => fetchAPDetail(selectedRecord!.id, { companyId: effectiveCompanyId }),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createAP,
    onSuccess: () => {
      message.success('应付单已创建')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['fin', 'ap'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const openDetail = (record: FinAPRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const records = listQuery.data?.records || []

  const columns: ColumnsType<FinAPRecord> = useMemo(
    () =>
      addResizableToColumns<FinAPRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '供应商',
          dataIndex: 'supplier_id',
          key: 'supplier_id',
          width: 160,
          render: (v) => {
            const found = (suppliersQuery.data?.records || []).find((s) => s.id === v)
            return found?.name || v
          },
        },
        {
          title: '应付金额(元)',
          dataIndex: 'ap_amount_cents',
          key: 'ap_amount_cents',
          width: 140,
          render: (v) => <Text strong>{centsToYuan(v)}</Text>,
        },
        {
          title: '已付金额(元)',
          dataIndex: 'paid_amount_cents',
          key: 'paid_amount_cents',
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
    [addResizableToColumns, suppliersQuery.data?.records],
  )

  const handleFilters = (values: any) => {
    setCurrentPage(1)
    setFilters({
      status: values.status,
      supplierId: values.supplierId,
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
              应付单管理
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
              <Select allowClear style={{ width: 140 }} options={AP_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item label="供应商" name="supplierId">
              <Select allowClear showSearch style={{ width: 200 }} options={supplierOptions} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
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
        title={`应付单详情 #${selectedRecord?.id || ''}`}
        open={detailDrawerOpen}
        width={560}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {(() => {
          const d = detailQuery.data || selectedRecord
          if (!d) return <Empty description="暂无数据" />
          const supplierName = (suppliersQuery.data?.records || []).find((s) => s.id === d.supplier_id)?.name
          return (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{d.id}</Descriptions.Item>
              <Descriptions.Item label="单号">{d.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商">{supplierName || d.supplier_id}</Descriptions.Item>
              <Descriptions.Item label="应付金额(元)">{centsToYuan(d.ap_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="已付金额(元)">{centsToYuan(d.paid_amount_cents)}</Descriptions.Item>
              <Descriptions.Item label="发生日期">{d.occur_date}</Descriptions.Item>
              <Descriptions.Item label="到期日期">{d.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor(d.status)}>{statusText(d.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源类型">{d.source_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="来源ID">{d.source_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="应付类型">{d.ap_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{d.remark || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{d.created_at || '-'}</Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>

      <Modal
        title="新建应付单"
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
              supplier_id: values.supplier_id,
              ap_type: values.ap_type,
              ap_amount_cents: amountCents,
              occur_date: values.occur_date.format('YYYY-MM-DD'),
              due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : undefined,
              remark: values.remark,
            })
          }}
        >
          <Form.Item label="供应商" name="supplier_id" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select showSearch placeholder="请选择供应商" options={supplierOptions} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item label="应付类型" name="ap_type">
            <Input placeholder="例如：货款、服务费等" />
          </Form.Item>
          <Form.Item label="应付金额(元)" name="amount_yuan" rules={[{ required: true, message: '请输入金额' }]}>
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

export default FinAPPage
