import { useMemo, useState, type Key } from 'react'
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DistanceRecord, NavigationAddress } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import {
  createDistanceRecord,
  deleteDistanceRecord,
  fetchDistanceRecords,
  updateDistanceRecord,
} from '../api/services/distance'
import { fetchNavigationAddresses } from '../api/services/navigation'

const { Title } = Typography

const DistanceTableManagementPage = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()

  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<DistanceRecord | null>(null)
  const [form] = Form.useForm()

  const [batchCreateOpen, setBatchCreateOpen] = useState(false)
  const [batchCreateText, setBatchCreateText] = useState('')

  const [batchEditOpen, setBatchEditOpen] = useState(false)
  const [batchEditForm] = Form.useForm()

  const listQuery = useQuery({
    queryKey: ['distance', 'list', { keyword, page, pageSize, effectiveCompanyId }],
    queryFn: () => fetchDistanceRecords({ keyword, page, page_size: pageSize, companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const loadingAddressesQuery = useQuery({
    queryKey: ['navigation', 'addresses', 'loading', effectiveCompanyId],
    queryFn: () => fetchNavigationAddresses({ type: 'loading', companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const unloadingAddressesQuery = useQuery({
    queryKey: ['navigation', 'addresses', 'unloading', effectiveCompanyId],
    queryFn: () => fetchNavigationAddresses({ type: 'unloading', companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const list = listQuery.data?.list || []
  const total = listQuery.data?.total || 0

  const loadingOptions = (loadingAddressesQuery.data?.addresses || []).map((a: NavigationAddress) => ({
    label: a.name,
    value: a.name,
  }))
  const unloadingOptions = (unloadingAddressesQuery.data?.addresses || []).map((a: NavigationAddress) => ({
    label: a.name,
    value: a.name,
  }))

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createDistanceRecord>[0]) => createDistanceRecord(data, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('新增成功')
      setEditModalOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
    },
    onError: (error) => message.error((error as Error).message || '新增失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: Parameters<typeof updateDistanceRecord>[1] }) =>
      updateDistanceRecord(payload.id, payload.data, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('更新成功')
      setEditModalOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDistanceRecord(id, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const columns: ColumnsType<DistanceRecord> = useMemo(
    () => [
      { title: '装料地点', dataIndex: 'loading_company', width: 220 },
      { title: '卸货地点', dataIndex: 'unloading_company', width: 220 },
      {
        title: '距离(km)',
        dataIndex: 'distance',
        width: 120,
        render: (v) => (typeof v === 'number' ? v.toFixed(2) : v),
      },
      { title: '更新时间', dataIndex: 'updated_at', width: 160, render: (v) => v || '-' },
      {
        title: '操作',
        width: 160,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue({
                  loading_company: record.loading_company,
                  unloading_company: record.unloading_company,
                  distance: record.distance,
                })
                setEditModalOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                modal.confirm({
                  title: '确认删除',
                  content: `确定删除「${record.loading_company} -> ${record.unloading_company}」吗？`,
                  onOk: () => deleteMutation.mutate(record.id),
                })
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [deleteMutation, form, modal],
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setEditModalOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    const payload = {
      loading_company: values.loading_company,
      unloading_company: values.unloading_company,
      distance: Number(values.distance),
    }

    if (!Number.isFinite(payload.distance)) {
      message.error('距离格式错误')
      return
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
      return
    }

    createMutation.mutate(payload)
  }

  const doBatchDelete = () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的记录')
      return
    }

    modal.confirm({
      title: '批量删除',
      content: `确定删除选中的 ${selectedRowKeys.length} 条记录吗？`,
      onOk: async () => {
        const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n))
        await Promise.all(ids.map((id) => deleteDistanceRecord(id, { companyId: effectiveCompanyId })))
        setSelectedRowKeys([])
        message.success('批量删除成功')
        queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
      },
    })
  }

  const doBatchEdit = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要编辑的记录')
      return
    }

    const values = await batchEditForm.validateFields()
    const distance = Number(values.distance)
    if (!Number.isFinite(distance)) {
      message.error('距离格式错误')
      return
    }

    const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n))
    await Promise.all(ids.map((id) => updateDistanceRecord(id, { distance }, { companyId: effectiveCompanyId })))
    setBatchEditOpen(false)
    batchEditForm.resetFields()
    setSelectedRowKeys([])
    message.success('批量更新成功')
    queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
  }

  const doBatchCreate = async () => {
    const text = batchCreateText.trim()
    if (!text) {
      message.warning('请输入要导入的数据')
      return
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) {
      message.warning('未解析到有效数据')
      return
    }

    const tasks: Array<Parameters<typeof createDistanceRecord>[0]> = []
    const errors: string[] = []

    lines.forEach((line, idx) => {
      const parts = line.split(/[\t,，]+/).map((p) => p.trim()).filter(Boolean)
      const loading = parts[0]
      const unloading = parts[1]
      const distStr = parts[2]

      const dist = Number(distStr)
      if (!loading || !unloading || !Number.isFinite(dist)) {
        errors.push(`第${idx + 1}行：格式错误（装料地点, 卸货地点, 距离）`)
        return
      }

      tasks.push({ loading_company: loading, unloading_company: unloading, distance: dist })
    })

    if (!tasks.length) {
      modal.warning({ title: '导入失败', content: errors.join('\n') || '无有效数据' })
      return
    }

    await Promise.all(tasks.map((t) => createDistanceRecord(t, { companyId: effectiveCompanyId })))

    if (errors.length) {
      modal.warning({
        title: '部分导入失败',
        content: `成功导入 ${tasks.length} 条，失败 ${errors.length} 条：\n${errors.join('\n')}`,
      })
    } else {
      message.success(`批量导入成功：${tasks.length} 条`)
    }

    setBatchCreateOpen(false)
    setBatchCreateText('')
    queryClient.invalidateQueries({ queryKey: ['distance', 'list'] })
  }

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {showCompanyWarning ? <Alert type="warning" showIcon message="请先在顶部选择公司后再查看/编辑数据" /> : null}
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              运距表管理
            </Title>
            <Space>
              <Input
                allowClear
                placeholder="搜索装/卸货地点"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                style={{ width: 260 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()} loading={listQuery.isFetching}>
                刷新
              </Button>
              <Button icon={<PlusOutlined />} type="primary" onClick={openCreate} disabled={showCompanyWarning}>
                新增
              </Button>
            </Space>
          </Space>

          <Space>
            <Button onClick={() => setBatchCreateOpen(true)} disabled={showCompanyWarning}>
              批量新增
            </Button>
            <Button onClick={() => setBatchEditOpen(true)} disabled={showCompanyWarning || !selectedRowKeys.length}>
              批量编辑
            </Button>
            <Button danger onClick={doBatchDelete} disabled={showCompanyWarning || !selectedRowKeys.length}>
              批量删除
            </Button>
          </Space>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={list}
            loading={listQuery.isFetching}
            scroll={{ x: 900 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p)
                setPageSize(ps)
              },
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          />
        </Space>
      </Card>

      <Modal
        title={editing ? '编辑运距' : '新增运距'}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={save}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="装料地点" name="loading_company" rules={[{ required: true }]}>
            <Select
              showSearch
              allowClear
              placeholder="选择装料地点"
              options={loadingOptions}
              loading={loadingAddressesQuery.isFetching}
              filterOption={(input, option) =>
                String(option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item label="卸货地点" name="unloading_company" rules={[{ required: true }]}>
            <Select
              showSearch
              allowClear
              placeholder="选择卸货地点"
              options={unloadingOptions}
              loading={unloadingAddressesQuery.isFetching}
              filterOption={(input, option) =>
                String(option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item label="距离(km)" name="distance" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量新增"
        open={batchCreateOpen}
        onCancel={() => {
          setBatchCreateOpen(false)
          setBatchCreateText('')
        }}
        onOk={doBatchCreate}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontSize: 12, color: '#666' }}>每行一条：装料地点, 卸货地点, 距离(km)</div>
          <Input.TextArea rows={10} value={batchCreateText} onChange={(e) => setBatchCreateText(e.target.value)} />
        </Space>
      </Modal>

      <Modal
        title="批量编辑"
        open={batchEditOpen}
        onCancel={() => {
          setBatchEditOpen(false)
          batchEditForm.resetFields()
        }}
        onOk={doBatchEdit}
      >
        <Form form={batchEditForm} layout="vertical">
          <Form.Item label="距离(km)" name="distance" rules={[{ required: true, message: '请输入距离' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DistanceTableManagementPage
