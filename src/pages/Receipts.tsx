import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Image,
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
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { RECEIPT_TYPES, fetchReceipts, updateChargingReceipt, updateWaterTicket, deleteWaterTicket } from '../api/services/receipts'
import { fetchUsers } from '../api/services/users'
import type { Receipt, ReceiptType } from '../api/types'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

const getReceiptTypeLabel = (type: ReceiptType) =>
  RECEIPT_TYPES.find((item) => item.value === type)?.label || type

const ReceiptsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()

  const [activeTab, setActiveTab] = useState<ReceiptType | 'stats'>('loading')
  const [filters, setFilters] = useState<{
    receiptType?: ReceiptType
    startDate?: string
    endDate?: string
    vehicleNo?: string
    driverName?: string
  }>({})
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined)
  const [editForm] = Form.useForm()

  // 获取用户列表
  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => fetchUsers({ size: 1000 }),
  })

  const users = usersQuery.data?.items || []

  // 用户ID：优先使用选择的用户，否则使用第一个用户（如果有）
  const userId = selectedUserId || users[0]?.id || 1

  // 获取当前标签页的票据数据
  const receiptsQuery = useQuery<Receipt[]>({
    queryKey: ['receipts', activeTab, filters, userId],
    queryFn: () =>
      fetchReceipts({
        userId,
        receiptType: activeTab === 'stats' ? undefined : activeTab,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
  })

  // 获取所有票据数据（用于统计）
  const allReceiptsQuery = useQuery<Receipt[]>({
    queryKey: ['receipts', 'all', filters, userId],
    queryFn: () =>
      fetchReceipts({
        userId,
        receiptType: undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    enabled: activeTab === 'stats',
  })

  const receipts = activeTab === 'stats' ? allReceiptsQuery.data || [] : receiptsQuery.data || []

  // 编辑充电单
  const updateChargingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateChargingReceipt(id, data),
    onSuccess: () => {
      message.success('更新成功')
      setEditDrawerOpen(false)
      setEditingReceipt(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  // 更新水票
  const updateWaterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateWaterTicket(id, data),
    onSuccess: () => {
      message.success('更新成功')
      setEditDrawerOpen(false)
      setEditingReceipt(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  // 删除水票
  const deleteWaterMutation = useMutation({
    mutationFn: (id: number) => deleteWaterTicket(id),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 统计数据
  const stats = useMemo(() => {
    const total = receipts.length
    const byType: Record<ReceiptType, number> = {
      loading: 0,
      unloading: 0,
      charging: 0,
      water: 0,
    }
    let totalAmount = 0
    let totalEnergy = 0
    let totalWeight = 0

    receipts.forEach((receipt) => {
      byType[receipt.type] = (byType[receipt.type] || 0) + 1

      if (receipt.type === 'charging') {
        const charging = receipt as Receipt & { amount?: number; energy_kwh?: number }
        totalAmount += charging.amount || 0
        totalEnergy += charging.energy_kwh || 0
      } else if (receipt.type === 'loading' || receipt.type === 'unloading') {
        const weightReceipt = receipt as Receipt & { net_weight?: number }
        totalWeight += weightReceipt.net_weight || 0
      }
    })

    return {
      total,
      byType,
      totalAmount,
      totalEnergy,
      totalWeight,
    }
  }, [receipts])

  const handleSearch = (values: {
    receiptType?: ReceiptType
    dateRange?: Dayjs[]
    vehicleNo?: string
    driverName?: string
  }) => {
    setFilters({
      receiptType: values.receiptType,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      vehicleNo: values.vehicleNo,
      driverName: values.driverName,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = useCallback((receipt: Receipt) => {
    setSelectedReceipt(receipt)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedReceipt(null)
  }

  // 装料单列定义
  const loadingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: '公司',
        dataIndex: 'company',
        width: 150,
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 120,
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
      },
      {
        title: '材料名称',
        dataIndex: 'material_name',
        width: 150,
      },
      {
        title: '净重(t)',
        dataIndex: 'net_weight',
        width: 100,
        render: (value: number) => (value ? value.toFixed(2) : '-'),
      },
      {
        title: '进厂时间',
        dataIndex: 'loading_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              查看
            </Button>
            {(record.type === 'charging' || record.type === 'water') && (
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [openDetail],
  )

  // 卸货单列定义
  const unloadingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: '公司',
        dataIndex: 'company',
        width: 150,
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 120,
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
      },
      {
        title: '材料名称',
        dataIndex: 'material_name',
        width: 150,
      },
      {
        title: '净重(t)',
        dataIndex: 'net_weight',
        width: 100,
        render: (value: number) => (value ? value.toFixed(2) : '-'),
      },
      {
        title: '任务ID',
        dataIndex: 'task_id',
        width: 150,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              查看
            </Button>
            {(record.type === 'charging' || record.type === 'water') && (
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [openDetail],
  )

  // 充电单列定义
  const chargingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: '单据编号',
        dataIndex: 'receipt_number',
        width: 150,
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
      },
      {
        title: '充电站',
        dataIndex: 'charging_station',
        width: 150,
      },
      {
        title: '充电桩',
        dataIndex: 'charging_pile',
        width: 120,
      },
      {
        title: '电量(kWh)',
        dataIndex: 'energy_kwh',
        width: 120,
        render: (value: number) => (value ? value.toFixed(2) : '-'),
      },
      {
        title: '金额(元)',
        dataIndex: 'amount',
        width: 120,
        render: (value: number) => (value ? value.toFixed(2) : '-'),
      },
      {
        title: '充电时间',
        dataIndex: 'start_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              查看
            </Button>
            {(record.type === 'charging' || record.type === 'water') && (
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [openDetail],
  )

  // 水票列定义
  const waterColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: '公司',
        dataIndex: ['company', 'company_name'],
        width: 150,
        render: (_, record) => (record as Receipt & { company?: string; company_name?: string }).company || (record as Receipt & { company_name?: string }).company_name || '-',
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
      },
      {
        title: '日期',
        dataIndex: 'ticket_date',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              查看
            </Button>
            {(record.type === 'charging' || record.type === 'water') && (
              <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [openDetail],
  )

  const getColumns = (type: ReceiptType | 'stats'): ColumnsType<Receipt> => {
    if (type === 'stats') return loadingColumns
    switch (type) {
      case 'loading':
        return loadingColumns
      case 'unloading':
        return unloadingColumns
      case 'charging':
        return chargingColumns
      case 'water':
        return waterColumns
      default:
        return loadingColumns
    }
  }

  const renderDetail = () => {
    if (!selectedReceipt) return null

    const receipt = selectedReceipt
    const imageUrl = receipt.thumb_url || (receipt as Receipt & { image_path?: string }).image_path

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {imageUrl && (
          <Card title="票据图片" size="small">
            <Image src={imageUrl} alt="票据图片" style={{ maxWidth: '100%' }} />
          </Card>
        )}

        <Card title="基本信息" size="small">
          <Descriptions column={1} bordered size="small">
            {receipt.type === 'loading' && (
              <>
                <Descriptions.Item label="类型">装料单</Descriptions.Item>
                <Descriptions.Item label="公司">{receipt.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="材料名称">{receipt.material_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{receipt.material_spec || '-'}</Descriptions.Item>
                <Descriptions.Item label="毛重(t)">
                  {(receipt as Receipt & { gross_weight?: number }).gross_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="净重(t)">
                  {(receipt as Receipt & { net_weight?: number }).net_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="皮重(t)">
                  {(receipt as Receipt & { tare_weight?: number }).tare_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="进厂时间">
                  {(receipt as Receipt & { loading_time?: string }).loading_time
                    ? dayjs((receipt as Receipt & { loading_time?: string }).loading_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="出厂时间">
                  {(receipt as Receipt & { unloading_time?: string }).unloading_time
                    ? dayjs((receipt as Receipt & { unloading_time?: string }).unloading_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'unloading' && (
              <>
                <Descriptions.Item label="类型">卸货单</Descriptions.Item>
                <Descriptions.Item label="公司">{receipt.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="材料名称">{receipt.material_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{receipt.material_spec || '-'}</Descriptions.Item>
                <Descriptions.Item label="毛重(t)">
                  {(receipt as Receipt & { gross_weight?: number }).gross_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="净重(t)">
                  {(receipt as Receipt & { net_weight?: number }).net_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="皮重(t)">
                  {(receipt as Receipt & { tare_weight?: number }).tare_weight?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="任务ID">
                  {(receipt as Receipt & { task_id?: string }).task_id || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'charging' && (
              <>
                <Descriptions.Item label="类型">充电单</Descriptions.Item>
                <Descriptions.Item label="单据编号">
                  {(receipt as Receipt & { receipt_number?: string }).receipt_number || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="充电站">
                  {(receipt as Receipt & { charging_station?: string }).charging_station || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="充电桩">
                  {(receipt as Receipt & { charging_pile?: string }).charging_pile || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="电量(kWh)">
                  {(receipt as Receipt & { energy_kwh?: number }).energy_kwh?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="金额(元)">
                  {(receipt as Receipt & { amount?: number }).amount?.toFixed(2) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">
                  {(receipt as Receipt & { start_time?: string }).start_time
                    ? dayjs((receipt as Receipt & { start_time?: string }).start_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="结束时间">
                  {(receipt as Receipt & { end_time?: string }).end_time
                    ? dayjs((receipt as Receipt & { end_time?: string }).end_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="时长(分钟)">
                  {(receipt as Receipt & { duration_min?: number }).duration_min || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'water' && (
              <>
                <Descriptions.Item label="类型">水票</Descriptions.Item>
                <Descriptions.Item label="公司">
                  {(receipt as Receipt & { company?: string; company_name?: string }).company ||
                    (receipt as Receipt & { company_name?: string }).company_name ||
                    '-'}
                </Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="日期">
                  {(receipt as Receipt & { ticket_date?: string }).ticket_date
                    ? dayjs((receipt as Receipt & { ticket_date?: string }).ticket_date).format('YYYY-MM-DD')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>
      </Space>
    )
  }

  // 导出功能
  const handleExport = useCallback(() => {
    if (receipts.length === 0) {
      message.warning('没有数据可导出')
      return
    }

    try {
      // 准备导出数据
      const exportData = receipts.map((receipt) => {
        const base: Record<string, any> = {
          类型: getReceiptTypeLabel(receipt.type),
          ID: receipt.id,
          创建时间: receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '',
        }

        if (receipt.type === 'loading' || receipt.type === 'unloading') {
          const r = receipt as Receipt & {
            company?: string
            driver_name?: string
            vehicle_no?: string
            material_name?: string
            material_spec?: string
            gross_weight?: number
            net_weight?: number
            tare_weight?: number
            loading_time?: string
            unloading_time?: string
          }
          return {
            ...base,
            公司: r.company || '',
            司机: r.driver_name || '',
            车牌号: r.vehicle_no || '',
            材料名称: r.material_name || '',
            规格型号: r.material_spec || '',
            毛重: r.gross_weight || 0,
            净重: r.net_weight || 0,
            皮重: r.tare_weight || 0,
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm') : '',
            出厂时间: r.unloading_time ? dayjs(r.unloading_time).format('YYYY-MM-DD HH:mm') : '',
          }
        } else if (receipt.type === 'charging') {
          const r = receipt as Receipt & {
            receipt_number?: string
            vehicle_no?: string
            charging_station?: string
            charging_pile?: string
            energy_kwh?: number
            amount?: number
            start_time?: string
            end_time?: string
            duration_min?: number
          }
          return {
            ...base,
            单据编号: r.receipt_number || '',
            车牌号: r.vehicle_no || '',
            充电站: r.charging_station || '',
            充电桩: r.charging_pile || '',
            电量: r.energy_kwh || 0,
            金额: r.amount || 0,
            开始时间: r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
            结束时间: r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
            时长: r.duration_min || 0,
          }
        } else if (receipt.type === 'water') {
          const r = receipt as Receipt & {
            company?: string
            company_name?: string
            vehicle_no?: string
            ticket_date?: string
          }
          return {
            ...base,
            公司: r.company || r.company_name || '',
            车牌号: r.vehicle_no || '',
            日期: r.ticket_date ? dayjs(r.ticket_date).format('YYYY-MM-DD') : '',
          }
        }
        return base
      })

      // 创建工作簿
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '票据数据')

      // 导出文件
      const fileName = `票据数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }, [receipts])

  // 批量导出
  const handleBatchExport = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的数据')
      return
    }

    const selectedReceipts = receipts.filter((receipt) =>
      selectedRowKeys.includes(`${receipt.type}-${receipt.id}`),
    )
    if (selectedReceipts.length === 0) {
      message.warning('没有选中的数据')
      return
    }

    // 使用选中的数据进行导出
    try {
      const exportData = selectedReceipts.map((receipt) => {
        const base: Record<string, any> = {
          类型: getReceiptTypeLabel(receipt.type),
          ID: receipt.id,
          创建时间: receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm') : '',
        }

        if (receipt.type === 'loading' || receipt.type === 'unloading') {
          const r = receipt as Receipt & {
            company?: string
            driver_name?: string
            vehicle_no?: string
            material_name?: string
            material_spec?: string
            gross_weight?: number
            net_weight?: number
            tare_weight?: number
            loading_time?: string
            unloading_time?: string
          }
          return {
            ...base,
            公司: r.company || '',
            司机: r.driver_name || '',
            车牌号: r.vehicle_no || '',
            材料名称: r.material_name || '',
            规格型号: r.material_spec || '',
            毛重: r.gross_weight || 0,
            净重: r.net_weight || 0,
            皮重: r.tare_weight || 0,
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm') : '',
            出厂时间: r.unloading_time ? dayjs(r.unloading_time).format('YYYY-MM-DD HH:mm') : '',
          }
        } else if (receipt.type === 'charging') {
          const r = receipt as Receipt & {
            receipt_number?: string
            vehicle_no?: string
            charging_station?: string
            charging_pile?: string
            energy_kwh?: number
            amount?: number
            start_time?: string
            end_time?: string
            duration_min?: number
          }
          return {
            ...base,
            单据编号: r.receipt_number || '',
            车牌号: r.vehicle_no || '',
            充电站: r.charging_station || '',
            充电桩: r.charging_pile || '',
            电量: r.energy_kwh || 0,
            金额: r.amount || 0,
            开始时间: r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
            结束时间: r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
            时长: r.duration_min || 0,
          }
        } else if (receipt.type === 'water') {
          const r = receipt as Receipt & {
            company?: string
            company_name?: string
            vehicle_no?: string
            ticket_date?: string
          }
          return {
            ...base,
            公司: r.company || r.company_name || '',
            车牌号: r.vehicle_no || '',
            日期: r.ticket_date ? dayjs(r.ticket_date).format('YYYY-MM-DD') : '',
          }
        }
        return base
      })

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '票据数据')

      const fileName = `票据数据_批量_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }, [selectedRowKeys, receipts])

  // 批量删除（仅支持水票）
  const handleBatchDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的数据')
      return
    }

    if (activeTab !== 'water') {
      message.warning('批量删除仅支持水票')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条水票记录吗？此操作不可恢复。`,
      onOk: async () => {
        try {
          const deletePromises = selectedRowKeys.map((key) => {
            const [type, id] = String(key).split('-')
            if (type === 'water') {
              return deleteWaterMutation.mutateAsync(Number(id))
            }
            return Promise.resolve()
          })
          await Promise.all(deletePromises)
          message.success('删除成功')
          setSelectedRowKeys([])
        } catch (error) {
          message.error('删除失败：' + (error as Error).message)
        }
      },
    })
  }, [selectedRowKeys, activeTab, deleteWaterMutation])

  // 打开编辑
  const openEdit = useCallback((receipt: Receipt) => {
    if (receipt.type !== 'charging' && receipt.type !== 'water') {
      message.warning('当前仅支持编辑充电单和水票')
      return
    }
    setEditingReceipt(receipt)
    setEditDrawerOpen(true)

    if (receipt.type === 'charging') {
      const r = receipt as Receipt & {
        receipt_number?: string
        vehicle_no?: string
        charging_station?: string
        charging_pile?: string
        energy_kwh?: number
        amount?: number
        start_time?: string
        end_time?: string
        duration_min?: number
      }
      editForm.setFieldsValue({
        receipt_number: r.receipt_number,
        vehicle_no: r.vehicle_no,
        charging_station: r.charging_station,
        charging_pile: r.charging_pile,
        energy_kwh: r.energy_kwh,
        amount: r.amount,
        start_time: r.start_time ? dayjs(r.start_time) : undefined,
        end_time: r.end_time ? dayjs(r.end_time) : undefined,
        duration_min: r.duration_min,
      })
    } else if (receipt.type === 'water') {
      const r = receipt as Receipt & {
        company_name?: string
        vehicle_no?: string
        ticket_date?: string
      }
      editForm.setFieldsValue({
        company_name: r.company_name || (receipt as Receipt & { company?: string }).company,
        vehicle_no: r.vehicle_no,
        ticket_date: r.ticket_date ? dayjs(r.ticket_date) : undefined,
      })
    }
  }, [editForm, message])

  // 提交编辑
  const handleEditSubmit = useCallback(() => {
    editForm.validateFields().then((values) => {
      if (!editingReceipt) return

      if (editingReceipt.type === 'charging') {
        updateChargingMutation.mutate({
          id: editingReceipt.id,
          data: {
            ...values,
            start_time: values.start_time ? values.start_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
            end_time: values.end_time ? values.end_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
          },
        })
      } else if (editingReceipt.type === 'water') {
        updateWaterMutation.mutate({
          id: editingReceipt.id,
          data: {
            ...values,
            ticket_date: values.ticket_date ? values.ticket_date.format('YYYY-MM-DD') : undefined,
          },
        })
      }
    })
  }, [editForm, editingReceipt, updateChargingMutation, updateWaterMutation])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            票据管理中心
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理装料单、卸货单、充电单、水票等各类票据记录。
          </Paragraph>
        </div>
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择用户"
            value={selectedUserId}
            onChange={setSelectedUserId}
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
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['receipts'] })}>
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleBatchExport}>
                批量导出 ({selectedRowKeys.length})
              </Button>
              {activeTab === 'water' && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                  loading={deleteWaterMutation.isPending}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              )}
            </>
          )}
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出全部
          </Button>
        </Space>
      </Flex>

      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="总票据数" value={stats.total} loading={receiptsQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总金额(元)"
              value={stats.totalAmount}
              precision={2}
              loading={receiptsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总电量(kWh)"
              value={stats.totalEnergy}
              precision={2}
              loading={receiptsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总重量(t)"
              value={stats.totalWeight}
              precision={2}
              loading={receiptsQuery.isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ReceiptType | 'stats')}
          items={[
            ...RECEIPT_TYPES.map((type) => ({
            key: type.value,
            label: (
              <Space>
                <span>{type.label}</span>
                <Tag>{stats.byType[type.value] || 0}</Tag>
              </Space>
            ),
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
                  <Form.Item name="dateRange" label="日期范围">
                    <RangePicker allowClear />
                  </Form.Item>
                  <Form.Item name="vehicleNo" label="车牌号">
                    <Input placeholder="请输入车牌号" allowClear style={{ width: 150 }} />
                  </Form.Item>
                  <Form.Item name="driverName" label="司机姓名">
                    <Input placeholder="请输入司机姓名" allowClear style={{ width: 150 }} />
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
                  rowKey={(record) => `${record.type}-${record.id}`}
                  columns={getColumns(activeTab)}
                  dataSource={receipts}
                  loading={receiptsQuery.isLoading}
                  rowSelection={
                    activeTab !== 'stats'
                      ? {
                          selectedRowKeys,
                          onChange: setSelectedRowKeys,
                        }
                      : undefined
                  }
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
          })),
          {
            key: 'stats',
            label: '统计分析',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Card title="按类型统计" size="small">
                      <Table
                        size="small"
                        columns={[
                          { title: '类型', dataIndex: 'type', render: (v) => getReceiptTypeLabel(v) },
                          { title: '数量', dataIndex: 'count' },
                        ]}
                        dataSource={Object.entries(stats.byType).map(([type, count]) => ({
                          key: type,
                          type: type as ReceiptType,
                          count,
                        }))}
                        pagination={false}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="按车辆统计" size="small">
                      <Table
                        size="small"
                        columns={[
                          { title: '车牌号', dataIndex: 'vehicle' },
                          { title: '数量', dataIndex: 'count' },
                        ]}
                        dataSource={Object.entries(
                          receipts.reduce((acc, receipt) => {
                            const vehicle = receipt.vehicle_no || '未知'
                            acc[vehicle] = (acc[vehicle] || 0) + 1
                            return acc
                          }, {} as Record<string, number>),
                        )
                          .map(([vehicle, count]) => ({ key: vehicle, vehicle, count }))
                          .sort((a, b) => (b.count as number) - (a.count as number))
                          .slice(0, 10)}
                        pagination={false}
                      />
                    </Card>
                  </Col>
                </Row>
                <Card title="按司机统计" size="small">
                  <Table
                    size="small"
                    columns={[
                      { title: '司机姓名', dataIndex: 'driver' },
                      { title: '数量', dataIndex: 'count' },
                    ]}
                    dataSource={Object.entries(
                      receipts.reduce((acc, receipt) => {
                        const driver =
                          (receipt as Receipt & { driver_name?: string }).driver_name || '未知'
                        acc[driver] = (acc[driver] || 0) + 1
                        return acc
                      }, {} as Record<string, number>),
                    )
                      .map(([driver, count]) => ({ key: driver, driver, count }))
                      .sort((a, b) => (b.count as number) - (a.count as number))
                      .slice(0, 10)}
                    pagination={false}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
        />
      </Card>

      <Drawer
        title={selectedReceipt ? `${getReceiptTypeLabel(selectedReceipt.type)}详情` : '票据详情'}
        width={600}
        open={detailDrawerOpen}
        onClose={closeDetail}
      >
        {selectedReceipt ? renderDetail() : <Empty description="暂无数据" />}
      </Drawer>

      {/* 编辑表单Drawer */}
      <Drawer
        title={editingReceipt ? `编辑${getReceiptTypeLabel(editingReceipt.type)}` : '编辑票据'}
        width={600}
        open={editDrawerOpen}
        onClose={() => {
          setEditDrawerOpen(false)
          setEditingReceipt(null)
          editForm.resetFields()
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setEditDrawerOpen(false)
                setEditingReceipt(null)
                editForm.resetFields()
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleEditSubmit}
              loading={updateChargingMutation.isPending || updateWaterMutation.isPending}
            >
              保存
            </Button>
          </Space>
        }
      >
        {editingReceipt && (
          <Form form={editForm} layout="vertical">
            {editingReceipt.type === 'charging' && (
              <>
                <Form.Item name="receipt_number" label="单据编号">
                  <Input placeholder="请输入单据编号" />
                </Form.Item>
                <Form.Item name="vehicle_no" label="车牌号">
                  <Input placeholder="请输入车牌号" />
                </Form.Item>
                <Form.Item name="charging_station" label="充电站">
                  <Input placeholder="请输入充电站名称" />
                </Form.Item>
                <Form.Item name="charging_pile" label="充电桩">
                  <Input placeholder="请输入充电桩编号" />
                </Form.Item>
                <Form.Item name="energy_kwh" label="电量(kWh)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入电量" />
                </Form.Item>
                <Form.Item name="amount" label="金额(元)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入金额" />
                </Form.Item>
                <Form.Item name="start_time" label="开始时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
                <Form.Item name="end_time" label="结束时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
                <Form.Item name="duration_min" label="时长(分钟)">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入时长" />
                </Form.Item>
              </>
            )}
            {editingReceipt.type === 'water' && (
              <>
                <Form.Item name="company_name" label="公司名称">
                  <Input placeholder="请输入公司名称" />
                </Form.Item>
                <Form.Item name="vehicle_no" label="车牌号">
                  <Input placeholder="请输入车牌号" />
                </Form.Item>
                <Form.Item name="ticket_date" label="日期">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </>
            )}
          </Form>
        )}
      </Drawer>
    </Space>
  )
}

export default ReceiptsPage

