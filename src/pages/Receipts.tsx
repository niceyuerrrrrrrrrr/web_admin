import { useCallback, useEffect, useMemo, useState } from 'react'
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
  DollarOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  ToolOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { 
  RECEIPT_TYPES, 
  fetchReceipts, 
  fetchMatchedReceipts, 
  updateChargingReceipt, 
  updateWaterTicket, 
  deleteWaterTicket,
  batchUpdateReceiptField,
  updateLoadingReceipt,
  deleteLoadingReceipt,
  updateUnloadingReceipt,
  deleteUnloadingReceipt,
  deleteChargingReceipt,
  updateDepartureReceipt,
  deleteDepartureReceipt,
  deleteTransportTask,
  submitReceiptToFinance,
  submitReceiptsToFinance,
  restoreReceipt,
} from '../api/services/receipts'
import { fetchCompanyDetail } from '../api/services/companies'
import { fetchDepartments } from '../api/services/departments'
import { fetchUsers } from '../api/services/users'
import type { Receipt, ReceiptType } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import client from '../api/client'
import ColumnSettings from '../components/ColumnSettings'
import { useColumnSettings } from '../hooks/useColumnSettings'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

const getReceiptTypeLabel = (type: ReceiptType) =>
  RECEIPT_TYPES.find((item) => item.value === type)?.label || type

const ReceiptsPage = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()
  const { user, setAuth } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  // 检查是否是司机：除了司机，其他角色都可以编辑、删除、导出
  const isDriver = user?.positionType === '司机' || user?.positionType === '挂车司机' || user?.positionType === '罐车司机'
  // 统计、统计员、车队长、财务、总经理等管理角色可以编辑和删除
  const isManager = ['统计', '统计员', '车队长', '财务', '总经理'].includes(user?.positionType || '')
  const canEditDelete = isSuperAdmin || isManager || !isDriver // 超级管理员、管理角色或非司机可以编辑和删除
  
  // 如果用户信息中没有公司信息，从API获取
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const response = await client.get('/me')
        if (response.data.success && response.data.data?.user) {
          const userData = response.data.data.user
          // 更新store中的用户信息
          const currentToken = useAuthStore.getState().token
          if (currentToken) {
            setAuth({
              token: currentToken,
            user: {
              ...user,
              name: user?.name || userData.name || '',
              role: user?.role || userData.role || '',
              companyId: userData.companyId || user?.companyId,
              companyBusinessType: userData.companyBusinessType || user?.companyBusinessType,
            },
            })
          }
          return userData
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
      }
      return null
    },
    enabled: (!user?.companyId || !user?.companyBusinessType) && !isSuperAdmin, // 只有在缺少公司信息且非超级管理员时才查询
  })

  // 对于非超级管理员，使用用户信息中的公司ID；对于超级管理员，使用选中的公司ID
  // 如果store中没有，使用从API获取的
  const currentUser = meQuery.data || user
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : (currentUser?.companyId || user?.companyId)

  const [activeTab, setActiveTab] = useState<ReceiptType | 'matched'>('loading' as ReceiptType | 'matched')
  const [filters, setFilters] = useState<{
    receiptType?: ReceiptType
    startDate?: string
    endDate?: string
    vehicleNo?: string
    tankerVehicleCode?: string
    deletedStatus?: 'all' | 'normal' | 'deleted'
    submittedStatus?: 'all' | 'submitted' | 'not_submitted'
    volumeFilter?: 'all' | 'small' | 'normal' // 新增：方量筛选
  }>({
    deletedStatus: 'normal', // 默认只显示正常票据
    submittedStatus: 'all', // 默认显示所有交票状态
    volumeFilter: 'all' // 默认显示所有方量
  })
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>(undefined)
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined)
  const [pageSize, setPageSize] = useState(10)
  
  // 数据清洗相关状态
  const [dataCleanModalOpen, setDataCleanModalOpen] = useState(false)
  const [cleanField, setCleanField] = useState<string>('')
  const [selectedOldValues, setSelectedOldValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState<string>('')
  const [editForm] = Form.useForm()
  const [searchForm] = Form.useForm()
  const [matchedEditForm] = Form.useForm()
  const [editingMatched, setEditingMatched] = useState<any>(null)
  const [matchedEditModalOpen, setMatchedEditModalOpen] = useState(false)
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  // 获取当前公司信息以判断业务类型
  // 如果用户信息中没有业务类型，需要从API获取（非超级管理员也可能需要）
  const companyQuery = useQuery({
    queryKey: ['company', effectiveCompanyId],
    queryFn: () => fetchCompanyDetail(effectiveCompanyId!),
    enabled: !!effectiveCompanyId && (!user?.companyBusinessType || isSuperAdmin), // 如果没有业务类型或超级管理员，从API获取
  })
  // 对于超级管理员，使用选中公司的业务类型；对于普通用户，使用用户自己的公司业务类型
  const businessType = isSuperAdmin 
    ? companyQuery.data?.business_type 
    : (currentUser?.companyBusinessType || user?.companyBusinessType || companyQuery.data?.business_type)

  // 查询车辆数据（用于车牌号和车号下拉选择框）
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', effectiveCompanyId],
    queryFn: async () => {
      const res = await client.get('/vehicles/list', {
        params: { 
          company_id: effectiveCompanyId,
          page: 1,
          page_size: 200
        }
      })
      return res.data.data?.vehicles || []
    },
    enabled: !!effectiveCompanyId
  })

  // 根据业务类型过滤可用的票据类型标签页
  const availableTabs = useMemo(() => {
    const tabs = []
    if (businessType === '罐车') {
      // 罐车：出厂单、充电单、水票
      tabs.push(...RECEIPT_TYPES.filter(t => ['departure', 'charging', 'water'].includes(t.value)))
    } else if (businessType === '挂车') {
      // 挂车：装料单、卸货单、充电单、装卸匹配
      tabs.push(...RECEIPT_TYPES.filter(t => ['loading', 'unloading', 'charging'].includes(t.value)))
      tabs.push({ value: 'matched' as any, label: '装卸匹配' })
    } else {
      tabs.push(...RECEIPT_TYPES)
    }
    return tabs
  }, [businessType])

  // 如果当前选中的标签页不在可用列表中，自动切换到第一个可用标签页
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.value === activeTab)) {
      setActiveTab(availableTabs[0].value)
    }
  }, [availableTabs, activeTab])

  // 获取部门列表
  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', effectiveCompanyId],
    queryFn: async () => {
      try {
        const data = await fetchDepartments({ company_id: effectiveCompanyId })
        console.log('部门数据加载成功:', data)
        return data
      } catch (error) {
        console.error('加载部门数据失败:', error)
        // 返回空数据而不是抛出错误，避免页面崩溃
        return { records: [], total: 0 }
      }
    },
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const departments = Array.isArray(departmentsQuery.data?.records) ? departmentsQuery.data.records : []

  // 获取用户列表（根据选择的部门过滤）
  const usersQuery = useQuery({
    queryKey: ['users', 'list', effectiveCompanyId, selectedDepartmentId],
    queryFn: async () => {
      try {
        const data = await fetchUsers({ 
          size: 1000, 
          company_id: effectiveCompanyId,
          department_id: selectedDepartmentId,
        })
        console.log('用户数据加载成功:', data)
        return data
      } catch (error) {
        console.error('加载用户数据失败:', error)
        // 返回空数据而不是抛出错误，避免页面崩溃
        return { items: [], total: 0, page: 1, size: 1000 }
      }
    },
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const users = Array.isArray(usersQuery.data?.items) ? usersQuery.data.items : []

  // 当部门变化时，清空用户选择
  useEffect(() => {
    setSelectedUserId(undefined)
  }, [selectedDepartmentId])

  // 获取当前标签页的票据数据
  // 注意：对于非超级管理员，后端会根据当前登录用户自动过滤公司，所以即使不传companyId也可以
  const receiptsQuery = useQuery<Receipt[]>({
    queryKey: ['receipts', activeTab, filters, selectedUserId, selectedDepartmentId, effectiveCompanyId],
    queryFn: () =>
      fetchReceipts({
        userId: selectedUserId,
        receiptType: activeTab === 'matched' ? undefined : activeTab, // activeTab 不会是 'matched'，因为 enabled 已经过滤了
        startDate: filters.startDate,
        endDate: filters.endDate,
        vehicleNo: filters.vehicleNo,
        tankerVehicleCode: filters.tankerVehicleCode,
        companyId: effectiveCompanyId, // 超级管理员需要传，非超级管理员可以不传（后端会自动过滤）
        departmentId: selectedDepartmentId, // 部门筛选
        deletedStatus: filters.deletedStatus, // 删除状态筛选
        submittedStatus: filters.submittedStatus, // 交票状态筛选
      }),
    enabled: (isSuperAdmin ? !!effectiveCompanyId : true) && activeTab !== 'matched', // 匹配数据使用单独的查询
  })

  // 获取已匹配的装卸数据（仅挂车模式）
  const matchedReceiptsQuery = useQuery({
    queryKey: ['matched-receipts', filters, selectedUserId, effectiveCompanyId],
    queryFn: () =>
      fetchMatchedReceipts({
        userId: selectedUserId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
      }),
    enabled: activeTab === 'matched' && (isSuperAdmin ? !!effectiveCompanyId : true),
  })

  const receipts = receiptsQuery.data || []
  const matchedReceipts = matchedReceiptsQuery.data || []

  // 根据方量筛选条件过滤表格数据
  const filteredReceipts = useMemo(() => {
    // 只对出厂单应用方量筛选
    if (activeTab !== 'departure' || !filters.volumeFilter || filters.volumeFilter === 'all') {
      return receipts
    }

    return receipts.filter((r: any) => {
      if (r.type !== 'departure') return true
      
      const volume = parseFloat(r.concrete_volume || 0)
      
      if (filters.volumeFilter === 'small') {
        return volume > 0 && volume < 9.1
      } else if (filters.volumeFilter === 'normal') {
        return volume >= 9.1
      }
      
      return true
    })
  }, [receipts, activeTab, filters.volumeFilter])

  // 计算当前表格显示数据的KPI统计（仅针对出厂单）
  const kpiStats = useMemo(() => {
    // 只对出厂单进行统计
    if (activeTab !== 'departure') {
      return null
    }

    // 使用filteredReceipts，确保KPI统计和表格数据一致
    const departureReceipts = filteredReceipts.filter((r: any) => r.type === 'departure')
    
    let totalVolume = 0 // 总方量
    let totalCount = departureReceipts.length // 总单据数量
    let smallVolumeCount = 0 // 小方量单据数量（<9.1）
    let submittedCount = 0 // 已交票数量

    departureReceipts.forEach((receipt: any) => {
      const volume = parseFloat(receipt.concrete_volume || 0)
      totalVolume += volume
      
      // 统计小方量单据（本车方量小于9.1）
      if (volume > 0 && volume < 9.1) {
        smallVolumeCount++
      }
      
      // 统计已交票数量
      if (receipt.submitted_to_finance === 'Y') {
        submittedCount++
      }
    })

    return {
      totalVolume: totalVolume.toFixed(2),
      totalCount,
      smallVolumeCount,
      submittedCount,
      notSubmittedCount: totalCount - submittedCount,
    }
  }, [activeTab, filteredReceipts])

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
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 更新装料单
  const updateLoadingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateLoadingReceipt(id, data),
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

  // 删除装料单
  const deleteLoadingMutation = useMutation({
    mutationFn: (id: number) => deleteLoadingReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 更新卸货单
  const updateUnloadingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUnloadingReceipt(id, data),
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

  // 删除卸货单
  const deleteUnloadingMutation = useMutation({
    mutationFn: (id: number) => deleteUnloadingReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 删除充电单
  const deleteChargingMutation = useMutation({
    mutationFn: (id: number) => deleteChargingReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 更新出厂单
  const updateDepartureMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateDepartureReceipt(id, data),
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

  // 删除出厂单
  const deleteDepartureMutation = useMutation({
    mutationFn: (id: number) => deleteDepartureReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      setSelectedRowKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 删除运输任务（装卸匹配）
  const deleteTransportTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTransportTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matched-receipts'] })
      message.success('删除成功')
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  // 统计数据移除

  const handleSearch = (values: {
    receiptType?: ReceiptType
    dateRange?: Dayjs[]
    vehicleNo?: string
    tankerVehicleCode?: string
    deletedStatus?: 'all' | 'normal' | 'deleted'
    submittedStatus?: 'all' | 'submitted' | 'not_submitted'
    volumeFilter?: 'all' | 'small' | 'normal'
  }) => {
    setFilters({
      receiptType: values.receiptType,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      vehicleNo: values.vehicleNo,
      tankerVehicleCode: values.tankerVehicleCode,
      deletedStatus: values.deletedStatus || 'normal',
      submittedStatus: values.submittedStatus || 'all',
      volumeFilter: values.volumeFilter || 'all',
    })
  }

  const handleReset = () => {
    setFilters({ deletedStatus: 'normal', submittedStatus: 'all', volumeFilter: 'all' })
    searchForm.resetFields()
    searchForm.setFieldValue('deletedStatus', 'normal')
    searchForm.setFieldValue('submittedStatus', 'all')
    searchForm.setFieldValue('volumeFilter', 'all')
  }

  const openDetail = useCallback((receipt: Receipt) => {
    setSelectedReceipt(receipt)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedReceipt(null)
  }

  // 单个删除
  const handleDelete = useCallback((receipt: Receipt) => {
    if (!canEditDelete) {
      message.warning('司机无权限删除票据')
      return
    }
    modal.confirm({
      title: '确认删除',
      content: `确定要删除该${RECEIPT_TYPES.find(t => t.value === receipt.type)?.label || '票据'}吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (receipt.type === 'loading') {
            await deleteLoadingMutation.mutateAsync(receipt.id)
            message.success('删除成功')
          } else if (receipt.type === 'unloading') {
            await deleteUnloadingMutation.mutateAsync(receipt.id)
            message.success('删除成功')
          } else if (receipt.type === 'charging') {
            await deleteChargingMutation.mutateAsync(receipt.id)
            message.success('删除成功')
          } else if (receipt.type === 'water') {
            await deleteWaterMutation.mutateAsync(receipt.id)
            message.success('删除成功')
          } else if (receipt.type === 'departure') {
            await deleteDepartureMutation.mutateAsync(receipt.id)
            message.success('删除成功')
          }
        } catch (error) {
          // Error is handled by mutation
        }
      },
    })
  }, [modal, deleteLoadingMutation, deleteUnloadingMutation, deleteChargingMutation, deleteWaterMutation, deleteDepartureMutation, canEditDelete, message])

  // 编辑装卸匹配
  const handleEditMatched = useCallback((record: any) => {
    console.log('handleEditMatched 被调用', record)
    
    // 设置初始值
    matchedEditForm.setFieldsValue({
      // 装料单字段
      load_company: record.loadBill?.company,
      load_material_name: record.loadBill?.material_name,
      load_material_spec: record.loadBill?.material_spec,
      load_gross_weight: record.loadBill?.gross_weight,
      load_net_weight: record.loadBill?.net_weight,
      load_tare_weight: record.loadBill?.tare_weight,
      // 卸货单字段
      unload_company: record.unloadBill?.company,
      unload_material_name: record.unloadBill?.material_name,
      unload_material_spec: record.unloadBill?.material_spec,
      unload_gross_weight: record.unloadBill?.gross_weight,
      unload_net_weight: record.unloadBill?.net_weight,
      unload_tare_weight: record.unloadBill?.tare_weight,
    })
    
    setEditingMatched(record)
    setMatchedEditModalOpen(true)
  }, [matchedEditForm])
  
  // 保存装卸匹配编辑
  const handleSaveMatchedEdit = useCallback(async () => {
    if (!editingMatched) return
    
    try {
      const values = await matchedEditForm.validateFields()
      
      // 准备更新装料单的数据
      const loadUpdateData: any = {}
      if (values.load_company !== undefined) loadUpdateData.company = values.load_company
      if (values.load_material_name !== undefined) loadUpdateData.material_name = values.load_material_name
      if (values.load_material_spec !== undefined) loadUpdateData.material_spec = values.load_material_spec
      if (values.load_gross_weight !== undefined) loadUpdateData.gross_weight = values.load_gross_weight
      if (values.load_net_weight !== undefined) loadUpdateData.net_weight = values.load_net_weight
      if (values.load_tare_weight !== undefined) loadUpdateData.tare_weight = values.load_tare_weight
      
      // 准备更新卸货单的数据
      const unloadUpdateData: any = {}
      if (values.unload_company !== undefined) unloadUpdateData.company = values.unload_company
      if (values.unload_material_name !== undefined) unloadUpdateData.material_name = values.unload_material_name
      if (values.unload_material_spec !== undefined) unloadUpdateData.material_spec = values.unload_material_spec
      if (values.unload_gross_weight !== undefined) unloadUpdateData.gross_weight = values.unload_gross_weight
      if (values.unload_net_weight !== undefined) unloadUpdateData.net_weight = values.unload_net_weight
      if (values.unload_tare_weight !== undefined) unloadUpdateData.tare_weight = values.unload_tare_weight
      
      // 同时更新装料单和卸货单
      await Promise.all([
        editingMatched.loadBill?.id && Object.keys(loadUpdateData).length > 0
          ? updateLoadingReceipt(editingMatched.loadBill.id, loadUpdateData)
          : Promise.resolve(),
        editingMatched.unloadBill?.id && Object.keys(unloadUpdateData).length > 0
          ? updateUnloadingReceipt(editingMatched.unloadBill.id, unloadUpdateData)
          : Promise.resolve(),
      ])
      
      message.success('装卸匹配数据已更新')
      setMatchedEditModalOpen(false)
      setEditingMatched(null)
      matchedEditForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['matched-receipts'] })
    } catch (error) {
      console.error('更新失败:', error)
      message.error('更新失败，请重试')
    }
  }, [editingMatched, matchedEditForm, message, queryClient])

  // 删除装卸匹配
  const handleDeleteMatched = useCallback((record: any) => {
    // 临时：直接显示删除对话框，不检查权限（用于调试）
    console.log('用户信息:', {
      role: user?.role,
      positionType: user?.positionType,
      user: user
    })
    
    modal.confirm({
      title: '确认删除装卸匹配',
      content: (
        <div>
          <p>确定要删除任务 <strong>{record.task_id}</strong> 的装卸匹配吗？</p>
          <Alert
            message="重要提示"
            description="此操作将同时软删除关联的装料单和卸货单，但数据可在回收站恢复。"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      width: 500,
      onOk: async () => {
        try {
          await deleteTransportTaskMutation.mutateAsync(record.task_id)
        } catch (error) {
          // Error is handled by mutation
        }
      },
    })
  }, [modal, deleteTransportTaskMutation, user, message])

  // 交票功能
  const handleSubmitToFinance = useCallback(async (receipt: Receipt) => {
    try {
      await submitReceiptToFinance(receipt.type, receipt.id)
      message.success('交票成功')
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    } catch (error: any) {
      message.error(error.message || '交票失败')
    }
  }, [message, queryClient])

  // 批量交票
  const handleBatchSubmitToFinance = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要交票的票据')
      return
    }
    
    modal.confirm({
      title: '确认批量交票',
      content: `确定要将选中的 ${selectedRowKeys.length} 张票据交票吗？`,
      onOk: async () => {
        try {
          const receiptIds = selectedRowKeys.map(key => Number(key))
          await submitReceiptsToFinance(activeTab as string, receiptIds)
          message.success('批量交票成功')
          setSelectedRowKeys([])
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
        } catch (error: any) {
          message.error(error.message || '批量交票失败')
        }
      },
    })
  }, [selectedRowKeys, activeTab, modal, message, queryClient])

  // 恢复票据
  const handleRestore = useCallback(async (receipt: Receipt) => {
    const receiptTypeName = RECEIPT_TYPES.find(t => t.value === receipt.type)?.label || '票据'
    modal.confirm({
      title: '确认恢复',
      content: `确定要恢复这张${receiptTypeName}吗？恢复后将重新显示在列表中。`,
      onOk: async () => {
        try {
          await restoreReceipt(receipt.type, receipt.id)
          message.success('恢复成功')
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
        } catch (error: any) {
          message.error(error.message || '恢复失败')
        }
      },
    })
  }, [modal, message, queryClient])

  // 打开编辑
  const openEdit = useCallback((receipt: Receipt) => {
    if (!canEditDelete) {
      message.warning('司机无权限编辑票据')
      return
    }
    setEditingReceipt(receipt)
    setEditDrawerOpen(true)

    if (receipt.type === 'loading') {
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
      editForm.setFieldsValue({
        company: r.company,
        driver_name: r.driver_name,
        vehicle_no: r.vehicle_no,
        material_name: r.material_name,
        material_spec: r.material_spec,
        gross_weight: r.gross_weight,
        net_weight: r.net_weight,
        tare_weight: r.tare_weight,
        loading_time: r.loading_time ? dayjs(r.loading_time) : undefined,
        unloading_time: r.unloading_time ? dayjs(r.unloading_time) : undefined,
      })
    } else if (receipt.type === 'unloading') {
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
      editForm.setFieldsValue({
        company: r.company,
        driver_name: r.driver_name,
        vehicle_no: r.vehicle_no,
        material_name: r.material_name,
        material_spec: r.material_spec,
        gross_weight: r.gross_weight,
        net_weight: r.net_weight,
        tare_weight: r.tare_weight,
        loading_time: r.loading_time ? dayjs(r.loading_time) : undefined,
        unloading_time: r.unloading_time ? dayjs(r.unloading_time) : undefined,
      })
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
    } else if (receipt.type === 'departure') {
      const r = receipt as any
      editForm.setFieldsValue({
        driver_name: r.driver_name,
        vehicle_no: r.vehicle_no,
        tanker_vehicle_code: r.tanker_vehicle_code,
        loading_company: r.loading_company,
        project_name: r.project_name,
        construction_location: r.construction_location,
        customer_name: r.customer_name,
        construction_unit: r.construction_unit,
        concrete_strength: r.concrete_strength,
        slump: r.slump,
        concrete_volume: r.concrete_volume,
        settlement_volume: r.settlement_volume,
        total_volume: r.total_volume,
        total_vehicles: r.total_vehicles,
        bill_no: r.bill_no,
        loading_time: r.loading_time ? dayjs(r.loading_time) : undefined,
        exit_time: r.exit_time ? dayjs(r.exit_time) : undefined,
        production_date: r.production_date ? dayjs(r.production_date) : undefined,
      })
    }
  }, [editForm, canEditDelete, message])

  // 通用操作列渲染
  const renderActions = useCallback((record: Receipt) => (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} block>
        查看
      </Button>
      {canEditDelete && !record.deleted_at && (
        <>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} block>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            block
          >
            删除
          </Button>
        </>
      )}
      {record.deleted_at && canEditDelete && (
        <Button
          type="link"
          size="small"
          onClick={() => handleRestore(record)}
          block
        >
          恢复
        </Button>
      )}
      {record.submitted_to_finance !== 'Y' && !record.deleted_at && record.type !== 'charging' && (
        <Button
          type="link"
          size="small"
          icon={<DollarOutlined />}
          onClick={() => handleSubmitToFinance(record)}
          block
        >
          交票
        </Button>
      )}
    </Space>
  ), [openDetail, openEdit, handleDelete, canEditDelete, handleSubmitToFinance, handleRestore])

  // 装料单列定义
  const loadingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '公司',
        dataIndex: 'company',
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).company).filter(Boolean))).map(company => ({
          text: company as string,
          value: company as string,
        })),
        onFilter: (value, record) => (record as any).company === value,
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => r.driver_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => record.driver_name === value,
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => r.vehicle_no).filter(Boolean))).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => record.vehicle_no === value,
      },
      ...(businessType === '罐车'
        ? [
            {
              title: '自编车号',
              dataIndex: 'tanker_vehicle_code',
              width: 120,
              filters: Array.from(new Set(receipts?.map(r => r.tanker_vehicle_code).filter(Boolean))).map(code => ({
                text: code as string,
                value: code as string,
              })),
              onFilter: (value: any, record: Receipt) => record.tanker_vehicle_code === value,
              render: (value: string) => value || '-',
            },
          ]
        : []),
      {
        title: '材料名称',
        dataIndex: 'material_name',
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).material_name).filter(Boolean))).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => (record as any).material_name === value,
      },
      {
        title: '规格型号',
        dataIndex: 'material_spec',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => (r as any).material_spec).filter(Boolean))).map(spec => ({
          text: spec as string,
          value: spec as string,
        })),
        onFilter: (value, record) => (record as any).material_spec === value,
      },
      {
        title: '毛重(t)',
        dataIndex: 'gross_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '净重(t)',
        dataIndex: 'net_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '皮重(t)',
        dataIndex: 'tare_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '进厂时间',
        dataIndex: 'loading_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '出厂时间',
        dataIndex: 'unloading_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '任务ID',
        dataIndex: 'task_id',
        width: 200,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (deleted_at: string | null, record: Receipt) => {
          if (deleted_at) {
            return (
              <Tag color="red">
                已删除
                <br />
                <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
                {record.deleted_by_name && (
                  <>
                    <br />
                    <small>删除人：{record.deleted_by_name}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '交票状态',
        dataIndex: 'submitted_to_finance',
        width: 120,
        render: (submitted: string, record: Receipt) => {
          if (submitted === 'Y') {
            return (
              <Tag color="blue">
                已交票
                {record.submitted_at && (
                  <>
                    <br />
                    <small>{dayjs(record.submitted_at).format('YYYY-MM-DD HH:mm')}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="default">未交票</Tag>
        },
      },
      {
        title: '装料单图片',
        dataIndex: 'thumb_url',
        key: 'thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAMT8BhpYAAAGdaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA1LjQuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE5NDwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xOTU8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4K"
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [businessType, renderActions],
  )

  // 卸货单列定义
  const unloadingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '公司',
        dataIndex: 'company',
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).company).filter(Boolean))).map(company => ({
          text: company as string,
          value: company as string,
        })),
        onFilter: (value, record) => (record as any).company === value,
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => r.driver_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => record.driver_name === value,
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => r.vehicle_no).filter(Boolean))).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => record.vehicle_no === value,
      },
      ...(businessType === '罐车'
        ? [
            {
              title: '自编车号',
              dataIndex: 'tanker_vehicle_code',
              width: 120,
              filters: Array.from(new Set(receipts?.map(r => r.tanker_vehicle_code).filter(Boolean))).map(code => ({
                text: code as string,
                value: code as string,
              })),
              onFilter: (value: any, record: Receipt) => record.tanker_vehicle_code === value,
              render: (value: string) => value || '-',
            },
          ]
        : []),
      {
        title: '材料名称',
        dataIndex: 'material_name',
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).material_name).filter(Boolean))).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => (record as any).material_name === value,
      },
      {
        title: '规格型号',
        dataIndex: 'material_spec',
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => (r as any).material_spec).filter(Boolean))).map(spec => ({
          text: spec as string,
          value: spec as string,
        })),
        onFilter: (value, record) => (record as any).material_spec === value,
      },
      {
        title: '毛重(t)',
        dataIndex: 'gross_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '净重(t)',
        dataIndex: 'net_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '皮重(t)',
        dataIndex: 'tare_weight',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '进厂时间',
        dataIndex: 'loading_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '出厂时间',
        dataIndex: 'unloading_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '任务ID',
        dataIndex: 'task_id',
        width: 200,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (deleted_at: string | null, record: Receipt) => {
          if (deleted_at) {
            return (
              <Tag color="red">
                已删除
                <br />
                <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
                {record.deleted_by_name && (
                  <>
                    <br />
                    <small>删除人：{record.deleted_by_name}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '交票状态',
        dataIndex: 'submitted_to_finance',
        width: 120,
        render: (submitted: string, record: Receipt) => {
          if (submitted === 'Y') {
            return (
              <Tag color="blue">
                已交票
                {record.submitted_at && (
                  <>
                    <br />
                    <small>{dayjs(record.submitted_at).format('YYYY-MM-DD HH:mm')}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="default">未交票</Tag>
        },
      },
      {
        title: '卸货单图片',
        dataIndex: 'thumb_url',
        key: 'thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAMT8BhpYAAAGdaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA1LjQuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE5NDwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xOTU8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4K"
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [businessType, renderActions],
  )

  // 充电单列定义
  const chargingColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '单据编号',
        dataIndex: 'receipt_number',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 100,
        filters: Array.from(new Set(receipts?.map(r => r.driver_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => record.driver_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 100,
        filters: Array.from(new Set(receipts?.map(r => r.vehicle_no).filter(Boolean))).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => record.vehicle_no === value,
      },
      ...(businessType === '罐车'
        ? [
            {
              title: '自编车号',
              dataIndex: 'tanker_vehicle_code',
              width: 100,
              filters: Array.from(new Set(receipts?.map(r => r.tanker_vehicle_code).filter(Boolean))).map(code => ({
                text: code as string,
                value: code as string,
              })),
              onFilter: (value: any, record: Receipt) => record.tanker_vehicle_code === value,
              render: (value: string) => value || '-',
            },
          ]
        : []),
      {
        title: '充电站',
        dataIndex: 'charging_station',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '充电桩',
        dataIndex: 'charging_pile',
        width: 100,
        render: (value: string) => value || '-',
      },
      {
        title: '电量(kWh)',
        dataIndex: 'energy_kwh',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '金额(元)',
        dataIndex: 'amount',
        width: 100,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '开始时间',
        dataIndex: 'start_time',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '时长(分钟)',
        dataIndex: 'duration_min',
        width: 100,
        render: (value: number) => (value ? `${value}分钟` : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (deleted_at: string | null, record: Receipt) => {
          if (deleted_at) {
            return (
              <Tag color="red">
                已删除
                <br />
                <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
                {record.deleted_by_name && (
                  <>
                    <br />
                    <small>删除人：{record.deleted_by_name}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '充电单图片',
        dataIndex: 'thumb_url',
        key: 'thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [businessType, renderActions],
  )

  // 水票列定义
  const waterColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '业务单号',
        dataIndex: 'f_water_ticket_id',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 100,
        filters: Array.from(new Set(receipts?.map(r => r.driver_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => record.driver_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '公司',
        dataIndex: 'company_name',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 100,
        filters: Array.from(new Set(receipts?.map(r => r.vehicle_no).filter(Boolean))).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => record.vehicle_no === value,
      },
      ...(businessType === '罐车'
        ? [
            {
              title: '自编车号',
              dataIndex: 'tanker_vehicle_code',
              width: 100,
              filters: Array.from(new Set(receipts?.map(r => r.tanker_vehicle_code).filter(Boolean))).map(code => ({
                text: code as string,
                value: code as string,
              })),
              onFilter: (value: any, record: Receipt) => record.tanker_vehicle_code === value,
              render: (value: string) => value || '-',
            },
          ]
        : []),
      {
        title: '日期',
        dataIndex: 'ticket_date',
        width: 120,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (deleted_at: string | null, record: Receipt) => {
          if (deleted_at) {
            return (
              <Tag color="red">
                已删除
                <br />
                <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
                {record.deleted_by_name && (
                  <>
                    <br />
                    <small>删除人：{record.deleted_by_name}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '交票状态',
        dataIndex: 'submitted_to_finance',
        width: 120,
        render: (submitted: string, record: Receipt) => {
          if (submitted === 'Y') {
            return (
              <Tag color="blue">
                已交票
                {record.submitted_at && (
                  <>
                    <br />
                    <small>{dayjs(record.submitted_at).format('YYYY-MM-DD HH:mm')}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="default">未交票</Tag>
        },
      },
      {
        title: '水票图片',
        dataIndex: 'thumb_url',
        width: 100,
        render: (value: string, record: any) => {
          const imageUrl = value || record.image_path
          if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={imageUrl}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={{ mask: '查看' }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [businessType, renderActions],
  )

  // 装卸匹配列定义
  const matchedColumns: ColumnsType<any> = useMemo(
    () => [
      {
        title: '任务ID',
        dataIndex: 'task_id',
        width: 200,
      },
      {
        title: '车牌号',
        dataIndex: ['loadBill', 'vehicle_no'],
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => (r as any).loadBill?.vehicle_no || (r as any).unloadBill?.vehicle_no).filter(Boolean))).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => (record.loadBill?.vehicle_no === value || record.unloadBill?.vehicle_no === value),
        render: (_, record) => record.loadBill?.vehicle_no || record.unloadBill?.vehicle_no || '-',
      },
      {
        title: '司机',
        dataIndex: ['loadBill', 'driver_name'],
        width: 120,
        filters: Array.from(new Set(receipts?.map(r => (r as any).loadBill?.driver_name || (r as any).unloadBill?.driver_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => (record.loadBill?.driver_name === value || record.unloadBill?.driver_name === value),
        render: (_, record) => record.loadBill?.driver_name || record.unloadBill?.driver_name || '-',
      },
      {
        title: '装料公司',
        dataIndex: ['loadBill', 'company'],
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).loadBill?.company).filter(Boolean))).map(company => ({
          text: company as string,
          value: company as string,
        })),
        onFilter: (value, record) => record.loadBill?.company === value,
        render: (value: string) => value || '-',
      },
      {
        title: '卸货公司',
        dataIndex: ['unloadBill', 'company'],
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).unloadBill?.company).filter(Boolean))).map(company => ({
          text: company as string,
          value: company as string,
        })),
        onFilter: (value, record) => record.unloadBill?.company === value,
        render: (value: string) => value || '-',
      },
      {
        title: '装料材料',
        dataIndex: ['loadBill', 'material_name'],
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).loadBill?.material_name).filter(Boolean))).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => record.loadBill?.material_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '装料规格',
        dataIndex: ['loadBill', 'material_spec'],
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '卸货材料',
        dataIndex: ['unloadBill', 'material_name'],
        width: 150,
        filters: Array.from(new Set(receipts?.map(r => (r as any).unloadBill?.material_name).filter(Boolean))).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => record.unloadBill?.material_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '卸货规格',
        dataIndex: ['unloadBill', 'material_spec'],
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '装料毛重(t)',
        dataIndex: ['loadBill', 'gross_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '装料净重(t)',
        dataIndex: ['loadBill', 'net_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '装料皮重(t)',
        dataIndex: ['loadBill', 'tare_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '卸货毛重(t)',
        dataIndex: ['unloadBill', 'gross_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '卸货净重(t)',
        dataIndex: ['unloadBill', 'net_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '卸货皮重(t)',
        dataIndex: ['unloadBill', 'tare_weight'],
        width: 120,
        render: (value: any) => (value != null && value !== '' ? Number(value).toFixed(2) : '-'),
      },
      {
        title: '磅差(t)',
        width: 100,
        render: (_: any, record: any) => {
          const loadNet = record.loadBill?.net_weight || 0
          const unloadNet = record.unloadBill?.net_weight || 0
          const diff = loadNet - unloadNet
          return diff !== 0 ? diff.toFixed(2) : '-'
        },
      },
      {
        title: '装料进厂时间',
        dataIndex: ['loadBill', 'loading_time'],
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '装料出厂时间',
        dataIndex: ['loadBill', 'unloading_time'],
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '卸货进厂时间',
        dataIndex: ['unloadBill', 'loading_time'],
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '卸货出厂时间',
        dataIndex: ['unloadBill', 'unloading_time'],
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (_: string | null, record: any) => {
          // 检查装料单或卸货单是否被删除
          const loadDeleted = record.loadBill?.deleted_at
          const unloadDeleted = record.unloadBill?.deleted_at
          
          if (loadDeleted || unloadDeleted) {
            return (
              <div>
                {loadDeleted && (
                  <Tag color="red" style={{ marginBottom: 4 }}>
                    装料单已删除
                    <br />
                    <small>{dayjs(loadDeleted).format('YYYY-MM-DD HH:mm')}</small>
                    {record.loadBill?.deleted_by_name && (
                      <>
                        <br />
                        <small>删除人：{record.loadBill.deleted_by_name}</small>
                      </>
                    )}
                  </Tag>
                )}
                {unloadDeleted && (
                  <Tag color="red" style={{ marginTop: loadDeleted ? 4 : 0 }}>
                    卸货单已删除
                    <br />
                    <small>{dayjs(unloadDeleted).format('YYYY-MM-DD HH:mm')}</small>
                    {record.unloadBill?.deleted_by_name && (
                      <>
                        <br />
                        <small>删除人：{record.unloadBill.deleted_by_name}</small>
                      </>
                    )}
                  </Tag>
                )}
              </div>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '装料单图片',
        dataIndex: ['loadBill', 'thumb_url'],
        key: 'loadBill_thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '卸货单图片',
        dataIndex: ['unloadBill', 'thumb_url'],
        key: 'unloadBill_thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 120,
        fixed: 'right',
        render: (_, record) => {
          // 临时：始终显示删除按钮（用于调试）
          return (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  // 显示完整的匹配数据（包含装料单和卸货单）
                  setSelectedReceipt(record as any)
                  setDetailDrawerOpen(true)
                }}
                style={{ padding: 0, height: 'auto' }}
              >
                查看
              </Button>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditMatched(record)}
                style={{ padding: 0, height: 'auto' }}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteMatched(record)}
                style={{ padding: 0, height: 'auto' }}
              >
                删除
              </Button>
            </Space>
          )
        },
      },
    ],
    [isSuperAdmin, user],
  )

  // 出厂单列定义（罐车业务）
  const departureColumns: ColumnsType<Receipt> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '单据编号',
        dataIndex: 'f_departure_receipt_id',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        width: 100,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => r.driver_name).filter(Boolean))) : [])
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({
            text: name as string,
            value: name as string,
          })),
        onFilter: (value, record) => record.driver_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        width: 100,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => r.vehicle_no).filter(Boolean))) : []).map(no => ({
          text: no as string,
          value: no as string,
        })),
        onFilter: (value, record) => record.vehicle_no === value,
        render: (value: string) => value || '-',
      },
      {
        title: '自编车号',
        dataIndex: 'tanker_vehicle_code',
        width: 100,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => r.tanker_vehicle_code).filter(Boolean))) : []).map(code => ({
          text: code as string,
          value: code as string,
        })),
        onFilter: (value, record) => record.tanker_vehicle_code === value,
        render: (value: string) => value || '-',
      },
      {
        title: '装料公司',
        dataIndex: 'loading_company',
        width: 150,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => (r as any).loading_company).filter(Boolean))) : []).map(company => ({
          text: company as string,
          value: company as string,
        })),
        onFilter: (value, record) => (record as any).loading_company === value,
        render: (value: string) => value || '-',
      },
      {
        title: '工程名称',
        dataIndex: 'project_name',
        width: 150,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => (r as any).project_name).filter(Boolean))) : []).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => (record as any).project_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '施工地点',
        dataIndex: 'construction_location',
        width: 150,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => (r as any).construction_location).filter(Boolean))) : []).map(location => ({
          text: location as string,
          value: location as string,
        })),
        onFilter: (value, record) => (record as any).construction_location === value,
        render: (value: string) => value || '-',
      },
      {
        title: '客户名称',
        dataIndex: 'customer_name',
        width: 150,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => (r as any).customer_name).filter(Boolean))) : []).map(name => ({
          text: name as string,
          value: name as string,
        })),
        onFilter: (value, record) => (record as any).customer_name === value,
        render: (value: string) => value || '-',
      },
      {
        title: '施工单位',
        dataIndex: 'construction_unit',
        width: 150,
        filters: (Array.isArray(receipts) ? Array.from(new Set(receipts.map(r => (r as any).construction_unit).filter(Boolean))) : []).map(unit => ({
          text: unit as string,
          value: unit as string,
        })),
        onFilter: (value, record) => (record as any).construction_unit === value,
        render: (value: string) => value || '-',
      },
      {
        title: '强度等级',
        dataIndex: 'concrete_strength',
        width: 100,
        render: (value: string) => value || '-',
      },
      {
        title: '坍落度',
        dataIndex: 'slump',
        width: 80,
        render: (value: string) => value || '-',
      },
      {
        title: '方量',
        dataIndex: 'concrete_volume',
        width: 80,
        render: (value: string) => value || '-',
      },
      {
        title: '结算方量',
        dataIndex: 'settlement_volume',
        width: 100,
        render: (value: any, record: any) => {
          // 处理可能是数字或字符串的情况
          if (value !== null && value !== undefined && value !== '') {
            return typeof value === 'number' ? value : value
          }
          return record.concrete_volume || '-'
        },
      },
      {
        title: '累计方量',
        dataIndex: 'total_volume',
        width: 100,
        render: (value: string) => value || '-',
      },
      {
        title: '累计车次',
        dataIndex: 'total_vehicles',
        width: 100,
        render: (value: string) => value || '-',
      },
      {
        title: '提单号',
        dataIndex: 'bill_no',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '进厂时间',
        dataIndex: 'loading_time',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '出厂时间',
        dataIndex: 'exit_time',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '生产日期',
        dataIndex: 'production_date',
        width: 120,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 150,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '删除状态',
        dataIndex: 'deleted_at',
        width: 150,
        render: (deleted_at: string | null, record: Receipt) => {
          if (deleted_at) {
            return (
              <Tag color="red">
                已删除
                <br />
                <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
                {record.deleted_by_name && (
                  <>
                    <br />
                    <small>删除人：{record.deleted_by_name}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="green">正常</Tag>
        },
      },
      {
        title: '交票状态',
        dataIndex: 'submitted_to_finance',
        width: 120,
        render: (submitted: string, record: Receipt) => {
          if (submitted === 'Y') {
            return (
              <Tag color="blue">
                已交票
                {record.submitted_at && (
                  <>
                    <br />
                    <small>{dayjs(record.submitted_at).format('YYYY-MM-DD HH:mm')}</small>
                  </>
                )}
              </Tag>
            )
          }
          return <Tag color="default">未交票</Tag>
        },
      },
      {
        title: '出厂单图片',
        dataIndex: 'thumb_url',
        width: 100,
        render: (value: string, record: any) => {
          const imageUrl = value || record.image_path
          if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={imageUrl}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={{ mask: '查看' }}
            />
          )
        },
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [receipts, renderActions],
  )

  // 列配置状态
  const [columnConfig, setColumnConfig] = useState<import('../components/ColumnSettings').ColumnConfig[]>([])

  // 获取当前 Tab 的原始列定义
  const getCurrentColumns = useCallback((type: ReceiptType | 'matched'): ColumnsType<Receipt | any> => {
    switch (type) {
      case 'loading':
        return loadingColumns
      case 'unloading':
        return unloadingColumns
      case 'charging':
        return chargingColumns
      case 'water':
        return waterColumns
      case 'departure':
        return departureColumns
      case 'matched':
        return matchedColumns as ColumnsType<Receipt>
      default:
        return loadingColumns
    }
  }, [loadingColumns, unloadingColumns, chargingColumns, waterColumns, departureColumns, matchedColumns])

  // 生成列配置（用于 ColumnSettings 组件）
  const columnSettingsConfig = useMemo(() => {
    const cols = getCurrentColumns(activeTab)
    return cols.map((col) => ({
      key: String((col as any).dataIndex || (col as any).key || col.title || ''),
      title: String(col.title || ''),
      visible: true,
      fixed: col.fixed,
    }))
  }, [activeTab, getCurrentColumns])

  // 列配置变更处理
  const handleColumnConfigChange = useCallback((config: import('../components/ColumnSettings').ColumnConfig[]) => {
    setColumnConfig(config)
  }, [])

  // 应用列配置后的列
  const getColumns = useCallback((type: ReceiptType | 'matched'): ColumnsType<Receipt | any> => {
    const originalColumns = getCurrentColumns(type)
    if (!columnConfig.length) return originalColumns

    // 按配置顺序排序，并过滤不可见的列
    const orderedColumns: ColumnsType<Receipt | any> = []
    
    for (const cfg of columnConfig) {
      if (!cfg.visible) continue
      const col = originalColumns.find((c) => {
        const key = String((c as any).dataIndex || (c as any).key || c.title || '')
        return key === cfg.key
      })
      if (col) {
        orderedColumns.push(col)
      }
    }

    // 添加配置中没有的新列
    for (const col of originalColumns) {
      const key = String((col as any).dataIndex || (col as any).key || col.title || '')
      if (!columnConfig.find((c) => c.key === key)) {
        orderedColumns.push(col)
      }
    }

    return orderedColumns
  }, [getCurrentColumns, columnConfig])

  const renderDetail = () => {
    if (!selectedReceipt) return null

    const receipt = selectedReceipt
    let imageUrl = (receipt as any).thumb_url || (receipt as any).image_path
    
    // 过滤掉无效的图片URL（如微信小程序的临时文件路径）
    if (imageUrl && (imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://') || imageUrl.includes('wxfile://'))) {
      imageUrl = undefined
    }
    
    // 调试信息
    if (import.meta.env.DEV) {
      console.log('Receipt detail imageUrl:', imageUrl)
      console.log('Receipt full data:', receipt)
      if ((receipt as any).loadBill) {
        console.log('LoadBill thumb_url:', (receipt as any).loadBill.thumb_url)
        console.log('LoadBill full data:', (receipt as any).loadBill)
      }
      if ((receipt as any).unloadBill) {
        console.log('UnloadBill thumb_url:', (receipt as any).unloadBill.thumb_url)
        console.log('UnloadBill full data:', (receipt as any).unloadBill)
      }
    }
    
    // 如果是装卸匹配数据，显示匹配信息
    const isMatchedData = (receipt as any).loadBill && (receipt as any).unloadBill

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {isMatchedData ? (
          <>
            <Card title="匹配信息" size="small">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="任务ID">{(receipt as any).task_id || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">{(receipt as any).status === 'finished' ? '已完成' : '进行中'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {(receipt as any).created_at ? dayjs((receipt as any).created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                {(receipt as any).finished_at && (
                  <Descriptions.Item label="完成时间">
                    {dayjs((receipt as any).finished_at).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            
            <Card title="装料单信息" size="small">
              <Descriptions column={1} bordered size="small">
                {(() => {
                  const thumbUrl = (receipt as any).loadBill?.thumb_url
                  const isValidUrl = thumbUrl && 
                    !thumbUrl.startsWith('wxfile://') && 
                    !thumbUrl.startsWith('file://') && 
                    !thumbUrl.includes('wxfile://') &&
                    thumbUrl.trim()
                  return isValidUrl ? (
                    <Descriptions.Item label="票据图片">
                      <Image 
                        src={thumbUrl} 
                        alt="装料单图片" 
                        style={{ maxWidth: '100%' }}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E"
                      />
                    </Descriptions.Item>
                  ) : null
                })()}
                <Descriptions.Item label="公司">{(receipt as any).loadBill.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{(receipt as any).loadBill.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{(receipt as any).loadBill.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="材料名称">{(receipt as any).loadBill.material_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{(receipt as any).loadBill.material_spec || '-'}</Descriptions.Item>
                <Descriptions.Item label="毛重(t)">
                  {((receipt as any).loadBill.gross_weight ? Number((receipt as any).loadBill.gross_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="净重(t)">
                  {((receipt as any).loadBill.net_weight ? Number((receipt as any).loadBill.net_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="皮重(t)">
                  {((receipt as any).loadBill.tare_weight ? Number((receipt as any).loadBill.tare_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="进厂时间">
                  {(receipt as any).loadBill.loading_time
                    ? dayjs((receipt as any).loadBill.loading_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {(receipt as any).loadBill.created_at
                    ? dayjs((receipt as any).loadBill.created_at).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            
            <Card title="卸货单信息" size="small">
              <Descriptions column={1} bordered size="small">
                {(() => {
                  const thumbUrl = (receipt as any).unloadBill?.thumb_url
                  const isValidUrl = thumbUrl && 
                    !thumbUrl.startsWith('wxfile://') && 
                    !thumbUrl.startsWith('file://') && 
                    !thumbUrl.includes('wxfile://') &&
                    thumbUrl.trim()
                  return isValidUrl ? (
                    <Descriptions.Item label="票据图片">
                      <Image 
                        src={thumbUrl} 
                        alt="卸货单图片" 
                        style={{ maxWidth: '100%' }}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E"
                      />
                    </Descriptions.Item>
                  ) : null
                })()}
                <Descriptions.Item label="公司">{(receipt as any).unloadBill.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机">{(receipt as any).unloadBill.driver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{(receipt as any).unloadBill.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="材料名称">{(receipt as any).unloadBill.material_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{(receipt as any).unloadBill.material_spec || '-'}</Descriptions.Item>
                <Descriptions.Item label="毛重(t)">
                  {((receipt as any).unloadBill.gross_weight ? Number((receipt as any).unloadBill.gross_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="净重(t)">
                  {((receipt as any).unloadBill.net_weight ? Number((receipt as any).unloadBill.net_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="皮重(t)">
                  {((receipt as any).unloadBill.tare_weight ? Number((receipt as any).unloadBill.tare_weight).toFixed(2) : '-')}
                </Descriptions.Item>
                <Descriptions.Item label="卸货时间">
                  {(receipt as any).unloadBill.unloading_time
                    ? dayjs((receipt as any).unloadBill.unloading_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {(receipt as any).unloadBill.created_at
                    ? dayjs((receipt as any).unloadBill.created_at).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        ) : (
          <>
            {imageUrl && imageUrl.trim() && (
              <Card title="票据图片" size="small">
                <Image 
                  src={imageUrl} 
                  alt="票据图片" 
                  style={{ maxWidth: '100%' }}
                  fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E"
                />
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
                    ? dayjs((receipt as Receipt & { loading_time?: string }).loading_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="出厂时间">
                  {(receipt as Receipt & { unloading_time?: string }).unloading_time
                    ? dayjs((receipt as Receipt & { unloading_time?: string }).unloading_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'unloading' && (
              <>
                <Descriptions.Item label="类型">卸货单</Descriptions.Item>
                {(() => {
                  const thumbUrl = receipt.thumb_url
                  const isValidUrl = thumbUrl && 
                    !thumbUrl.startsWith('wxfile://') && 
                    !thumbUrl.startsWith('file://') && 
                    !thumbUrl.includes('wxfile://') &&
                    thumbUrl.trim()
                  return isValidUrl ? (
                    <Descriptions.Item label="票据图片">
                      <Image 
                        src={thumbUrl} 
                        alt="卸货单图片" 
                        style={{ maxWidth: '100%' }}
                        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E"
                      />
                    </Descriptions.Item>
                  ) : null
                })()}
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
                <Descriptions.Item label="进厂时间">
                  {receipt.loading_time ? dayjs(receipt.loading_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="出厂时间">
                  {receipt.unloading_time ? dayjs(receipt.unloading_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="任务ID">{receipt.task_id || '-'}</Descriptions.Item>
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
                    ? dayjs((receipt as Receipt & { start_time?: string }).start_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="结束时间">
                  {(receipt as Receipt & { end_time?: string }).end_time
                    ? dayjs((receipt as Receipt & { end_time?: string }).end_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="时长(分钟)">
                  {(receipt as Receipt & { duration_min?: number }).duration_min || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'water' && (
              <>
                <Descriptions.Item label="类型">水票</Descriptions.Item>
                <Descriptions.Item label="业务单号">
                  {(receipt as any).f_water_ticket_id || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="司机">
                  {(receipt as any).driver_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="公司">
                  {(receipt as any).company_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="自编车号">
                  {(receipt as any).tanker_vehicle_code || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="日期">
                  {(receipt as any).ticket_date
                    ? dayjs((receipt as any).ticket_date).format('YYYY-MM-DD')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </>
            )}

            {receipt.type === 'departure' && (
              <>
                <Descriptions.Item label="类型">出厂单</Descriptions.Item>
                <Descriptions.Item label="单据编号">
                  {(receipt as any).f_departure_receipt_id || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="司机">
                  {(receipt as any).driver_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="车牌号">{receipt.vehicle_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="自编车号">
                  {(receipt as any).tanker_vehicle_code || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="装料公司">
                  {(receipt as any).loading_company || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="工程名称">
                  {(receipt as any).project_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="施工地点">
                  {(receipt as any).construction_location || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="客户名称">
                  {(receipt as any).customer_name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="施工单位">
                  {(receipt as any).construction_unit || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="强度等级">
                  {(receipt as any).concrete_strength || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="坍落度">
                  {(receipt as any).slump || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="方量">
                  {(receipt as any).concrete_volume || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="结算方量">
                  {(receipt as any).settlement_volume || (receipt as any).concrete_volume || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="累计方量">
                  {(receipt as any).total_volume || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="累计车次">
                  {(receipt as any).total_vehicles || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="提单号">
                  {(receipt as any).bill_no || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="进厂时间">
                  {(receipt as any).loading_time
                    ? dayjs((receipt as any).loading_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="出厂时间">
                  {(receipt as any).exit_time
                    ? dayjs((receipt as any).exit_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="生产日期">
                  {(receipt as any).production_date
                    ? dayjs((receipt as any).production_date).format('YYYY-MM-DD')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {receipt.created_at ? dayjs(receipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </>
            )}
            
            {/* 删除信息显示 */}
            {receipt.deleted_at && (
              <>
                <Descriptions.Item label="删除状态" span={3}>
                  <Tag color="red">已删除</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="删除时间" span={2}>
                  {dayjs(receipt.deleted_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="删除人">
                  {receipt.deleted_by_name || '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>
          </>
        )}
      </Space>
    )
  }

  // 导出功能
  const handleExport = useCallback(() => {
    const toNumber = (value: any) => {
      if (value === null || value === undefined || value === '') return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }

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
            毛重: toNumber(r.gross_weight),
            净重: toNumber(r.net_weight),
            皮重: toNumber(r.tare_weight),
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm:ss') : '',
            出厂时间: r.unloading_time ? dayjs(r.unloading_time).format('YYYY-MM-DD HH:mm:ss') : '',
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
            电量: toNumber(r.energy_kwh),
            金额: toNumber(r.amount),
            开始时间: r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm:ss') : '',
            结束时间: r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm:ss') : '',
            时长: toNumber(r.duration_min),
          }
        } else if (receipt.type === 'departure') {
          const r = receipt as Receipt & {
            f_departure_receipt_id?: string
            vehicle_no?: string
            tanker_vehicle_code?: string
            driver_name?: string
            loading_company?: string
            project_name?: string
            construction_location?: string
            customer_name?: string
            construction_unit?: string
            concrete_strength?: string
            slump?: string
            concrete_volume?: string
            settlement_volume?: number
            total_volume?: string
            total_vehicles?: string
            bill_no?: string
            loading_time?: string
            exit_time?: string
          }
          return {
            ...base,
            单据编号: r.f_departure_receipt_id || '',
            司机: r.driver_name || '',
            车牌号: r.vehicle_no || '',
            自编车号: r.tanker_vehicle_code || '',
            装料公司: r.loading_company || '',
            工程名称: r.project_name || '',
            施工地点: r.construction_location || '',
            客户名称: r.customer_name || '',
            施工单位: r.construction_unit || '',
            强度等级: r.concrete_strength || '',
            坑落度: r.slump || '',
            方量: toNumber(r.concrete_volume),
            结算方量: toNumber(r.settlement_volume),
            累计方量: toNumber(r.total_volume),
            累计车次: toNumber(r.total_vehicles),
            提单号: r.bill_no || '',
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm:ss') : '',
            出厂时间: r.exit_time ? dayjs(r.exit_time).format('YYYY-MM-DD HH:mm:ss') : '',
            交票状态: receipt.submitted_to_finance === 'Y' ? '已交票' : '未交票',
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
    const toNumber = (value: any) => {
      if (value === null || value === undefined || value === '') return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }

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
            毛重: toNumber(r.gross_weight),
            净重: toNumber(r.net_weight),
            皮重: toNumber(r.tare_weight),
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm:ss') : '',
            出厂时间: r.unloading_time ? dayjs(r.unloading_time).format('YYYY-MM-DD HH:mm:ss') : '',
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
            电量: toNumber(r.energy_kwh),
            金额: toNumber(r.amount),
            开始时间: r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
            结束时间: r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
            时长: toNumber(r.duration_min),
          }
        } else if (receipt.type === 'departure') {
          const r = receipt as Receipt & {
            f_departure_receipt_id?: string
            vehicle_no?: string
            tanker_vehicle_code?: string
            driver_name?: string
            loading_company?: string
            project_name?: string
            construction_location?: string
            customer_name?: string
            construction_unit?: string
            concrete_strength?: string
            slump?: string
            concrete_volume?: string
            settlement_volume?: number
            total_volume?: string
            total_vehicles?: string
            bill_no?: string
            loading_time?: string
            exit_time?: string
          }
          return {
            ...base,
            单据编号: r.f_departure_receipt_id || '',
            司机: r.driver_name || '',
            车牌号: r.vehicle_no || '',
            自编车号: r.tanker_vehicle_code || '',
            装料公司: r.loading_company || '',
            工程名称: r.project_name || '',
            施工地点: r.construction_location || '',
            客户名称: r.customer_name || '',
            施工单位: r.construction_unit || '',
            强度等级: r.concrete_strength || '',
            坑落度: r.slump || '',
            方量: toNumber(r.concrete_volume),
            结算方量: toNumber(r.settlement_volume),
            累计方量: toNumber(r.total_volume),
            累计车次: toNumber(r.total_vehicles),
            提单号: r.bill_no || '',
            进厂时间: r.loading_time ? dayjs(r.loading_time).format('YYYY-MM-DD HH:mm:ss') : '',
            出厂时间: r.exit_time ? dayjs(r.exit_time).format('YYYY-MM-DD HH:mm:ss') : '',
            交票状态: receipt.submitted_to_finance === 'Y' ? '已交票' : '未交票'
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

  // 批量删除（支持所有票据类型）
  const handleBatchDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的数据')
      return
    }

    const typeLabel = RECEIPT_TYPES.find(t => t.value === activeTab)?.label || '票据'

    modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条${typeLabel}记录吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const deletePromises = selectedRowKeys.map((key) => {
            const [type, id] = String(key).split('-')
            const receiptId = Number(id)
            switch (type) {
              case 'loading':
                return deleteLoadingMutation.mutateAsync(receiptId)
              case 'unloading':
                return deleteUnloadingMutation.mutateAsync(receiptId)
              case 'charging':
                return deleteChargingMutation.mutateAsync(receiptId)
              case 'water':
                return deleteWaterMutation.mutateAsync(receiptId)
              case 'departure':
                return deleteDepartureMutation.mutateAsync(receiptId)
              default:
                return Promise.resolve()
            }
          })
          await Promise.all(deletePromises)
          message.success(`成功删除 ${selectedRowKeys.length} 条记录`)
        } catch (error) {
          message.error('删除失败：' + (error as Error).message)
        }
      },
    })
  }, [modal, selectedRowKeys, activeTab, deleteLoadingMutation, deleteUnloadingMutation, deleteChargingMutation, deleteWaterMutation, deleteDepartureMutation, message])

  // 提交编辑
  const handleEditSubmit = useCallback(() => {
    editForm.validateFields().then((values) => {
      if (!editingReceipt) return

      if (editingReceipt.type === 'loading') {
        updateLoadingMutation.mutate({
          id: editingReceipt.id,
          data: {
            ...values,
            loading_time: values.loading_time ? values.loading_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
            unloading_time: values.unloading_time ? values.unloading_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
          },
        })
      } else if (editingReceipt.type === 'unloading') {
        updateUnloadingMutation.mutate({
          id: editingReceipt.id,
          data: {
            ...values,
            loading_time: values.loading_time ? values.loading_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
            unloading_time: values.unloading_time ? values.unloading_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
          },
        })
      } else if (editingReceipt.type === 'charging') {
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
      } else if (editingReceipt.type === 'departure') {
        updateDepartureMutation.mutate({
          id: editingReceipt.id,
          data: {
            ...values,
            loading_time: values.loading_time ? values.loading_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
            exit_time: values.exit_time ? values.exit_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
            production_date: values.production_date ? values.production_date.format('YYYY-MM-DD') : undefined,
          },
        })
      }
    })
  }, [editForm, editingReceipt, updateLoadingMutation, updateUnloadingMutation, updateChargingMutation, updateWaterMutation, updateDepartureMutation, canEditDelete, message])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          票据管理中心
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          管理装料单、卸货单、充电单、水票等各类票据记录。
        </Paragraph>
      </div>

      {/* KPI统计卡片 - 仅出厂单显示 */}
      {kpiStats && activeTab === 'departure' && (
        <Row gutter={16}>
          <Col span={6}>
            <Card
              bordered
              style={{
                textAlign: 'center',
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>总方量</div>
              <div style={{ fontSize: 30, fontWeight: 600, color: '#000' }}>
                {kpiStats.totalVolume}
                <span style={{ fontSize: 16, color: '#8c8c8c', marginLeft: 4 }}>方</span>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bordered
              style={{
                textAlign: 'center',
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>总单据数量</div>
              <div style={{ fontSize: 30, fontWeight: 600, color: '#000' }}>
                {kpiStats.totalCount}
                <span style={{ fontSize: 16, color: '#8c8c8c', marginLeft: 4 }}>单</span>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bordered
              style={{
                textAlign: 'center',
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>小方量单据</div>
              <div style={{ fontSize: 30, fontWeight: 600, color: '#000' }}>
                <span style={{ fontSize: 12, color: '#8c8c8c', marginRight: 4 }}>(&lt;9.1方)</span>
                {kpiStats.smallVolumeCount}
                <span style={{ fontSize: 16, color: '#8c8c8c', marginLeft: 4 }}>单</span>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card
              bordered
              style={{
                textAlign: 'center',
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>已交票 / 未交票</div>
              <div style={{ fontSize: 30, fontWeight: 600, color: '#000' }}>
                {kpiStats.submittedCount}
                <span style={{ fontSize: 16, color: '#8c8c8c', marginLeft: 4 }}>/ {kpiStats.notSubmittedCount} 单</span>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Flex justify="space-between" align="center" wrap gap={16}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            placeholder="选择部门"
            value={selectedDepartmentId}
            onChange={(value) => {
              setSelectedDepartmentId(value)
            }}
            allowClear
            options={[
              { value: undefined, label: '全部部门' },
              ...departments
                .sort((a, b) => {
                  const titleA = (a.title || '').toLowerCase()
                  const titleB = (b.title || '').toLowerCase()
                  return titleA.localeCompare(titleB, 'zh-CN')
                })
                .map((dept) => ({
                  value: dept.id,
                  label: dept.title,
                })),
            ]}
            loading={departmentsQuery.isLoading}
            notFoundContent={departmentsQuery.isLoading ? '加载中...' : '暂无部门'}
          />
          <Select
            style={{ width: 180 }}
            placeholder="选择用户"
            value={selectedUserId}
            onChange={setSelectedUserId}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              { value: undefined, label: '全部用户' },
              ...users
                .sort((a, b) => {
                  const nameA = (a.name || a.nickname || '用户').toLowerCase()
                  const nameB = (b.name || b.nickname || '用户').toLowerCase()
                  return nameA.localeCompare(nameB, 'zh-CN')
                })
                .map((user) => ({
                  value: user.id,
                  label: `${user.name || user.nickname || '用户'} (${user.phone || user.id})`,
                })),
            ]}
            loading={usersQuery.isLoading}
            notFoundContent={usersQuery.isLoading ? '加载中...' : '暂无用户'}
          />
          <Form form={searchForm} layout="inline" onFinish={handleSearch} onReset={handleReset} style={{ display: 'inline-flex', gap: '8px' }}>
            <Form.Item name="dateRange" label="日期范围" style={{ marginBottom: 0 }}>
              <RangePicker allowClear />
            </Form.Item>
            <Form.Item name="vehicleNo" label="车牌号" style={{ marginBottom: 0 }}>
              <Select
                showSearch
                allowClear
                placeholder="请选择车牌号"
                style={{ width: 150 }}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => {
                  if (value) {
                    const vehicle = vehiclesQuery.data?.find((v: any) => v.plate_number === value)
                    if (vehicle?.tanker_vehicle_code && vehicle.tanker_vehicle_code !== vehicle.plate_number) {
                      searchForm.setFieldValue('tankerVehicleCode', vehicle.tanker_vehicle_code)
                    }
                  }
                }}
                options={vehiclesQuery.data?.map((v: any) => ({
                  label: v.plate_number,
                  value: v.plate_number,
                }))}
                loading={vehiclesQuery.isLoading}
              />
            </Form.Item>
            <Form.Item name="tankerVehicleCode" label="车号" style={{ marginBottom: 0 }}>
              <Select
                showSearch
                allowClear
                placeholder="请选择车号"
                style={{ width: 150 }}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => {
                  if (value) {
                    const vehicle = vehiclesQuery.data?.find((v: any) => v.tanker_vehicle_code === value)
                    if (vehicle?.plate_number) {
                      searchForm.setFieldValue('vehicleNo', vehicle.plate_number)
                    }
                  }
                }}
                options={vehiclesQuery.data
                  ?.filter((v: any) => v.tanker_vehicle_code && v.tanker_vehicle_code !== v.plate_number)
                  .map((v: any) => ({
                    label: v.tanker_vehicle_code,
                    value: v.tanker_vehicle_code,
                  })) || []}
                loading={vehiclesQuery.isLoading}
              />
            </Form.Item>
            <Form.Item name="deletedStatus" label="删除状态" initialValue="normal" style={{ marginBottom: 0 }}>
              <Select
                placeholder="选择删除状态"
                allowClear
                style={{ width: 150 }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '正常', value: 'normal' },
                  { label: '已删除', value: 'deleted' },
                ]}
              />
            </Form.Item>
            <Form.Item name="submittedStatus" label="交票状态" initialValue="all" style={{ marginBottom: 0 }}>
              <Select
                placeholder="选择交票状态"
                allowClear
                style={{ width: 150 }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '已交票', value: 'submitted' },
                  { label: '未交票', value: 'not_submitted' },
                ]}
              />
            </Form.Item>
            {activeTab === 'departure' && (
              <Form.Item name="volumeFilter" label="方量筛选" initialValue="all" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="选择方量类型"
                  allowClear
                  style={{ width: 150 }}
                  options={[
                    { label: '全部', value: 'all' },
                    { label: '小方量(<9.1)', value: 'small' },
                    { label: '正常方量(≥9.1)', value: 'normal' },
                  ]}
                />
              </Form.Item>
            )}
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button htmlType="reset">重置</Button>
            </Form.Item>
          </Form>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['receipts'] })}>
            刷新
          </Button>
          <ColumnSettings
            storageKey={`receipts-columns-${activeTab}`}
            defaultColumns={columnSettingsConfig}
            onColumnsChange={handleColumnConfigChange}
          />
          {canEditDelete && (
            <>
              {selectedRowKeys.length > 0 && activeTab !== 'matched' && (
                <>
                  <Button icon={<DownloadOutlined />} onClick={handleBatchExport}>
                    批量导出 ({selectedRowKeys.length})
                  </Button>
                  <Button type="primary" onClick={handleBatchSubmitToFinance}>
                    批量交票 ({selectedRowKeys.length})
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleBatchDelete}
                    loading={
                      deleteLoadingMutation.isPending ||
                      deleteUnloadingMutation.isPending ||
                      deleteChargingMutation.isPending ||
                      deleteWaterMutation.isPending ||
                      deleteDepartureMutation.isPending
                    }
                  >
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </>
              )}
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                导出全部
              </Button>
              <Button icon={<ToolOutlined />} onClick={() => setDataCleanModalOpen(true)}>
                数据清洗
              </Button>
            </>
          )}
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看票据数据" showIcon />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ReceiptType | 'matched')}
          items={availableTabs.map((type) => ({
            key: type.value,
            label: type.label,
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {(activeTab === 'matched' ? matchedReceiptsQuery.error : receiptsQuery.error) && (
                  <Alert
                    type="error"
                    showIcon
                    message={
                      ((activeTab === 'matched' ? matchedReceiptsQuery.error : receiptsQuery.error) as Error)
                        .message || '数据加载失败'
                    }
                  />
                )}

                <Table
                  rowKey={(record: any) => {
                    if (activeTab === 'matched') {
                      return `matched-${record.task_id || record.id}`
                    }
                    return `${record.type}-${record.id}`
                  }}
                  columns={getColumns(activeTab)}
                  dataSource={(activeTab === 'matched' ? matchedReceipts : filteredReceipts) as any}
                  loading={activeTab === 'matched' ? matchedReceiptsQuery.isLoading : receiptsQuery.isLoading}
                  rowSelection={
                    activeTab === 'matched'
                      ? undefined
                      : {
                          selectedRowKeys,
                          onChange: setSelectedRowKeys,
                        }
                  }
                  pagination={{
                    total: activeTab === 'matched' ? matchedReceipts.length : filteredReceipts.length,
                    pageSize: pageSize,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onShowSizeChange: (_current, size) => setPageSize(size),
                  }}
                  scroll={{ x: 1500, y: 600 }}
                  sticky={{ offsetHeader: 0 }}
                />
              </Space>
            ),
          }))}
        />
      </Card>

      <Drawer
        title={
          selectedReceipt
            ? (selectedReceipt as any).loadBill && (selectedReceipt as any).unloadBill
              ? '装卸匹配详情'
              : `${getReceiptTypeLabel(selectedReceipt.type)}详情`
            : '票据详情'
        }
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
              loading={
                updateLoadingMutation.isPending ||
                updateUnloadingMutation.isPending ||
                updateChargingMutation.isPending ||
                updateWaterMutation.isPending ||
                updateDepartureMutation.isPending
              }
            >
              保存
            </Button>
          </Space>
        }
      >
        {editingReceipt && (
          <Form form={editForm} layout="vertical">
            {(editingReceipt.type === 'loading' || editingReceipt.type === 'unloading') && (
              <>
                {/* 票据图片 */}
                {editingReceipt.thumb_url && 
                 !editingReceipt.thumb_url.startsWith('wxfile://') && 
                 !editingReceipt.thumb_url.startsWith('file://') && (
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>票据图片：</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Image
                        src={editingReceipt.thumb_url}
                        width={200}
                        height={200}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                        preview={{
                          mask: '点击查看大图',
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <Form.Item name="company" label="公司">
                  <Input placeholder="请输入公司名称" />
                </Form.Item>
                <Form.Item name="driver_name" label="司机姓名">
                  <Input placeholder="请输入司机姓名" />
                </Form.Item>
                <Form.Item name="vehicle_no" label="车牌号">
                  <Input placeholder="请输入车牌号" />
                </Form.Item>
                <Form.Item name="material_name" label="材料名称">
                  <Input placeholder="请输入材料名称" />
                </Form.Item>
                <Form.Item name="material_spec" label="规格型号">
                  <Input placeholder="请输入规格型号" />
                </Form.Item>
                <Form.Item name="gross_weight" label="毛重(t)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入毛重" />
                </Form.Item>
                <Form.Item name="net_weight" label="净重(t)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入净重" />
                </Form.Item>
                <Form.Item name="tare_weight" label="皮重(t)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入皮重" />
                </Form.Item>
                <Form.Item name="loading_time" label="进厂时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
                <Form.Item name="unloading_time" label="出厂时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
              </>
            )}
            {editingReceipt.type === 'charging' && (
              <>
                {/* 票据图片 */}
                {editingReceipt.thumb_url && 
                 !editingReceipt.thumb_url.startsWith('wxfile://') && 
                 !editingReceipt.thumb_url.startsWith('file://') && (
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>票据图片：</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Image
                        src={editingReceipt.thumb_url}
                        width={200}
                        height={200}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                        preview={{
                          mask: '点击查看大图',
                        }}
                      />
                    </div>
                  </div>
                )}
                
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
                {/* 票据图片 */}
                {editingReceipt.image_path && 
                 !editingReceipt.image_path.startsWith('wxfile://') && 
                 !editingReceipt.image_path.startsWith('file://') && (
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>票据图片：</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Image
                        src={editingReceipt.image_path}
                        width={200}
                        height={200}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                        preview={{
                          mask: '点击查看大图',
                        }}
                      />
                    </div>
                  </div>
                )}
                
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
            {editingReceipt.type === 'departure' && (
              <>
                {/* 票据图片 */}
                {(() => {
                  const imageUrl = (editingReceipt as any).thumb_url || (editingReceipt as any).image_path
                  return imageUrl && 
                    !imageUrl.startsWith('wxfile://') && 
                    !imageUrl.startsWith('file://') && (
                    <div style={{ marginBottom: 16 }}>
                      <Typography.Text strong>票据图片：</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        <Image
                          src={imageUrl}
                          width={200}
                          height={200}
                          style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                          preview={{
                            mask: '点击查看大图',
                          }}
                        />
                      </div>
                    </div>
                  )
                })()}
                
                <Form.Item name="driver_name" label="司机姓名">
                  <Input placeholder="请输入司机姓名" />
                </Form.Item>
                <Form.Item name="vehicle_no" label="车牌号">
                  <Input placeholder="请输入车牌号" />
                </Form.Item>
                <Form.Item name="tanker_vehicle_code" label="自编车号">
                  <Input placeholder="请输入自编车号" />
                </Form.Item>
                <Form.Item name="loading_company" label="装料公司">
                  <Input placeholder="请输入装料公司" />
                </Form.Item>
                <Form.Item name="project_name" label="工程名称">
                  <Input placeholder="请输入工程名称" />
                </Form.Item>
                <Form.Item name="construction_location" label="施工地点">
                  <Input placeholder="请输入施工地点" />
                </Form.Item>
                <Form.Item name="customer_name" label="客户名称">
                  <Input placeholder="请输入客户名称" />
                </Form.Item>
                <Form.Item name="construction_unit" label="施工单位">
                  <Input placeholder="请输入施工单位" />
                </Form.Item>
                <Form.Item name="concrete_strength" label="强度等级">
                  <Input placeholder="请输入强度等级" />
                </Form.Item>
                <Form.Item name="slump" label="坍落度">
                  <Input placeholder="请输入坍落度" />
                </Form.Item>
                <Form.Item name="concrete_volume" label="方量">
                  <Input placeholder="请输入方量" />
                </Form.Item>
                <Form.Item name="settlement_volume" label="结算方量">
                  <Input placeholder="请输入结算方量" />
                </Form.Item>
                <Form.Item name="total_volume" label="累计方量">
                  <Input placeholder="请输入累计方量" />
                </Form.Item>
                <Form.Item name="total_vehicles" label="累计车次">
                  <Input placeholder="请输入累计车次" />
                </Form.Item>
                <Form.Item name="bill_no" label="提单号">
                  <Input placeholder="请输入提单号" />
                </Form.Item>
                <Form.Item name="loading_time" label="进厂时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
                <Form.Item name="exit_time" label="出厂时间">
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
                <Form.Item name="production_date" label="生产日期">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </>
            )}
          </Form>
        )}
      </Drawer>

      {/* 装卸匹配编辑Modal */}
      <Modal
        title="编辑装卸匹配"
        open={matchedEditModalOpen}
        onOk={handleSaveMatchedEdit}
        onCancel={() => {
          setMatchedEditModalOpen(false)
          setEditingMatched(null)
          matchedEditForm.resetFields()
        }}
        width={1000}
        okText="保存"
        cancelText="取消"
      >
        {editingMatched && (
          <Form
            form={matchedEditForm}
            layout="vertical"
            style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 16 }}
          >
            <Alert
              message="编辑说明"
              description="修改后将同步更新对应的装料单和卸货单数据。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions title="任务信息" bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务ID">{editingMatched.task_id}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{editingMatched.loadBill?.vehicle_no || editingMatched.unloadBill?.vehicle_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="司机">{editingMatched.loadBill?.driver_name || editingMatched.unloadBill?.driver_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{editingMatched.created_at ? dayjs(editingMatched.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 16 }}>装料单信息（ID: {editingMatched.loadBill?.id}）</Typography.Title>
            
            {/* 装料单图片 */}
            {editingMatched.loadBill?.thumb_url && 
             !editingMatched.loadBill.thumb_url.startsWith('wxfile://') && 
             !editingMatched.loadBill.thumb_url.startsWith('file://') && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>装料单图片：</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Image
                    src={editingMatched.loadBill.thumb_url}
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    preview={{
                      mask: '点击查看大图',
                    }}
                  />
                </div>
              </div>
            )}
            
            <Form.Item label="公司" name="load_company">
              <Input placeholder="请输入公司名称" />
            </Form.Item>
            <Form.Item label="材料名称" name="load_material_name">
              <Input placeholder="请输入材料名称" />
            </Form.Item>
            <Form.Item label="规格型号" name="load_material_spec">
              <Input placeholder="请输入规格型号" />
            </Form.Item>
            <Space style={{ width: '100%' }} size="large">
              <Form.Item label="毛重(t)" name="load_gross_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="毛重" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="净重(t)" name="load_net_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="净重" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="皮重(t)" name="load_tare_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="皮重" style={{ width: 150 }} />
              </Form.Item>
            </Space>

            <Typography.Title level={5} style={{ marginTop: 24 }}>卸货单信息（ID: {editingMatched.unloadBill?.id}）</Typography.Title>
            
            {/* 卸货单图片 */}
            {editingMatched.unloadBill?.thumb_url && 
             !editingMatched.unloadBill.thumb_url.startsWith('wxfile://') && 
             !editingMatched.unloadBill.thumb_url.startsWith('file://') && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>卸货单图片：</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Image
                    src={editingMatched.unloadBill.thumb_url}
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    preview={{
                      mask: '点击查看大图',
                    }}
                  />
                </div>
              </div>
            )}
            
            <Form.Item label="公司" name="unload_company">
              <Input placeholder="请输入公司名称" />
            </Form.Item>
            <Form.Item label="材料名称" name="unload_material_name">
              <Input placeholder="请输入材料名称" />
            </Form.Item>
            <Form.Item label="规格型号" name="unload_material_spec">
              <Input placeholder="请输入规格型号" />
            </Form.Item>
            <Space style={{ width: '100%' }} size="large">
              <Form.Item label="毛重(t)" name="unload_gross_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="毛重" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="净重(t)" name="unload_net_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="净重" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="皮重(t)" name="unload_tare_weight" style={{ marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} precision={2} placeholder="皮重" style={{ width: 150 }} />
              </Form.Item>
            </Space>
          </Form>
        )}
      </Modal>

      {/* 数据清洗对话框 */}
      <Modal
        title={
          <Space>
            <ToolOutlined />
            <span>数据清洗工具</span>
          </Space>
        }
        open={dataCleanModalOpen}
        onCancel={() => {
          setDataCleanModalOpen(false)
          setCleanField('')
          setSelectedOldValues([])
          setNewValue('')
        }}
        onOk={async () => {
          if (!cleanField || selectedOldValues.length === 0 || !newValue) {
            message.warning('请完整填写所有字段')
            return
          }
          
          try {
            // 调用后端API进行批量更新
            const result = await batchUpdateReceiptField({
              receipt_type: activeTab,
              field_name: cleanField,
              old_values: selectedOldValues,
              new_value: newValue,
              company_id: effectiveCompanyId,
            }) as any
            
            message.success(`成功更新 ${result.affected_rows || 0} 条记录`)
            setDataCleanModalOpen(false)
            setCleanField('')
            setSelectedOldValues([])
            setNewValue('')
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
          } catch (error: any) {
            message.error(error.message || '批量修改失败')
          }
        }}
        width={700}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="数据清洗说明"
            description="选择要清洗的字段，勾选需要修改的旧值，然后输入正确的新值。系统会批量替换所有匹配的记录。"
            type="info"
            showIcon
          />
          
          <Form layout="vertical">
            <Form.Item label="选择要清洗的字段" required>
              <Select
                value={cleanField}
                onChange={(value) => {
                  setCleanField(value)
                  setSelectedOldValues([])
                  setNewValue('')
                }}
                placeholder="请选择字段"
                options={(() => {
                  if (activeTab === 'loading') {
                    return [
                      { label: '公司', value: 'company' },
                      { label: '材料名称', value: 'material_name' },
                      { label: '规格型号', value: 'material_spec' },
                    ]
                  } else if (activeTab === 'unloading') {
                    return [
                      { label: '公司', value: 'company' },
                      { label: '材料名称', value: 'material_name' },
                      { label: '规格型号', value: 'material_spec' },
                    ]
                  } else if (activeTab === 'departure') {
                    return [
                      { label: '装料公司', value: 'company' },
                      { label: '工程名称', value: 'project_name' },
                      { label: '施工地点', value: 'pour_location' },
                      { label: '客户名称', value: 'customer_name' },
                      { label: '施工单位', value: 'construction_unit' },
                    ]
                  }
                  return []
                })()}
              />
            </Form.Item>

            {cleanField && (
              <>
                <Form.Item label="选择要替换的旧值（可多选）" required>
                  <Select
                    mode="multiple"
                    value={selectedOldValues}
                    onChange={setSelectedOldValues}
                    placeholder="请选择要替换的值"
                    style={{ width: '100%' }}
                    options={Array.from(
                      new Set(
                        filteredReceipts
                          .map((r: any) => r[cleanField])
                          .filter(Boolean)
                      )
                    )
                      .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
                      .map((value) => ({
                        label: `${value} (${filteredReceipts.filter((r: any) => r[cleanField] === value).length} 条)`,
                        value: String(value),
                      }))}
                    filterOption={(input, option) =>
                      (option?.label as string).toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Form.Item label="输入正确的新值" required>
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="请输入正确的值"
                  />
                </Form.Item>

                {selectedOldValues.length > 0 && newValue && (
                  <Alert
                    message="预览"
                    description={
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          将以下 <strong>{selectedOldValues.length}</strong> 个值：
                        </div>
                        <div style={{ marginBottom: 8, color: '#ff4d4f' }}>
                          {selectedOldValues.map((v, i) => (
                            <Tag key={i} color="red">{v}</Tag>
                          ))}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <SwapOutlined style={{ margin: '0 8px' }} />
                          替换为：
                        </div>
                        <div>
                          <Tag color="green">{newValue}</Tag>
                        </div>
                        <div style={{ marginTop: 8, color: '#999' }}>
                          影响记录数：{filteredReceipts.filter((r: any) => selectedOldValues.includes(String(r[cleanField]))).length} 条
                        </div>
                      </div>
                    }
                    type="warning"
                  />
                )}
              </>
            )}
          </Form>
        </Space>
      </Modal>
    </Space>
  )
}

export default ReceiptsPage

