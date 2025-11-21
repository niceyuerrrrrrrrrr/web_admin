import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  HomeOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Line } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  createInventoryItem,
  createStockOperation,
  createWarehouse,
  fetchInventoryItems,
  fetchInventoryStatistics,
  fetchStockOperations,
  fetchWarehouses,
  updateInventoryItem,
  updateWarehouse,
} from '../api/services/inventory'
import type {
  InventoryItem,
  InventoryStats,
  StockOperationRecord,
  Warehouse,
} from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

const InventoryPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [statsFilters, setStatsFilters] = useState<{ warehouseId?: number; dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })
  const [inventoryFilters, setInventoryFilters] = useState<{ warehouseId?: number; keyword?: string }>({})
  const [operationFilters, setOperationFilters] = useState<{ warehouseId?: number; operationType?: string; dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }>({
    dateRange: [dayjs().subtract(6, 'day'), dayjs()],
  })
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [warehouseDrawerOpen, setWarehouseDrawerOpen] = useState(false)
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false)
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [operationModalOpen, setOperationModalOpen] = useState(false)

  const [warehouseForm] = Form.useForm()
  const [inventoryForm] = Form.useForm()
  const [operationForm] = Form.useForm()

  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouses', effectiveCompanyId],
    queryFn: () => fetchWarehouses({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const statsQuery = useQuery({
    queryKey: ['inventory', 'stats', statsFilters, effectiveCompanyId],
    queryFn: () =>
      fetchInventoryStatistics({
        warehouseId: statsFilters.warehouseId,
        beginDate: statsFilters.dateRange ? statsFilters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: statsFilters.dateRange ? statsFilters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'items', inventoryFilters, effectiveCompanyId],
    queryFn: () =>
      fetchInventoryItems({
        warehouseId: inventoryFilters.warehouseId,
        keyword: inventoryFilters.keyword,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const operationsQuery = useQuery({
    queryKey: ['inventory', 'operations', operationFilters, effectiveCompanyId],
    queryFn: () =>
      fetchStockOperations({
        warehouseId: operationFilters.warehouseId,
        operationType: operationFilters.operationType,
        beginDate: operationFilters.dateRange ? operationFilters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: operationFilters.dateRange ? operationFilters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        pageSize: 50,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const createWarehouseMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      message.success('仓库创建成功')
      warehouseForm.resetFields()
      setWarehouseModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateWarehouseMutation = useMutation({
    mutationFn: (params: { id: number; data: Partial<Warehouse> }) => updateWarehouse(params.id, params.data),
    onSuccess: () => {
      message.success('仓库更新成功')
      setWarehouseDrawerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const createInventoryMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      message.success('库存项创建成功')
      inventoryForm.resetFields()
      setInventoryModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateInventoryMutation = useMutation({
    mutationFn: (params: { id: number; data: Partial<InventoryItem> }) => updateInventoryItem(params.id, params.data),
    onSuccess: () => {
      message.success('库存项更新成功')
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const operationMutation = useMutation({
    mutationFn: createStockOperation,
    onSuccess: () => {
      message.success('出入库记录创建成功')
      operationForm.resetFields()
      setOperationModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'operations'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const stats = (statsQuery.data as InventoryStats | undefined) || ({} as InventoryStats)

  const summaryCards = [
    {
      title: '总入库次数',
      value: stats.stats?.totalInbound || 0,
      icon: <UploadOutlined />,
    },
    {
      title: '总出库次数',
      value: stats.stats?.totalOutbound || 0,
      icon: <DownloadOutlined />,
    },
    {
      title: '物品种类',
      value: stats.stats?.totalItems || 0,
      icon: <DatabaseOutlined />,
    },
    {
      title: '低库存预警',
      value: stats.stats?.lowStockItems || 0,
      icon: <CheckCircleOutlined />,
    },
  ]

  const trendData = useMemo(() => {
    if (!stats.trend) return []
    return stats.trend.dates.map((date, idx) => ({
      date,
      inbound: stats.trend?.inbound[idx] || 0,
      outbound: stats.trend?.outbound[idx] || 0,
    }))
  }, [stats.trend])

  const handleWarehouseSave = () => {
    warehouseForm.validateFields().then((values) => {
      if (selectedWarehouse) {
        updateWarehouseMutation.mutate({ id: selectedWarehouse.id, data: values })
      } else {
        createWarehouseMutation.mutate(values)
      }
    })
  }

  const handleInventorySave = () => {
    inventoryForm.validateFields().then((values) => {
      if (editingItemId) {
        updateInventoryMutation.mutate({
          id: editingItemId,
          data: {
            material_name: values.material_name,
            material_code: values.material_code,
            min_stock: values.min_stock,
            max_stock: values.max_stock,
            location: values.location,
            notes: values.notes,
          },
        })
      } else {
        createInventoryMutation.mutate({
          warehouse_id: values.warehouse_id,
          material_name: values.material_name,
          material_code: values.material_code,
          quantity: values.quantity || 0,
          unit: values.unit || '个',
          min_stock: values.min_stock,
          max_stock: values.max_stock,
          location: values.location,
          notes: values.notes,
        })
      }
    })
  }

  const handleOperationSave = () => {
    operationForm.validateFields().then((values) => {
      operationMutation.mutate({
        warehouse_id: values.warehouse_id,
        inventory_id: values.inventory_id,
        operation_type: values.operation_type,
        quantity: values.quantity,
        unit: values.unit,
        operation_date: values.operation_date.format('YYYY-MM-DD'),
        reason: values.reason,
      })
    })
  }

  const inventoryColumns: ColumnsType<InventoryItem> = [
    { title: '物品名称', dataIndex: 'material_name', width: 160 },
    { title: '物品编码', dataIndex: 'material_code', width: 140, render: (v) => v || '-' },
    {
      title: '所属仓库',
      dataIndex: 'warehouse_id',
      width: 160,
      render: (value) => warehousesQuery.data?.records?.find((w) => w.id === value)?.name || '-',
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 140,
      render: (_, record) => (
        <span>
          {record.quantity} {record.unit}
          {record.min_stock !== undefined && record.quantity < (record.min_stock || 0) && <Tag color="error">低库存</Tag>}
        </span>
      ),
    },
    {
      title: '安全库存',
      width: 140,
      render: (_, record) =>
        record.min_stock !== undefined ? (
          <>
            {record.min_stock} - {record.max_stock ?? '∞'} {record.unit}
          </>
        ) : (
          '-'
        ),
    },
    { title: '存放位置', dataIndex: 'location', width: 140, render: (v) => v || '-' },
    { title: '备注', dataIndex: 'notes', ellipsis: true, render: (v) => v || '-' },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setEditingItemId(record.id)
              inventoryForm.setFieldsValue({
                warehouse_id: record.warehouse_id,
                material_name: record.material_name,
                material_code: record.material_code,
                min_stock: record.min_stock,
                max_stock: record.max_stock,
                location: record.location,
                notes: record.notes,
              })
              setInventoryModalOpen(true)
            }}
          >
            调整
          </Button>
          <Button
            type="link"
            onClick={() =>
              operationForm.setFieldsValue({
                warehouse_id: record.warehouse_id,
                inventory_id: record.id,
                unit: record.unit,
                operation_date: dayjs(),
              })
            }
          >
            出入库
          </Button>
        </Space>
      ),
    },
  ]

  const warehouseColumns: ColumnsType<Warehouse> = [
    { title: '仓库名称', dataIndex: 'name', width: 180 },
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '地址', dataIndex: 'address', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <Tag color={value === 'active' ? 'success' : 'default'}>{value === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedWarehouse(record)
            warehouseForm.setFieldsValue(record)
            setWarehouseDrawerOpen(true)
          }}
        >
          编辑
        </Button>
      ),
    },
  ]

  const operationColumns: ColumnsType<StockOperationRecord> = [
    { title: '编号', dataIndex: 'id', width: 80 },
    { title: '仓库', dataIndex: 'warehouse_name', width: 160 },
    { title: '物品', dataIndex: 'material_name', width: 160 },
    {
      title: '类型',
      dataIndex: 'operation_type',
      width: 120,
      render: (value) => <Tag color={value === 'inbound' ? 'blue' : 'orange'}>{value === 'inbound' ? '入库' : '出库'}</Tag>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 120,
      render: (_, record) => (
        <>
          {record.quantity} {record.unit}
        </>
      ),
    },
    { title: '操作时间', dataIndex: 'operation_date', width: 140 },
    { title: '备注', dataIndex: 'reason', ellipsis: true, render: (v) => v || '-' },
  ]

  useEffect(() => {
    if (!inventoryModalOpen) {
      inventoryForm.resetFields()
      setEditingItemId(null)
    }
  }, [inventoryModalOpen, inventoryForm])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            库存与仓库管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            查看库存、管理仓库、记录出入库，并支持与物品领用联动。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })}>
            刷新
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingItemId(null)
              inventoryForm.resetFields()
              setInventoryModalOpen(true)
            }}
          >
            新增物品
          </Button>
          <Button icon={<HomeOutlined />} onClick={() => setWarehouseModalOpen(true)}>
            新建仓库
          </Button>
          <Button icon={<InboxOutlined />} onClick={() => setOperationModalOpen(true)}>
            新增出入库
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看库存数据" showIcon />
      )}

      <Tabs
        items={[
          {
            key: 'overview',
            label: '库存总览',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <Form
                    layout="inline"
                    initialValues={{
                      warehouseId: statsFilters.warehouseId,
                      dateRange: statsFilters.dateRange,
                    }}
                    onFinish={(values) =>
                      setStatsFilters({
                        warehouseId: values.warehouseId,
                        dateRange: values.dateRange,
                      })
                    }
                  >
                    <Form.Item name="warehouseId" label="仓库">
                      <Select
                        allowClear
                        placeholder="选择仓库"
                        options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Form.Item name="dateRange" label="日期范围">
                      <RangePicker allowClear style={{ width: 260 }} />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        查询
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>

                <Row gutter={16}>
                  {summaryCards.map((card) => (
                    <Col xs={24} sm={12} md={6} key={card.title}>
                      <Card>
                        <Statistic title={card.title} value={card.value} prefix={card.icon} />
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Row gutter={16}>
                  <Col span={14}>
                    <Card title="出入库趋势">
                      {trendData.length ? (
                        <Line
                          data={[
                            ...trendData.map((item) => ({ date: item.date, type: '入库', value: item.inbound })),
                            ...trendData.map((item) => ({ date: item.date, type: '出库', value: item.outbound })),
                          ]}
                          xField="date"
                          yField="value"
                          seriesField="type"
                          smooth
                          height={300}
                        />
                      ) : (
                        <Alert type="info" message="暂无趋势数据" showIcon />
                      )}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title="热门物品">
                      {stats.top_items?.length ? (
                        <Table
                          size="small"
                          rowKey="id"
                          columns={[
                            { title: '物品', dataIndex: 'material_name' },
                            { title: '操作次数', dataIndex: 'operation_count', width: 100 },
                            {
                              title: '库存',
                              dataIndex: 'quantity',
                              width: 120,
                              render: (_, record) => (
                                <>
                                  {record.quantity} {record.unit} {record.isLowStock && <Tag color="error">低库存</Tag>}
                                </>
                              ),
                            },
                          ]}
                          dataSource={stats.top_items}
                          pagination={false}
                        />
                      ) : (
                        <Alert type="info" message="暂无数据" showIcon />
                      )}
                    </Card>
                  </Col>
                </Row>
              </Space>
            ),
          },
          {
            key: 'inventory',
            label: '库存列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <Form
                    layout="inline"
                    initialValues={inventoryFilters}
                    onFinish={(values) =>
                      setInventoryFilters({
                        warehouseId: values.warehouseId,
                        keyword: values.keyword,
                      })
                    }
                    onReset={() => setInventoryFilters({})}
                  >
                    <Form.Item name="warehouseId" label="仓库">
                      <Select
                        allowClear
                        placeholder="选择仓库"
                        options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Form.Item name="keyword" label="关键词">
                      <Input placeholder="物品名称/编码" allowClear style={{ width: 200 }} />
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
                </Card>
                <Card>
                  <Table
                    rowKey="id"
                    columns={inventoryColumns}
                    dataSource={inventoryQuery.data?.records || []}
                    loading={inventoryQuery.isLoading}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1200 }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'warehouses',
            label: '仓库管理',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  columns={warehouseColumns}
                  dataSource={warehousesQuery.data?.records || []}
                  loading={warehousesQuery.isLoading}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'operations',
            label: '出入库记录',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <Form
                    layout="inline"
                    initialValues={{
                      warehouseId: operationFilters.warehouseId,
                      operationType: operationFilters.operationType,
                      dateRange: operationFilters.dateRange,
                    }}
                    onFinish={(values) =>
                      setOperationFilters({
                        warehouseId: values.warehouseId,
                        operationType: values.operationType,
                        dateRange: values.dateRange,
                      })
                    }
                  >
                    <Form.Item name="warehouseId" label="仓库">
                      <Select
                        allowClear
                        placeholder="选择仓库"
                        options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Form.Item name="operationType" label="类型">
                      <Select
                        allowClear
                        placeholder="出库/入库"
                        options={[
                          { value: 'inbound', label: '入库' },
                          { value: 'outbound', label: '出库' },
                        ]}
                        style={{ width: 150 }}
                      />
                    </Form.Item>
                    <Form.Item name="dateRange" label="日期">
                      <RangePicker allowClear style={{ width: 260 }} />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        查询
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
                <Card>
                  <Table
                    rowKey="id"
                    columns={operationColumns}
                    dataSource={operationsQuery.data?.records || []}
                    loading={operationsQuery.isLoading}
                    pagination={false}
                    scroll={{ x: 1000 }}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={`仓库详情 - ${selectedWarehouse?.name || ''}`}
        width={480}
        open={warehouseDrawerOpen}
        onClose={() => {
          setWarehouseDrawerOpen(false)
          setSelectedWarehouse(null)
        }}
        extra={
          <Button type="primary" onClick={handleWarehouseSave} loading={updateWarehouseMutation.isPending}>
            保存
          </Button>
        }
      >
        <Form layout="vertical" form={warehouseForm}>
          <Form.Item label="仓库名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="仓库编码" name="code">
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="负责人ID" name="manager_id">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={selectedWarehouse ? '编辑仓库' : '新建仓库'}
        open={warehouseModalOpen}
        onCancel={() => {
          warehouseForm.resetFields()
          setWarehouseModalOpen(false)
        }}
        onOk={handleWarehouseSave}
        confirmLoading={createWarehouseMutation.isPending}
      >
        <Form layout="vertical" form={warehouseForm}>
          <Form.Item label="仓库名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="仓库编码" name="code">
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="负责人ID" name="manager_id">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingItemId ? '调整库存信息' : '新增库存'}
        open={inventoryModalOpen}
        onCancel={() => setInventoryModalOpen(false)}
        onOk={handleInventorySave}
        confirmLoading={editingItemId ? updateInventoryMutation.isPending : createInventoryMutation.isPending}
      >
        <Form layout="vertical" form={inventoryForm}>
          <Form.Item label="仓库" name="warehouse_id" rules={[{ required: true }]}>
            <Select
              options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))}
              disabled={!!editingItemId}
            />
          </Form.Item>
          <Form.Item label="物品名称" name="material_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="物品编码" name="material_code">
            <Input />
          </Form.Item>
          {!editingItemId && (
            <>
              <Form.Item label="初始数量" name="quantity">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="单位" name="unit" initialValue="个">
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item label="最低库存" name="min_stock">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="最高库存" name="max_stock">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="存放位置" name="location">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增出入库记录"
        open={operationModalOpen}
        onCancel={() => setOperationModalOpen(false)}
        onOk={handleOperationSave}
        confirmLoading={operationMutation.isPending}
      >
        <Form layout="vertical" form={operationForm} initialValues={{ operation_type: 'inbound', operation_date: dayjs(), unit: '个' }}>
          <Form.Item label="仓库" name="warehouse_id" rules={[{ required: true }]}>
            <Select
              options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))}
              onChange={() => operationForm.setFieldsValue({ inventory_id: undefined })}
            />
          </Form.Item>
          <Form.Item label="物品" name="inventory_id" rules={[{ required: true }]}>
            <Select
              placeholder="选择库存物品"
              options={(inventoryQuery.data?.records || [])
                .filter((item) => !operationForm.getFieldValue('warehouse_id') || item.warehouse_id === operationForm.getFieldValue('warehouse_id'))
                .map((item) => ({
                  value: item.id,
                  label: `${item.material_name} (${item.material_code || '无编码'})`,
                }))}
              showSearch
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item label="类型" name="operation_type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'inbound', label: '入库' },
                { value: 'outbound', label: '出库' },
              ]}
            />
          </Form.Item>
          <Form.Item label="数量" name="quantity" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input />
          </Form.Item>
          <Form.Item label="操作日期" name="operation_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="原因备注" name="reason">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

    </Space>
  )
}

export default InventoryPage

