import { useCallback, useMemo, useState } from 'react'
import { App as AntdApp, Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinAccountCashflowRecord, FinAccountRecord } from '../api/types'
import { createFinAccount, fetchFinAccountCashflows, fetchFinAccounts, toggleFinAccountActive, updateFinAccount } from '../api/services/finBase'

const { Title, Text } = Typography

const centsToYuan = (cents?: number | null) => {
  const v = Number(cents || 0)
  return (v / 100).toFixed(2)
}

const yuanToCents = (yuan: any) => {
  const v = Number(yuan || 0)
  return Math.round(v * 100)
}

const FinAccountsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const userPosition = (user as any)?.positionType || (user as any)?.position_type
  const canEdit = isSuperAdmin || ['财务', '总经理'].includes(userPosition)

  const [filters, setFilters] = useState<{ activeOnly: boolean }>({ activeOnly: true })

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<FinAccountRecord | null>(null)
  const [cashflowOpen, setCashflowOpen] = useState(false)
  const [cashflowAccount, setCashflowAccount] = useState<FinAccountRecord | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

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

  const listQuery = useQuery({
    queryKey: ['fin', 'accounts', filters, effectiveCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: effectiveCompanyId, activeOnly: filters.activeOnly }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const cashflowQuery = useQuery({
    queryKey: ['fin', 'account-cashflows', cashflowAccount?.id, effectiveCompanyId],
    queryFn: () => fetchFinAccountCashflows(cashflowAccount!.id, { companyId: effectiveCompanyId }),
    enabled: !!cashflowAccount && cashflowOpen,
  })

  const cashflowView = useMemo(() => {
    const openingBalance = Number(cashflowAccount?.opening_balance_cents || 0)
    const rawRecords = cashflowQuery.data?.records || []
    const orderedRecords = [...rawRecords].sort((a, b) => {
      const aKey = `${a.date || ''} ${a.approved_at || ''} ${String(a.id).padStart(10, '0')}`
      const bKey = `${b.date || ''} ${b.approved_at || ''} ${String(b.id).padStart(10, '0')}`
      return aKey.localeCompare(bKey)
    })

    let runningBalance = openingBalance
    const withRunningBalance = orderedRecords.map((record) => {
      runningBalance += record.direction === 'in' ? Number(record.amount_cents || 0) : -Number(record.amount_cents || 0)
      return {
        ...record,
        running_balance_cents: runningBalance,
      }
    })

    const incomeTotal = withRunningBalance
      .filter((record) => record.direction === 'in')
      .reduce((sum, record) => sum + Number(record.amount_cents || 0), 0)
    const expenseTotal = withRunningBalance
      .filter((record) => record.direction === 'out')
      .reduce((sum, record) => sum + Number(record.amount_cents || 0), 0)

    return {
      openingBalance,
      incomeTotal,
      expenseTotal,
      netFlow: incomeTotal - expenseTotal,
      records: [...withRunningBalance].reverse(),
    }
  }, [cashflowAccount?.opening_balance_cents, cashflowQuery.data?.records])

  const createMutation = useMutation({
    mutationFn: createFinAccount,
    onSuccess: () => {
      message.success('已创建')
      setCreateOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['fin', 'accounts'] })
    },
    onError: (e) => message.error((e as Error).message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: any }) => updateFinAccount(payload.id, payload.data),
    onSuccess: () => {
      message.success('已更新')
      setEditOpen(false)
      editForm.resetFields()
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['fin', 'accounts'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; isActive: number }) =>
      toggleFinAccountActive(payload.id, { is_active: payload.isActive, companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['fin', 'accounts'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const columns: ColumnsType<FinAccountRecord> = useMemo(
    () =>
      addResizableToColumns<FinAccountRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '账户名称',
          dataIndex: 'name',
          key: 'name',
          width: 220,
        },
        {
          title: '类型',
          dataIndex: 'type',
          key: 'type',
          width: 120,
        },
        {
          title: '期初余额(元)',
          dataIndex: 'opening_balance_cents',
          key: 'opening_balance_cents',
          width: 140,
          render: (v) => centsToYuan(v),
        },
        {
          title: '当前余额(元)',
          dataIndex: 'balance_cents',
          key: 'balance_cents',
          width: 140,
          render: (v) => <Text strong>{centsToYuan(v)}</Text>,
        },
        {
          title: '启用',
          dataIndex: 'is_active',
          key: 'is_active',
          width: 100,
          render: (v) => (Number(v) === 1 ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
        },
        {
          title: '备注',
          dataIndex: 'remark',
          key: 'remark',
          width: 240,
        },
        {
          title: '操作',
          key: 'actions',
          width: 320,
          fixed: 'right',
          render: (_v, r) => (
            <Space>
              <Button
                size="small"
                onClick={() => {
                  setCashflowAccount(r)
                  setCashflowOpen(true)
                }}
              >
                明细
              </Button>
              <Button
                size="small"
                onClick={() => {
                  if (!canEdit) {
                    message.error('无权限')
                    return
                  }
                  setEditing(r)
                  setEditOpen(true)
                  editForm.setFieldsValue({
                    name: r.name,
                    type: r.type,
                    opening_balance_yuan: centsToYuan(r.opening_balance_cents),
                    is_active: Number(r.is_active) === 1,
                    remark: r.remark,
                  })
                }}
                disabled={isSuperAdmin && !effectiveCompanyId}
              >
                编辑
              </Button>
              <Button
                size="small"
                danger={Number(r.is_active) === 1}
                loading={toggleMutation.isPending}
                onClick={() => {
                  if (!canEdit) {
                    message.error('无权限')
                    return
                  }
                  const next = Number(r.is_active) === 1 ? 0 : 1
                  Modal.confirm({
                    title: next === 1 ? '确认启用？' : '确认停用？',
                    onOk: async () => toggleMutation.mutate({ id: r.id, isActive: next }),
                  })
                }}
                disabled={isSuperAdmin && !effectiveCompanyId}
              >
                {Number(r.is_active) === 1 ? '停用' : '启用'}
              </Button>
            </Space>
          ),
        },
      ]),
    [addResizableToColumns, canEdit, editForm, effectiveCompanyId, isSuperAdmin, message, toggleMutation],
  )

  const cashflowColumns: ColumnsType<FinAccountCashflowRecord> = useMemo(
    () => [
      {
        title: '单号',
        dataIndex: 'code',
        key: 'code',
        width: 140,
        render: (v, r) => v || `${r.direction === 'in' ? '收款' : '付款'}#${r.id}`,
      },
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
        width: 110,
      },
      {
        title: '方向',
        dataIndex: 'direction_text',
        key: 'direction_text',
        width: 90,
        render: (_v, r) => <Tag color={r.direction === 'in' ? 'success' : 'error'}>{r.direction_text}</Tag>,
      },
      {
        title: '金额(元)',
        dataIndex: 'amount_cents',
        key: 'amount_cents',
        width: 120,
        render: (v, r) => (
          <Text style={{ color: r.direction === 'in' ? '#1677ff' : '#cf1322', fontWeight: 600 }}>
            {r.direction === 'in' ? '+' : '-'}{centsToYuan(v)}
          </Text>
        ),
      },
      {
        title: '对方',
        key: 'counterparty_name',
        width: 180,
        render: (_v, r) => r.counterparty_name || '-',
      },
      {
        title: '业务',
        key: 'biz',
        width: 140,
        render: (_v, r) => (r.biz_type ? `${r.biz_type}${r.biz_id ? ` #${r.biz_id}` : ''}` : '-'),
      },
      {
        title: '逐笔余额(元)',
        dataIndex: 'running_balance_cents',
        key: 'running_balance_cents',
        width: 140,
        render: (v) => <Text strong>¥ {centsToYuan(v)}</Text>,
      },
      {
        title: '方式',
        dataIndex: 'method',
        key: 'method',
        width: 120,
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
      },
    ],
    [],
  )

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              财务账户
            </Title>
            {isSuperAdmin && !effectiveCompanyId ? <Text type="warning">请先在右上角选择公司</Text> : null}
          </div>
          <Space>
            <Button
              type="primary"
              onClick={() => {
                if (!canEdit) {
                  message.error('无权限')
                  return
                }
                setCreateOpen(true)
                createForm.setFieldsValue({ type: 'bank', is_active: true, opening_balance_yuan: '0.00' })
              }}
              disabled={isSuperAdmin && !effectiveCompanyId}
            >
              新增
            </Button>
            <Button
              onClick={() => {
                message.info('可配置：新增/编辑/启用停用')
              }}
            >
              说明
            </Button>
          </Space>
        </div>

        <Card>
          <Form
            layout="inline"
            initialValues={{ activeOnly: filters.activeOnly }}
            onFinish={(values) => {
              setFilters({ activeOnly: values.activeOnly !== false })
            }}
          >
            <Form.Item label="仅启用" name="activeOnly" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
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
            dataSource={listQuery.data?.records || []}
            loading={listQuery.isLoading}
            scroll={{ x: 920 }}
            pagination={false}
          />
        </Card>
      </Space>

      <Modal
        title="新增账户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => {
            createMutation.mutate({
              companyId: effectiveCompanyId,
              name: values.name,
              type: values.type,
              opening_balance_cents: yuanToCents(values.opening_balance_yuan),
              is_active: values.is_active ? 1 : 0,
              remark: values.remark,
            })
          }}
        >
          <Form.Item label="账户名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'bank', label: '银行' },
                { value: 'cash', label: '现金' },
                { value: 'alipay', label: '支付宝' },
                { value: 'wechat', label: '微信' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="期初余额(元)" name="opening_balance_yuan">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑账户"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editing) return
            updateMutation.mutate({
              id: editing.id,
              data: {
                companyId: effectiveCompanyId,
                name: values.name,
                type: values.type,
                opening_balance_cents: yuanToCents(values.opening_balance_yuan),
                is_active: values.is_active ? 1 : 0,
                remark: values.remark,
              },
            })
          }}
        >
          <Form.Item label="账户名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'bank', label: '银行' },
                { value: 'cash', label: '现金' },
                { value: 'alipay', label: '支付宝' },
                { value: 'wechat', label: '微信' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="期初余额(元)" name="opening_balance_yuan">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={cashflowAccount ? `${cashflowAccount.name} - 现金流明细` : '账户现金流明细'}
        open={cashflowOpen}
        onClose={() => {
          setCashflowOpen(false)
          setCashflowAccount(null)
        }}
        width={980}
      >
        {cashflowAccount ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="账户名称">{cashflowAccount.name}</Descriptions.Item>
              <Descriptions.Item label="账户类型">{cashflowAccount.type}</Descriptions.Item>
              <Descriptions.Item label="当前余额">¥ {centsToYuan(cashflowAccount.balance_cents)}</Descriptions.Item>
              <Descriptions.Item label="期初余额">¥ {centsToYuan(cashflowAccount.opening_balance_cents)}</Descriptions.Item>
              <Descriptions.Item label="净流转">
                ¥ {((Number(cashflowAccount.balance_cents || 0) - Number(cashflowAccount.opening_balance_cents || 0)) / 100).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="备注">{cashflowAccount.remark || '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small">
              <Space size="large" wrap>
                <Statistic title="期初余额" value={cashflowView.openingBalance / 100} precision={2} prefix="¥" />
                <Statistic title="收入合计" value={cashflowView.incomeTotal / 100} precision={2} prefix="¥" valueStyle={{ color: '#1677ff' }} />
                <Statistic title="支出合计" value={cashflowView.expenseTotal / 100} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
                <Statistic title="净流转" value={cashflowView.netFlow / 100} precision={2} prefix="¥" valueStyle={{ color: cashflowView.netFlow >= 0 ? '#3f8600' : '#cf1322' }} />
                <Statistic title="流水笔数" value={cashflowView.records.length} suffix="笔" />
              </Space>
            </Card>

            <Table
              rowKey={(record) => `${record.direction}-${record.id}`}
              columns={cashflowColumns}
              dataSource={cashflowView.records}
              loading={cashflowQuery.isLoading}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1080 }}
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  )
}

export default FinAccountsPage
