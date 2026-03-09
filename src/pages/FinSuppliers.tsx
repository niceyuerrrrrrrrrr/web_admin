import { useCallback, useMemo, useState } from 'react'
import { App as AntdApp, Button, Card, Form, Input, Modal, Space, Switch, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import type { FinSupplierRecord } from '../api/types'
import { createFinSupplier, fetchFinSuppliers, toggleFinSupplierActive, updateFinSupplier } from '../api/services/finBase'

const { Title, Text } = Typography

const FinSuppliersPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const userPosition = (user as any)?.positionType || (user as any)?.position_type
  const canEdit = isSuperAdmin || ['财务', '总经理'].includes(userPosition)

  const [filters, setFilters] = useState<{ keyword?: string; activeOnly: boolean }>({ activeOnly: true })

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<FinSupplierRecord | null>(null)
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
    queryKey: ['fin', 'suppliers', filters, effectiveCompanyId],
    queryFn: () =>
      fetchFinSuppliers({
        companyId: effectiveCompanyId,
        keyword: filters.keyword,
        activeOnly: filters.activeOnly,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const createMutation = useMutation({
    mutationFn: createFinSupplier,
    onSuccess: () => {
      message.success('已创建')
      setCreateOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['fin', 'suppliers'] })
    },
    onError: (e) => message.error((e as Error).message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: any }) => updateFinSupplier(payload.id, payload.data),
    onSuccess: () => {
      message.success('已更新')
      setEditOpen(false)
      editForm.resetFields()
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['fin', 'suppliers'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; isActive: number }) =>
      toggleFinSupplierActive(payload.id, { is_active: payload.isActive, companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['fin', 'suppliers'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const columns: ColumnsType<FinSupplierRecord> = useMemo(
    () =>
      addResizableToColumns<FinSupplierRecord>([
        {
          title: 'ID',
          dataIndex: 'id',
          key: 'id',
          width: 90,
        },
        {
          title: '供应商名称',
          dataIndex: 'name',
          key: 'name',
          width: 240,
        },
        {
          title: '联系人',
          dataIndex: 'contact_name',
          key: 'contact_name',
          width: 140,
        },
        {
          title: '联系电话',
          dataIndex: 'contact_phone',
          key: 'contact_phone',
          width: 160,
        },
        {
          title: '账期/结算',
          dataIndex: 'settlement_terms',
          key: 'settlement_terms',
          width: 160,
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
          width: 260,
          fixed: 'right',
          render: (_v, r) => (
            <Space>
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
                    contact_name: r.contact_name,
                    contact_phone: r.contact_phone,
                    settlement_terms: r.settlement_terms,
                    bank_info: r.bank_info,
                    remark: r.remark,
                    is_active: Number(r.is_active) === 1,
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

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              供应商
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
                createForm.setFieldsValue({ is_active: true })
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
            initialValues={{ keyword: filters.keyword, activeOnly: filters.activeOnly }}
            onFinish={(values) => {
              setFilters({ keyword: values.keyword, activeOnly: values.activeOnly !== false })
            }}
          >
            <Form.Item label="关键字" name="keyword">
              <Input placeholder="供应商名称" style={{ width: 200 }} allowClear />
            </Form.Item>
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
            scroll={{ x: 1150 }}
            pagination={false}
          />
        </Card>
      </Space>

      <Modal
        title="新增供应商"
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
              contact_name: values.contact_name,
              contact_phone: values.contact_phone,
              settlement_terms: values.settlement_terms,
              bank_info: values.bank_info,
              remark: values.remark,
              is_active: values.is_active ? 1 : 0,
            })
          }}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="联系人" name="contact_name">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="contact_phone">
            <Input />
          </Form.Item>
          <Form.Item label="账期/结算" name="settlement_terms">
            <Input />
          </Form.Item>
          <Form.Item label="银行信息" name="bank_info">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑供应商"
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
                contact_name: values.contact_name,
                contact_phone: values.contact_phone,
                settlement_terms: values.settlement_terms,
                bank_info: values.bank_info,
                remark: values.remark,
                is_active: values.is_active ? 1 : 0,
              },
            })
          }}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="联系人" name="contact_name">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="contact_phone">
            <Input />
          </Form.Item>
          <Form.Item label="账期/结算" name="settlement_terms">
            <Input />
          </Form.Item>
          <Form.Item label="银行信息" name="bank_info">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FinSuppliersPage
