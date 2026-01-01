import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  DeleteOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RECEIPT_TYPES } from '../api/services/receipts'
import type { Receipt, ReceiptType } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import client from '../api/client'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

// 获取已删除的票据
const fetchDeletedReceipts = async (params: {
  receiptType?: ReceiptType
  startDate?: string
  endDate?: string
  companyId?: number
  departmentId?: number
  userId?: number
}) => {
  const response = await client.get('/receipts/deleted', {
    params: {
      receipt_type: params.receiptType,
      start_date: params.startDate,
      end_date: params.endDate,
      company_id: params.companyId,
      department_id: params.departmentId,
      user_id: params.userId,
    },
  })
  if (!response.data.success) {
    throw new Error(response.data.message || '获取失败')
  }
  return response.data.data as Receipt[]
}

// 恢复票据
const restoreReceipt = async (type: ReceiptType, id: number) => {
  const typeMap: Record<ReceiptType, string> = {
    loading: 'loading',
    unloading: 'unloading',
    charging: 'charging',
    water: 'water_tickets',
    departure: 'departure',
  }
  const endpoint = typeMap[type]
  const response = await client.post(`/receipts/${endpoint}/${id}/restore`)
  if (!response.data.success) {
    throw new Error(response.data.message || '恢复失败')
  }
  return response.data
}

// 永久删除票据
const permanentlyDeleteReceipt = async (type: ReceiptType, id: number) => {
  const typeMap: Record<ReceiptType, string> = {
    loading: 'loading',
    unloading: 'unloading',
    charging: 'charging',
    water: 'water_tickets',
    departure: 'departure',
  }
  const endpoint = typeMap[type]
  const response = await client.delete(`/receipts/${endpoint}/${id}/permanent`)
  if (!response.data.success) {
    throw new Error(response.data.message || '删除失败')
  }
  return response.data
}

export default function ReceiptsRecycleBin() {
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [activeTab, setActiveTab] = useState<ReceiptType>('loading')
  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    departmentId?: number
    userId?: number
  }>({})
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string }>>([])
  const [companyBusinessType, setCompanyBusinessType] = useState<'truck' | 'tanker' | null>(null)

  // 加载部门和司机数据
  useEffect(() => {
    const loadDepartmentsAndDrivers = async () => {
      try {
        // 这里应该从API获取部门和司机列表
        // 暂时使用空数组，实际应该调用后端API
        setDepartments([])
        setDrivers([])
        // TODO: 从后端API加载部门和司机数据
      } catch (error) {
        console.error('加载部门和司机数据失败:', error)
      }
    }
    loadDepartmentsAndDrivers()
  }, [effectiveCompanyId])

  // 根据业务类型获取应显示的tabs
  const getVisibleTabs = () => {
    const allTabs = RECEIPT_TYPES
    if (!companyBusinessType) return allTabs
    
    if (companyBusinessType === 'truck') {
      // 挂车：只显示装料单、卸货单、充电单
      return allTabs.filter((t) => ['loading', 'unloading', 'charging'].includes(t.value))
    } else if (companyBusinessType === 'tanker') {
      // 罐车：只显示出厂单、充电单、水票
      return allTabs.filter((t) => ['departure', 'charging', 'water'].includes(t.value))
    }
    return allTabs
  }

  // 获取已删除的票据数据
  const receiptsQuery = useQuery<Receipt[]>({
    queryKey: ['deleted-receipts', activeTab, filters, effectiveCompanyId],
    queryFn: () =>
      fetchDeletedReceipts({
        receiptType: activeTab,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
        departmentId: filters.departmentId,
        userId: filters.userId,
      }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const receipts = receiptsQuery.data || []

  // 恢复票据
  const restoreMutation = useMutation({
    mutationFn: ({ type, id }: { type: ReceiptType; id: number }) => restoreReceipt(type, id),
    onSuccess: () => {
      message.success('恢复成功')
      queryClient.invalidateQueries({ queryKey: ['deleted-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '恢复失败')
    },
  })

  // 永久删除票据
  const permanentDeleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: ReceiptType; id: number }) =>
      permanentlyDeleteReceipt(type, id),
    onSuccess: () => {
      message.success('永久删除成功')
      queryClient.invalidateQueries({ queryKey: ['deleted-receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  const handleSearch = (values: {
    dateRange?: Dayjs[]
    departmentId?: number
    userId?: number
  }) => {
    setFilters({
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      departmentId: values.departmentId,
      userId: values.userId,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  // 单个恢复
  const handleRestore = useCallback(
    (receipt: Receipt) => {
      modal.confirm({
        title: '确认恢复',
        content: `确定要恢复该${RECEIPT_TYPES.find((t) => t.value === receipt.type)?.label || '票据'}吗？`,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          await restoreMutation.mutateAsync({ type: receipt.type, id: receipt.id })
        },
      })
    },
    [modal, restoreMutation]
  )

  // 批量恢复
  const handleBatchRestore = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要恢复的数据')
      return
    }

    const typeLabel = RECEIPT_TYPES.find((t) => t.value === activeTab)?.label || '票据'

    modal.confirm({
      title: '确认恢复',
      content: `确定要恢复选中的 ${selectedRowKeys.length} 条${typeLabel}记录吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const restorePromises = selectedRowKeys.map((key) => {
            const [type, id] = String(key).split('-')
            const receiptId = Number(id)
            return restoreMutation.mutateAsync({ type: type as ReceiptType, id: receiptId })
          })
          await Promise.all(restorePromises)
          message.success('批量恢复成功')
          setSelectedRowKeys([])
        } catch (error) {
          message.error('批量恢复失败：' + (error as Error).message)
        }
      },
    })
  }, [modal, selectedRowKeys, activeTab, restoreMutation])

  // 永久删除
  const handlePermanentDelete = useCallback(
    (receipt: Receipt) => {
      modal.confirm({
        title: '确认永久删除',
        content: (
          <div>
            <p>
              确定要永久删除该{RECEIPT_TYPES.find((t) => t.value === receipt.type)?.label || '票据'}
              吗？
            </p>
            <p style={{ color: 'red' }}>此操作不可恢复！</p>
          </div>
        ),
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          await permanentDeleteMutation.mutateAsync({ type: receipt.type, id: receipt.id })
        },
      })
    },
    [modal, permanentDeleteMutation]
  )

  // 表格列定义
  const getColumns = (type: ReceiptType): ColumnsType<Receipt> => {
    const baseColumns: ColumnsType<Receipt> = [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
      },
      {
        title: '删除时间',
        dataIndex: 'deleted_at',
        key: 'deleted_at',
        width: 180,
        render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
      },
    ]

    // 根据类型添加特定列
    if (type === 'loading' || type === 'unloading') {
      baseColumns.push(
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
        },
        {
          title: '净重(t)',
          dataIndex: 'net_weight',
          key: 'net_weight',
          width: 100,
          render: (val: number) => val?.toFixed(2) || '-',
        }
      )
    } else if (type === 'charging') {
      baseColumns.push(
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '充电站',
          dataIndex: 'charging_station',
          key: 'charging_station',
          width: 150,
        },
        {
          title: '电量(kWh)',
          dataIndex: 'energy_kwh',
          key: 'energy_kwh',
          width: 100,
          render: (val: number) => val?.toFixed(2) || '-',
        }
      )
    } else if (type === 'water') {
      baseColumns.push(
        {
          title: '公司',
          dataIndex: 'company_name',
          key: 'company_name',
          width: 200,
        },
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        }
      )
    } else if (type === 'departure') {
      baseColumns.push(
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
        },
        {
          title: '方量',
          dataIndex: 'concrete_volume',
          key: 'concrete_volume',
          width: 100,
        }
      )
    }

    baseColumns.push(
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        fixed: 'right',
        render: (_: any, record: Receipt) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRestore(record)}
              loading={restoreMutation.isPending}
            >
              恢复
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handlePermanentDelete(record)}
              loading={permanentDeleteMutation.isPending}
            >
              永久删除
            </Button>
          </Space>
        ),
      }
    )

    return baseColumns
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            票据回收站
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            已删除的票据数据，可以恢复或永久删除。超过30天的数据将自动清理。
          </Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['deleted-receipts'] })}
          >
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<RollbackOutlined />}
              onClick={handleBatchRestore}
              loading={restoreMutation.isPending}
            >
              批量恢复 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看回收站数据" showIcon />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ReceiptType)}
          items={getVisibleTabs().map((type) => ({
            key: type.value,
            label: type.label,
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
                  <Form.Item name="dateRange" label="删除日期">
                    <RangePicker allowClear />
                  </Form.Item>
                  <Form.Item name="departmentId" label="部门">
                    <Select
                      placeholder="选择部门"
                      allowClear
                      style={{ width: 150 }}
                      options={departments.map((dept) => ({
                        label: dept.name,
                        value: dept.id,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="userId" label="司机">
                    <Select
                      placeholder="选择司机"
                      allowClear
                      style={{ width: 150 }}
                      options={drivers.map((driver) => ({
                        label: driver.name,
                        value: driver.id,
                      }))}
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

                {receiptsQuery.error && (
                  <Alert
                    type="error"
                    showIcon
                    message={(receiptsQuery.error as Error).message || '数据加载失败'}
                  />
                )}

                <Table
                  rowKey={(record: any) => `${record.type}-${record.id}`}
                  columns={getColumns(activeTab)}
                  dataSource={receipts as any}
                  loading={receiptsQuery.isLoading}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                  }}
                  pagination={{
                    total: receipts.length,
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  scroll={{ x: 1000 }}
                />
              </Space>
            ),
          }))}
        />
      </Card>
    </Space>
  )
}
