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
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinSupplierRecord } from '../api/types'
import { fetchFinAccounts, fetchFinSuppliers } from '../api/services/finBase'
import { AP_STATUS_OPTIONS, createAP, createAPPayment, fetchAPDetail, fetchAPList, type FinAPRecord } from '../api/services/finArAp'

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

  const isSuperAdmin = user?.role === 'super_admin'
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
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentRecord, setPaymentRecord] = useState<FinAPRecord | null>(null)
  const [paymentForm] = Form.useForm()

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
  
  const accountsQuery = useQuery({
    queryKey: ['fin', 'accounts', effectiveCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: effectiveCompanyId, activeOnly: true }),
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
  
  const paymentMutation = useMutation({
    mutationFn: createAPPayment,
    onSuccess: () => {
      message.success('付款单已提交，等待审批')
      paymentForm.resetFields()
      setPaymentModalOpen(false)
      setPaymentRecord(null)
      queryClient.invalidateQueries({ queryKey: ['fin', 'ap'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'ap-payments'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '付款失败')
    },
  })

  const openDetail = (record: FinAPRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }
  
  const openPayment = (record: FinAPRecord) => {
    setPaymentRecord(record)
    const unpaidCents = (record.ap_amount_cents || 0) - (record.paid_amount_cents || 0)
    const unpaidAmount = unpaidCents / 100
    paymentForm.setFieldsValue({
      pay_amount: unpaidAmount,
      pay_date: dayjs(),
      pay_method: 'bank',
    })
    setPaymentModalOpen(true)
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
          width: 200,
          fixed: 'right',
          render: (_v, r) => (
            <Space>
              <Button size="small" onClick={() => openDetail(r)}>
                详情
              </Button>
              <Button 
                size="small" 
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => openPayment(r)}
                disabled={r.status === 'settled' || r.status === 'void'}
              >
                付款
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

      <Modal
        title="应付账款付款"
        open={paymentModalOpen}
        onCancel={() => {
          setPaymentModalOpen(false)
          setPaymentRecord(null)
          paymentForm.resetFields()
        }}
        onOk={() => paymentForm.submit()}
        confirmLoading={paymentMutation.isPending}
        destroyOnClose
        width={600}
      >
        {paymentRecord && (
          <Form
            form={paymentForm}
            layout="vertical"
            onFinish={(values) => {
              const payload = {
                apId: paymentRecord.id,
                companyId: effectiveCompanyId,
                pay_amount: Number(values.pay_amount),
                pay_date: values.pay_date.format('YYYY-MM-DD'),
                pay_method: values.pay_method as string,
                account_id: Number(values.account_id),
                remark: values.remark as string | undefined,
              }
              paymentMutation.mutate(payload)
            }}
          >
            <Form.Item label="应付单号">
              <Input value={paymentRecord.code || `#${paymentRecord.id}`} disabled />
            </Form.Item>
            <Form.Item label="供应商">
              <Input 
                value={
                  (suppliersQuery.data?.records || []).find((s) => s.id === paymentRecord.supplier_id)?.name || 
                  paymentRecord.supplier_id
                } 
                disabled 
              />
            </Form.Item>
            <Form.Item label="应付总额">
              <Input value={`¥${centsToYuan(paymentRecord.ap_amount_cents)}`} disabled />
            </Form.Item>
            <Form.Item label="已付金额">
              <Input value={`¥${centsToYuan(paymentRecord.paid_amount_cents)}`} disabled />
            </Form.Item>
            <Form.Item label="未付金额">
              <Input 
                value={`¥${centsToYuan((paymentRecord.ap_amount_cents || 0) - (paymentRecord.paid_amount_cents || 0))}`} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item 
              label="付款金额" 
              name="pay_amount"
              rules={[
                { required: true, message: '请输入付款金额' },
                {
                  validator: (_, value) => {
                    const unpaidAmount = ((paymentRecord.ap_amount_cents || 0) - (paymentRecord.paid_amount_cents || 0)) / 100
                    if (value > unpaidAmount) {
                      return Promise.reject(new Error(`付款金额不能超过未付金额 ¥${unpaidAmount.toFixed(2)}`))
                    }
                    if (value <= 0) {
                      return Promise.reject(new Error('付款金额必须大于0'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={((paymentRecord.ap_amount_cents || 0) - (paymentRecord.paid_amount_cents || 0)) / 100}
                step={0.01}
                precision={2}
                placeholder="请输入付款金额"
                addonBefore="¥"
              />
            </Form.Item>
            
            <Form.Item 
              label="付款日期" 
              name="pay_date"
              rules={[{ required: true, message: '请选择付款日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item 
              label="付款方式" 
              name="pay_method"
              rules={[{ required: true, message: '请选择付款方式' }]}
            >
              <Select placeholder="请选择付款方式">
                <Select.Option value="bank">银行转账</Select.Option>
                <Select.Option value="cash">现金</Select.Option>
                <Select.Option value="wechat">微信</Select.Option>
                <Select.Option value="alipay">支付宝</Select.Option>
                <Select.Option value="other">其他</Select.Option>
              </Select>
            </Form.Item>
            
            <Form.Item 
              label="付款账户" 
              name="account_id"
              rules={[{ required: true, message: '请选择付款账户' }]}
            >
              <Select placeholder="请选择付款账户">
                {(accountsQuery.data?.records || []).map((account: any) => (
                  <Select.Option key={account.id} value={account.id}>
                    {account.name} {account.type ? `(${account.type})` : ''}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={3} placeholder="请输入备注信息" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default FinAPPage
