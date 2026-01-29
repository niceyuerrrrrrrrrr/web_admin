import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  DeleteOutlined,
  EyeOutlined,
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

type RecycleBinTabType = ReceiptType | 'matched'

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
  const raw = response.data.data
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.records)
      ? raw.records
      : Array.isArray(raw?.items)
        ? raw.items
        : []
  return list as Receipt[]
}

// 获取已删除的装卸匹配
const fetchDeletedMatchedReceipts = async (params: {
  startDate?: string
  endDate?: string
  companyId?: number
  departmentId?: number
}) => {
  const response = await client.get('/receipts/matched-receipts', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      company_id: params.companyId,
      department_id: params.departmentId,
      deleted_status: 'deleted', // 只获取已删除的
    },
  })
  if (!response.data.success) {
    throw new Error(response.data.message || '获取失败')
  }
  return response.data.data?.receipts || []
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

// 恢复装卸匹配
const restoreMatchedReceipt = async (taskId: string) => {
  const response = await client.post(`/transport-match/${taskId}/restore`)
  if (!response.data.success) {
    throw new Error(response.data.message || '恢复失败')
  }
  return response.data
}

// 永久删除装卸匹配
const permanentlyDeleteMatchedReceipt = async (taskId: string) => {
  const response = await client.delete(`/transport-match/${taskId}`)
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

  const [activeTab, setActiveTab] = useState<RecycleBinTabType>('loading')
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
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)

  // 加载公司业务类型、部门和司机数据
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        // 加载公司业务类型
        const companyResponse = await client.get('/companies', {
          params: { company_id: effectiveCompanyId },
        })
        if (companyResponse.data.success) {
          const companies = companyResponse.data.data
          const company = Array.isArray(companies) ? companies[0] : companies
          if (company) {
            const businessType = company.business_type || company.businessType
            // 侧翻和水泥罐车使用挂车逻辑
            const normalizedType = (businessType === '挂车' || businessType === '侧翻' || businessType === '水泥罐车') ? 'truck' 
                                 : businessType === '罐车' ? 'tanker' 
                                 : null
            setCompanyBusinessType(normalizedType)
          }
        }

        // 从API加载部门列表
        const deptResponse = await client.get('/departments', {
          params: { company_id: effectiveCompanyId },
        })
        if (deptResponse.data.success) {
          const raw = deptResponse.data.data
          const list = Array.isArray(raw) ? raw : Array.isArray(raw?.records) ? raw.records : []
          setDepartments(
            list.map((dept: any) => ({
              id: dept.id,
              name: dept.title || dept.name,
            })),
          )
        }

        // 从API加载司机列表
        const driverResponse = await client.get('/users', {
          params: {
            company_id: effectiveCompanyId,
            position_type: '司机',
          },
        })
        if (driverResponse.data.success) {
          const raw = driverResponse.data.data
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
              ? raw.items
              : Array.isArray(raw?.records)
                ? raw.records
                : []
          setDrivers(
            list.map((u: any) => ({
              id: u.id,
              name: u.nickname || u.username || u.name,
            })),
          )
        }
      } catch (error) {
        console.error('加载公司数据失败:', error)
        // 加载失败时使用空数组
        setDepartments([])
        setDrivers([])
      }
    }
    
    if (effectiveCompanyId) {
      loadCompanyData()
    }
  }, [effectiveCompanyId])

  // 根据业务类型获取应显示的tabs
  const getVisibleTabs = () => {
    const allTabs = [...RECEIPT_TYPES, { label: '装卸匹配', value: 'matched' }]
    if (!companyBusinessType) return allTabs
    
    if (companyBusinessType === 'truck') {
      // 挂车：显示装料单、卸货单、充电单、装卸匹配
      return allTabs.filter((t) => ['loading', 'unloading', 'charging', 'matched'].includes(t.value))
    } else if (companyBusinessType === 'tanker') {
      // 罐车：只显示出厂单、充电单、水票（罐车没有装卸匹配）
      return allTabs.filter((t) => ['departure', 'charging', 'water'].includes(t.value))
    }
    return allTabs
  }

  // 获取已删除的票据数据
  const receiptsQuery = useQuery<any[]>({
    queryKey: ['deleted-receipts', activeTab, filters, effectiveCompanyId],
    queryFn: () => {
      if (activeTab === 'matched') {
        return fetchDeletedMatchedReceipts({
          startDate: filters.startDate,
          endDate: filters.endDate,
          companyId: effectiveCompanyId,
          departmentId: filters.departmentId,
        })
      }
      return fetchDeletedReceipts({
        receiptType: activeTab as ReceiptType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
        departmentId: filters.departmentId,
        userId: filters.userId,
      })
    },
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const receipts = receiptsQuery.data || []

  // 恢复票据
  const restoreMutation = useMutation({
    mutationFn: ({ type, id, taskId }: { type: RecycleBinTabType; id?: number; taskId?: string }) => {
      if (type === 'matched' && taskId) {
        return restoreMatchedReceipt(taskId)
      }
      return restoreReceipt(type as ReceiptType, id!)
    },
    onSuccess: () => {
      message.success('恢复成功')
      queryClient.invalidateQueries({ queryKey: ['deleted-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['matched-receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '恢复失败')
    },
  })

  // 永久删除票据
  const permanentDeleteMutation = useMutation({
    mutationFn: ({ type, id, taskId }: { type: RecycleBinTabType; id?: number; taskId?: string }) => {
      if (type === 'matched' && taskId) {
        return permanentlyDeleteMatchedReceipt(taskId)
      }
      return permanentlyDeleteReceipt(type as ReceiptType, id!)
    },
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

  // 查看详情
  const handleViewDetail = useCallback((record: any) => {
    setSelectedReceipt(record)
    setDetailDrawerOpen(true)
  }, [])

  // 单个恢复
  const handleRestore = useCallback(
    (record: any) => {
      const isMatched = activeTab === 'matched'
      const label = isMatched ? '装卸匹配' : RECEIPT_TYPES.find((t) => t.value === record.type)?.label || '票据'
      
      modal.confirm({
        title: '确认恢复',
        content: `确定要恢复该${label}吗？${isMatched ? '同时会恢复关联的装料单和卸货单。' : ''}`,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          if (isMatched) {
            await restoreMutation.mutateAsync({ type: 'matched', taskId: record.task_id })
          } else {
            await restoreMutation.mutateAsync({ type: record.type, id: record.id })
          }
        },
      })
    },
    [modal, restoreMutation, activeTab]
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
    (record: any) => {
      const isMatched = activeTab === 'matched'
      const label = isMatched ? '装卸匹配' : RECEIPT_TYPES.find((t) => t.value === record.type)?.label || '票据'
      
      modal.confirm({
        title: '确认永久删除',
        content: (
          <div>
            <p>
              确定要永久删除该{label}吗？
              {isMatched && '同时会永久删除关联的装料单和卸货单。'}
            </p>
            <p style={{ color: 'red' }}>此操作不可恢复！</p>
          </div>
        ),
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          if (isMatched) {
            await permanentDeleteMutation.mutateAsync({ type: 'matched', taskId: record.task_id })
          } else {
            await permanentDeleteMutation.mutateAsync({ type: record.type, id: record.id })
          }
        },
      })
    },
    [modal, permanentDeleteMutation, activeTab]
  )

  // 渲染详情
  const renderDetail = () => {
    if (!selectedReceipt) return null

    const receipt = selectedReceipt
    const isMatched = activeTab === 'matched'

    // 装卸匹配详情
    if (isMatched) {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="匹配信息" size="small">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="任务ID">{receipt.task_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={receipt.status === 'finished' ? 'green' : 'blue'}>
                  {receipt.status === 'finished' ? '已完成' : '进行中'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              {receipt.deleted_at && (
                <>
                  <Descriptions.Item label="删除时间">
                    {dayjs(receipt.deleted_at).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="删除人">
                    {receipt.deleted_by_name || '-'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>

          <Card title="装料单信息" size="small">
            <Descriptions column={1} bordered size="small">
              {receipt.loadBill?.thumb_url && !receipt.loadBill.thumb_url.startsWith('wxfile://') && (
                <Descriptions.Item label="票据图片">
                  <Image src={receipt.loadBill.thumb_url} alt="装料单图片" style={{ maxWidth: '100%' }} />
                </Descriptions.Item>
              )}
              <Descriptions.Item label="公司">{receipt.loadBill?.company || '-'}</Descriptions.Item>
              <Descriptions.Item label="司机">{receipt.loadBill?.driver_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{receipt.loadBill?.vehicle_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="材料名称">{receipt.loadBill?.material_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="规格型号">{receipt.loadBill?.material_spec || '-'}</Descriptions.Item>
              <Descriptions.Item label="毛重(t)">
                {receipt.loadBill?.gross_weight ? Number(receipt.loadBill.gross_weight).toFixed(2) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="净重(t)">
                {receipt.loadBill?.net_weight ? Number(receipt.loadBill.net_weight).toFixed(2) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="皮重(t)">
                {receipt.loadBill?.tare_weight ? Number(receipt.loadBill.tare_weight).toFixed(2) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="卸货单信息" size="small">
            <Descriptions column={1} bordered size="small">
              {receipt.unloadBill?.thumb_url && !receipt.unloadBill.thumb_url.startsWith('wxfile://') && (
                <Descriptions.Item label="票据图片">
                  <Image src={receipt.unloadBill.thumb_url} alt="卸货单图片" style={{ maxWidth: '100%' }} />
                </Descriptions.Item>
              )}
              <Descriptions.Item label="公司">{receipt.unloadBill?.company || '-'}</Descriptions.Item>
              <Descriptions.Item label="司机">{receipt.unloadBill?.driver_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{receipt.unloadBill?.vehicle_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="材料名称">{receipt.unloadBill?.material_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="规格型号">{receipt.unloadBill?.material_spec || '-'}</Descriptions.Item>
              <Descriptions.Item label="毛重(t)">
                {receipt.unloadBill?.gross_weight ? Number(receipt.unloadBill.gross_weight).toFixed(2) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="净重(t)">
                {receipt.unloadBill?.net_weight ? Number(receipt.unloadBill.net_weight).toFixed(2) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="皮重(t)">
                {receipt.unloadBill?.tare_weight ? Number(receipt.unloadBill.tare_weight).toFixed(2) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      )
    }

    // 普通票据详情
    const imageUrl = receipt.thumb_url || receipt.image_path
    const hasValidImage = imageUrl && !imageUrl.startsWith('wxfile://') && !imageUrl.startsWith('file://')

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {hasValidImage && (
          <Card title="票据图片" size="small">
            <Image src={imageUrl} alt="票据图片" style={{ maxWidth: '100%' }} />
          </Card>
        )}

        <Card title="基本信息" size="small">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">
              {RECEIPT_TYPES.find((t) => t.value === receipt.type)?.label || '-'}
            </Descriptions.Item>
            
            {(receipt.type === 'loading' || receipt.type === 'unloading') && (
              <>
                <Descriptions.Item label="公司">{receipt.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="材料名称">{receipt.material_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{receipt.material_spec || '-'}</Descriptions.Item>
                <Descriptions.Item label="毛重(t)">
                  {receipt.gross_weight ? Number(receipt.gross_weight).toFixed(2) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="净重(t)">
                  {receipt.net_weight ? Number(receipt.net_weight).toFixed(2) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="皮重(t)">
                  {receipt.tare_weight ? Number(receipt.tare_weight).toFixed(2) : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'charging' && (
              <>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="充电站">{(receipt as any).charging_station || '-'}</Descriptions.Item>
                <Descriptions.Item label="充电桩">{(receipt as any).charging_pile || '-'}</Descriptions.Item>
                <Descriptions.Item label="电量(kWh)">
                  {(receipt as any).energy_kwh ? Number((receipt as any).energy_kwh).toFixed(2) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="金额(元)">
                  {(receipt as any).amount ? Number((receipt as any).amount).toFixed(2) : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'water' && (
              <>
                <Descriptions.Item label="业务单号">{(receipt as any).f_water_ticket_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="公司">{(receipt as any).company_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="日期">
                  {(receipt as any).ticket_date ? dayjs((receipt as any).ticket_date).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'departure' && (
              <>
                <Descriptions.Item label="司机">{receipt.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="自编车号">{(receipt as any).tanker_vehicle_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="装料公司">{(receipt as any).loading_company || '-'}</Descriptions.Item>
                <Descriptions.Item label="工程名称">{(receipt as any).project_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="方量">
                  {(receipt as any).concrete_volume ? Number((receipt as any).concrete_volume).toFixed(2) : '-'}
                </Descriptions.Item>
              </>
            )}

            <Descriptions.Item label="创建时间">
              {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>

            {receipt.deleted_at && (
              <>
                <Descriptions.Item label="删除时间">
                  {dayjs(receipt.deleted_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="删除人">
                  {receipt.deleted_by_name || '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>
      </Space>
    )
  }

  // 表格列定义
  const getColumns = (type: RecycleBinTabType): ColumnsType<any> => {
    // 装卸匹配的列定义
    if (type === 'matched') {
      return [
        {
          title: '任务ID',
          dataIndex: 'task_id',
          key: 'task_id',
          width: 180,
        },
        {
          title: '装料单',
          key: 'loading',
          width: 200,
          render: (_, record: any) => {
            const load = record.loadBill
            return load ? `${load.driver_name || '-'} / ${load.vehicle_no || '-'}` : '-'
          },
        },
        {
          title: '卸货单',
          key: 'unloading',
          width: 200,
          render: (_, record: any) => {
            const unload = record.unloadBill
            return unload ? `${unload.driver_name || '-'} / ${unload.vehicle_no || '-'}` : '-'
          },
        },
        {
          title: '装料单图片',
          key: 'load_image',
          width: 100,
          render: (_, record: any) => {
            const thumbUrl = record.loadBill?.thumb_url
            if (!thumbUrl || thumbUrl.startsWith('wxfile://') || thumbUrl.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={thumbUrl}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
        },
        {
          title: '卸货单图片',
          key: 'unload_image',
          width: 100,
          render: (_, record: any) => {
            const thumbUrl = record.unloadBill?.thumb_url
            if (!thumbUrl || thumbUrl.startsWith('wxfile://') || thumbUrl.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={thumbUrl}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
        },
        {
          title: '删除时间',
          dataIndex: 'deleted_at',
          key: 'deleted_at',
          width: 180,
          render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
        },
        {
          title: '删除人',
          dataIndex: 'deleted_by_name',
          key: 'deleted_by_name',
          width: 100,
          render: (val: string) => val || '-',
        },
        {
          title: '操作',
          key: 'action',
          width: 200,
          fixed: 'right' as const,
          render: (_: any, record: any) => (
            <Space direction="vertical" size="small">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
                style={{ padding: 0, height: 'auto' }}
              >
                查看详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => handleRestore(record)}
                loading={restoreMutation.isPending}
                style={{ padding: 0, height: 'auto' }}
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
                style={{ padding: 0, height: 'auto' }}
              >
                永久删除
              </Button>
            </Space>
          ),
        },
      ]
    }

    // 普通票据的列定义
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
          title: '公司',
          dataIndex: 'company',
          key: 'company',
          width: 150,
          render: (val: string) => val || '-',
        },
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
          render: (val: string) => val || '-',
        },
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '材料名称',
          dataIndex: 'material_name',
          key: 'material_name',
          width: 150,
          render: (val: string) => val || '-',
        },
        {
          title: '规格型号',
          dataIndex: 'material_spec',
          key: 'material_spec',
          width: 150,
          render: (val: string) => val || '-',
        },
        {
          title: '净重(t)',
          dataIndex: 'net_weight',
          key: 'net_weight',
          width: 100,
          render: (val: any) => (val != null && val !== '' ? Number(val).toFixed(2) : '-'),
        },
        {
          title: '图片',
          dataIndex: 'thumb_url',
          key: 'thumb_url',
          width: 100,
          render: (val: string) => {
            if (!val || val.startsWith('wxfile://') || val.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={val}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
        }
      )
    } else if (type === 'charging') {
      baseColumns.push(
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
          render: (val: string) => val || '-',
        },
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
          render: (val: string) => val || '-',
        },
        {
          title: '充电桩',
          dataIndex: 'charging_pile',
          key: 'charging_pile',
          width: 100,
          render: (val: string) => val || '-',
        },
        {
          title: '电量(kWh)',
          dataIndex: 'energy_kwh',
          key: 'energy_kwh',
          width: 100,
          render: (val: any) => (val != null && val !== '' ? Number(val).toFixed(2) : '-'),
        },
        {
          title: '金额(元)',
          dataIndex: 'amount',
          key: 'amount',
          width: 100,
          render: (val: any) => (val != null && val !== '' ? Number(val).toFixed(2) : '-'),
        },
        {
          title: '图片',
          dataIndex: 'thumb_url',
          key: 'thumb_url',
          width: 100,
          render: (val: string) => {
            if (!val || val.startsWith('wxfile://') || val.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={val}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
        }
      )
    } else if (type === 'water') {
      baseColumns.push(
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
          render: (val: string) => val || '-',
        },
        {
          title: '公司',
          dataIndex: 'company_name',
          key: 'company_name',
          width: 150,
          render: (val: string) => val || '-',
        },
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '日期',
          dataIndex: 'ticket_date',
          key: 'ticket_date',
          width: 120,
          render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
        },
        {
          title: '图片',
          key: 'image',
          width: 100,
          render: (_, record: any) => {
            const imageUrl = record.thumb_url || record.image_path
            if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={imageUrl}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
        }
      )
    } else if (type === 'departure') {
      baseColumns.push(
        {
          title: '司机',
          dataIndex: 'driver_name',
          key: 'driver_name',
          width: 100,
          render: (val: string) => val || '-',
        },
        {
          title: '车牌号',
          dataIndex: 'vehicle_no',
          key: 'vehicle_no',
          width: 120,
        },
        {
          title: '自编车号',
          dataIndex: 'tanker_vehicle_code',
          key: 'tanker_vehicle_code',
          width: 120,
          render: (val: string) => val || '-',
        },
        {
          title: '装料公司',
          dataIndex: 'loading_company',
          key: 'loading_company',
          width: 150,
          render: (val: string) => val || '-',
        },
        {
          title: '方量',
          dataIndex: 'concrete_volume',
          key: 'concrete_volume',
          width: 100,
          render: (val: any) => (val != null && val !== '' ? Number(val).toFixed(2) : '-'),
        },
        {
          title: '图片',
          key: 'image',
          width: 100,
          render: (_, record: any) => {
            const imageUrl = record.thumb_url || record.image_path
            if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
              return '-'
            }
            return (
              <Image
                src={imageUrl}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            )
          },
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
        width: 200,
        fixed: 'right',
        render: (_: any, record: Receipt) => (
          <Space direction="vertical" size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              style={{ padding: 0, height: 'auto' }}
            >
              查看详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRestore(record)}
              loading={restoreMutation.isPending}
              style={{ padding: 0, height: 'auto' }}
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
              style={{ padding: 0, height: 'auto' }}
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
                  rowKey={(record: any) => 
                    activeTab === 'matched' 
                      ? `matched-${record.task_id}` 
                      : `${record.type}-${record.id}`
                  }
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

      {/* 详情抽屉 */}
      <Drawer
        title="票据详情"
        placement="right"
        width={600}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false)
          setSelectedReceipt(null)
        }}
      >
        {selectedReceipt && renderDetail()}
      </Drawer>
    </Space>
  )
}
