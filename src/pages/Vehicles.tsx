import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  message,
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
  CarOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  batchCreateVehicles,
  createVehicle,
  fetchPlateHistory,
  fetchVehicleDocuments,
  fetchVehicleDriver,
  fetchVehicles,
  fetchVehicleStatistics,
  type PlateBindHistory,
  type Vehicle,
} from '../api/services/vehicles'
import { fetchUsers } from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography

const getStatusColor = (status: string) => {
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: '正常', color: 'success' },
    warning: { label: '即将到期', color: 'warning' },
    expired: { label: '已过期', color: 'error' },
    inactive: { label: '未绑定', color: 'default' },
  }
  return statusMap[status] || { label: status, color: 'default' }
}

const VehiclesPage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [activeTab, setActiveTab] = useState('list')
  const [filters, setFilters] = useState<{
    plateNumber?: string
    status?: string
  }>({})
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null)
  const [historyUserId, setHistoryUserId] = useState<number | undefined>(undefined)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [batchCreateModalOpen, setBatchCreateModalOpen] = useState(false)
  const [batchVehiclesText, setBatchVehiclesText] = useState('')

  // 获取车辆列表
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'list', filters, effectiveCompanyId],
    queryFn: () =>
      fetchVehicles({
        plateNumber: filters.plateNumber,
        status: filters.status,
        companyId: effectiveCompanyId,
        page: 1,
        pageSize: 100,
      }),
  })

  // 获取车辆统计
  const statisticsQuery = useQuery({
    queryKey: ['vehicles', 'statistics'],
    queryFn: () => fetchVehicleStatistics(),
  })

  // 获取车辆证件
  const documentsQuery = useQuery({
    queryKey: ['vehicles', 'documents', selectedPlate],
    queryFn: () => fetchVehicleDocuments(selectedPlate!),
    enabled: !!selectedPlate && detailDrawerOpen,
  })

  // 获取车辆司机信息
  const driverQuery = useQuery({
    queryKey: ['vehicles', 'driver', selectedPlate],
    queryFn: () => fetchVehicleDriver(selectedPlate!),
    enabled: !!selectedPlate && detailDrawerOpen,
  })

  // 获取用户列表（用于绑定历史查询）
  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => fetchUsers({ size: 1000 }),
  })

  // 获取绑定历史
  const historyQuery = useQuery({
    queryKey: ['vehicles', 'plate_history', historyUserId, effectiveCompanyId],
    queryFn: () =>
      fetchPlateHistory({
        userId: historyUserId,
        companyId: effectiveCompanyId,
        page: 1,
        pageSize: 100,
      }),
    enabled: activeTab === 'history',
  })

  const vehicles = vehiclesQuery.data?.vehicles || []
  const statistics = statisticsQuery.data
  const documents = documentsQuery.data?.documents || []
  const driver = driverQuery.data?.driver
  const historyRecords = historyQuery.data?.records || []
  const users = usersQuery.data?.items || []

  const handleSearch = (values: { plateNumber?: string; status?: string }) => {
    setFilters({
      plateNumber: values.plateNumber,
      status: values.status,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = useCallback((vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setSelectedPlate(vehicle.plate_number)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedVehicle(null)
    setSelectedPlate(null)
  }

  const handleCreateVehicle = async (values: any) => {
    try {
      const payload = {
        plate_number: values.plate_number,
        tanker_vehicle_code: values.tanker_vehicle_code,
        doc_type: values.doc_type,
        doc_no: values.doc_no,
        expire_date: values.expire_date ? dayjs(values.expire_date).format('YYYY-MM-DD') : undefined,
        remark: values.remark,
      }
      
      await createVehicle(payload)
      message.success('车辆创建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    } catch (error) {
      message.error((error as Error).message || '创建车辆失败')
    }
  }

  const handleBatchCreate = async () => {
    if (!batchVehiclesText.trim()) {
      message.error('请输入车辆信息')
      return
    }

    try {
      const lines = batchVehiclesText.trim().split('\n').filter(line => line.trim())
      const vehicles = lines.map(line => {
        const parts = line.split(/[,，\t]/).map(p => p.trim())
        return {
          plate_number: parts[0] || '',
          tanker_vehicle_code: parts[1] || undefined,
          doc_type: parts[2] || undefined,
          doc_no: parts[3] || undefined,
          expire_date: parts[4] || undefined,
          remark: parts[5] || undefined,
        }
      }).filter(v => v.plate_number)

      if (vehicles.length === 0) {
        message.error('没有有效的车辆信息')
        return
      }

      if (vehicles.length > 100) {
        message.error('一次最多创建100辆车')
        return
      }

      const result = await batchCreateVehicles({ vehicles })
      
      if (result.failed_count > 0) {
        Modal.info({
          title: '批量创建完成',
          width: 600,
          content: (
            <div>
              <p>成功创建 {result.success_count} 辆车，失败 {result.failed_count} 辆</p>
              {result.failed_vehicles.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>失败列表：</Text>
                  <ul style={{ marginTop: 8 }}>
                    {result.failed_vehicles.map((v, i) => (
                      <li key={i}>
                        {v.plate_number}: {v.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        })
      } else {
        message.success(`成功创建 ${result.success_count} 辆车`)
      }
      
      setBatchCreateModalOpen(false)
      setBatchVehiclesText('')
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    } catch (error) {
      message.error((error as Error).message || '批量创建失败')
    }
  }

  // 车辆列表列定义
  const vehicleColumns: ColumnsType<Vehicle> = useMemo(
    () => [
      {
        title: '车牌号',
        dataIndex: 'plate_number',
        width: 150,
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: '自编车号',
        dataIndex: 'tanker_vehicle_code',
        width: 120,
        render: (value: string) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '司机',
        width: 150,
        render: (_, record) => {
          if (record.driver_name) {
            return (
              <Space>
                <UserOutlined />
                <span>{record.driver_name}</span>
                {record.driver_phone && <Text type="secondary">({record.driver_phone})</Text>}
              </Space>
            )
          }
          return <Text type="secondary">未绑定</Text>
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: string) => {
          const status = getStatusColor(value)
          return <Tag color={status.color}>{status.label}</Tag>
        },
      },
      {
        title: '证件数量',
        dataIndex: 'doc_count',
        width: 100,
        align: 'center',
      },
      {
        title: '到期提醒',
        width: 200,
        render: (_, record) => {
          if (record.expired_docs.length > 0) {
            return (
              <Space>
                <Tag color="error">已过期 {record.expired_docs.length} 项</Tag>
              </Space>
            )
          }
          if (record.expiring_docs.length > 0) {
            return (
              <Space>
                <Tag color="warning">即将到期 {record.expiring_docs.length} 项</Tag>
              </Space>
            )
          }
          return <Text type="secondary">-</Text>
        },
      },
      {
        title: '操作',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看详情
          </Button>
        ),
      },
    ],
    [openDetail],
  )

  // 绑定历史列定义
  const historyColumns: ColumnsType<PlateBindHistory> = useMemo(
    () => [
      {
        title: '用户ID',
        dataIndex: 'user_id',
        width: 80,
      },
      {
        title: '用户名称',
        dataIndex: 'user_name',
        width: 120,
        render: (value: string) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '原车牌',
        dataIndex: 'previous_plate',
        width: 120,
        render: (value: string) => value || <Text type="secondary">-</Text>,
      },
      {
        title: '新车牌',
        dataIndex: 'new_plate',
        width: 120,
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: '变更时间',
        dataIndex: 'changed_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            车辆资产管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理车牌、司机绑定、车辆状态、证件到期提醒等。
          </Paragraph>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新增车辆
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setBatchCreateModalOpen(true)}
          >
            批量新增
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['vehicles'] })}
          >
            刷新
          </Button>
        </Space>
      </Flex>

      {/* 统计卡片 */}
      {statistics && (
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="车辆总数"
                value={statistics.total_vehicles}
                prefix={<CarOutlined />}
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="运行车辆"
                value={statistics.active_vehicles}
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="车辆利用率"
                value={statistics.utilization_rate}
                precision={1}
                suffix="%"
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="证件到期提醒"
                value={statistics.expiring_docs_count + statistics.expired_docs_count}
                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 证件到期提醒 */}
      {statistics && (statistics.expired_docs_count > 0 || statistics.expiring_docs_count > 0) && (
        <Alert
          message={`有 ${statistics.expired_docs_count} 个证件已过期，${statistics.expiring_docs_count} 个证件即将到期`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
        />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: '车辆列表',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
                    <Form.Item name="plateNumber" label="车牌号">
                      <Input placeholder="请输入车牌号" allowClear style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                      <Select
                        placeholder="请选择状态"
                        allowClear
                        style={{ width: 150 }}
                        options={[
                          { value: 'active', label: '正常' },
                          { value: 'warning', label: '即将到期' },
                          { value: 'expired', label: '已过期' },
                          { value: 'inactive', label: '未绑定' },
                        ]}
                      />
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

                  {vehiclesQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      message={(vehiclesQuery.error as Error).message || '数据加载失败'}
                    />
                  )}

                  <Table
                    rowKey="plate_number"
                    columns={vehicleColumns}
                    dataSource={vehicles}
                    loading={vehiclesQuery.isLoading}
                    pagination={{
                      total: vehiclesQuery.data?.total || 0,
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 辆`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                </Space>
              ),
            },
            {
              key: 'history',
              label: '绑定历史',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Form layout="inline">
                    <Form.Item label="选择用户">
                      <Select
                        style={{ width: 200 }}
                        placeholder="选择用户"
                        value={historyUserId}
                        onChange={setHistoryUserId}
                        showSearch
                        allowClear
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={users.map((user) => ({
                          value: user.id,
                          label: `${user.name || user.nickname || '用户'} (${user.phone || user.id})`,
                        }))}
                        loading={usersQuery.isLoading}
                        notFoundContent={usersQuery.isLoading ? '加载中...' : '暂无用户'}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Text type="secondary">不选择用户则显示当前公司所有绑定历史</Text>
                    </Form.Item>
                  </Form>

                  {historyQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      message={(historyQuery.error as Error).message || '数据加载失败'}
                    />
                  )}

                  <Table
                    rowKey="id"
                    columns={historyColumns}
                    dataSource={historyRecords}
                    loading={historyQuery.isLoading}
                    pagination={{
                      total: historyQuery.data?.total || 0,
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    locale={{ emptyText: <Empty description="暂无绑定历史" /> }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 详情Drawer */}
      <Drawer
        title={`车辆详情 - ${selectedVehicle?.plate_number || ''}`}
        width={800}
        open={detailDrawerOpen}
        onClose={closeDetail}
      >
        {selectedVehicle && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基本信息 */}
            <Card title="基本信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="车牌号">{selectedVehicle.plate_number}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getStatusColor(selectedVehicle.status).color}>
                    {getStatusColor(selectedVehicle.status).label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="司机">
                  {selectedVehicle.driver_name || <Text type="secondary">未绑定</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="司机电话">
                  {selectedVehicle.driver_phone || <Text type="secondary">-</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="证件数量">{selectedVehicle.doc_count}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 司机信息 */}
            {driver && (
              <Card title="司机信息" size="small">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="姓名">{driver.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="电话">{driver.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="昵称">{driver.nickname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="职位">{driver.position_type || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* 证件列表 */}
            <Card title="证件列表" size="small" loading={documentsQuery.isLoading}>
              {documents.length > 0 ? (
                <Table
                  rowKey="id"
                  columns={[
                    {
                      title: '证件类型',
                      dataIndex: 'doc_type',
                      width: 150,
                    },
                    {
                      title: '证件号',
                      dataIndex: 'doc_no',
                      ellipsis: true,
                    },
                    {
                      title: '到期日期',
                      dataIndex: 'expire_date',
                      width: 150,
                      render: (value: string) => {
                        if (!value) return <Text type="secondary">-</Text>
                        const days = dayjs(value).diff(dayjs(), 'day')
                        if (days < 0) {
                          return (
                            <Tag color="error">
                              {dayjs(value).format('YYYY-MM-DD')} (已过期 {Math.abs(days)} 天)
                            </Tag>
                          )
                        }
                        if (days <= 30) {
                          return (
                            <Tag color="warning">
                              {dayjs(value).format('YYYY-MM-DD')} (还有 {days} 天)
                            </Tag>
                          )
                        }
                        return dayjs(value).format('YYYY-MM-DD')
                      },
                    },
                    {
                      title: '备注',
                      dataIndex: 'remark',
                      ellipsis: true,
                    },
                  ]}
                  dataSource={documents}
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无证件信息" />
              )}
            </Card>

            {/* 到期提醒 */}
            {(selectedVehicle.expired_docs.length > 0 || selectedVehicle.expiring_docs.length > 0) && (
              <Card title="到期提醒" size="small">
                {selectedVehicle.expired_docs.length > 0 && (
                  <Alert
                    message="已过期证件"
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {selectedVehicle.expired_docs.map((doc, index) => (
                          <div key={index}>
                            <Tag color="error">{doc.type}</Tag>
                            <Text>
                              {doc.expire_date ? dayjs(doc.expire_date).format('YYYY-MM-DD') : '-'} (已过期{' '}
                              {Math.abs(doc.days)} 天)
                            </Text>
                          </div>
                        ))}
                      </Space>
                    }
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                {selectedVehicle.expiring_docs.length > 0 && (
                  <Alert
                    message="即将到期证件"
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {selectedVehicle.expiring_docs.map((doc, index) => (
                          <div key={index}>
                            <Tag color="warning">{doc.type}</Tag>
                            <Text>
                              {doc.expire_date ? dayjs(doc.expire_date).format('YYYY-MM-DD') : '-'} (还有{' '}
                              {doc.days} 天)
                            </Text>
                          </div>
                        ))}
                      </Space>
                    }
                    type="warning"
                    showIcon
                  />
                )}
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      {/* 新增车辆Modal */}
      <Modal
        title="新增车辆"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        onOk={() => createForm.submit()}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateVehicle}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="车牌号"
            name="plate_number"
            rules={[
              { required: true, message: '请输入车牌号' },
              { min: 5, max: 20, message: '车牌号长度应在5-20个字符之间' },
            ]}
          >
            <Input placeholder="请输入车牌号，如：京A12345" />
          </Form.Item>

          <Form.Item
            label="自编车号"
            name="tanker_vehicle_code"
            tooltip="罐车业务专用，可选填"
          >
            <Input placeholder="请输入自编车号" maxLength={50} />
          </Form.Item>

          <Form.Item
            label="初始证件类型"
            name="doc_type"
            tooltip="创建车辆时可以同时添加一个初始证件"
          >
            <Input placeholder="如：行驶证、保险单等" maxLength={100} />
          </Form.Item>

          <Form.Item
            label="证件号"
            name="doc_no"
          >
            <Input placeholder="请输入证件号" maxLength={200} />
          </Form.Item>

          <Form.Item
            label="证件到期日期"
            name="expire_date"
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择到期日期" />
          </Form.Item>

          <Form.Item
            label="备注"
            name="remark"
          >
            <Input.TextArea rows={3} placeholder="请输入备注信息" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量新增车辆Modal */}
      <Modal
        title="批量新增车辆"
        open={batchCreateModalOpen}
        onCancel={() => {
          setBatchCreateModalOpen(false)
          setBatchVehiclesText('')
        }}
        onOk={handleBatchCreate}
        width={800}
        okText="批量创建"
        cancelText="取消"
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="批量导入说明"
            description={
              <div>
                <p>每行一辆车，字段用逗号或制表符分隔，格式如下：</p>
                <p style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  车牌号,自编车号,证件类型,证件号,到期日期(YYYY-MM-DD),备注
                </p>
                <p style={{ marginTop: 8 }}>示例：</p>
                <p style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  京A12345,001,行驶证,123456,2025-12-31,备注信息<br />
                  京B67890,002,保险单,789012,2026-06-30<br />
                  京C11111
                </p>
                <p style={{ marginTop: 8, color: '#666' }}>
                  注意：车牌号为必填项，其他字段可选。一次最多导入100辆车。
                </p>
              </div>
            }
            type="info"
            showIcon
          />
          
          <Input.TextArea
            value={batchVehiclesText}
            onChange={(e) => setBatchVehiclesText(e.target.value)}
            placeholder="请输入车辆信息，每行一辆车&#10;例如：京A12345,001,行驶证,123456,2025-12-31,备注"
            rows={15}
            style={{ fontFamily: 'monospace' }}
          />
          
          <Text type="secondary">
            当前输入 {batchVehiclesText.trim().split('\n').filter(line => line.trim()).length} 行
          </Text>
        </Space>
      </Modal>
    </Space>
  )
}

export default VehiclesPage
