import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { CalculatorOutlined, DownloadOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReceipts, updateChargingReceipt, fetchChargingFilterOptions } from '../api/services/receipts'
import { calculateChargingCost, fetchChargingRules } from '../api/services/charging'
import type { Receipt, ChargingPriceRule, ChargingCostResult } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ColumnSettings from '../components/ColumnSettings'
import type { ColumnConfig } from '../components/ColumnSettings'
import ResizableHeaderCell from '../components/ResizableHeaderCell'

const { Text } = Typography
const { RangePicker } = DatePicker

const ChargingList = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    vehicleNo?: string
    chargingStation?: string
    driverName?: string
    amountDifference?: string[]
  }>({})
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [searchForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 计算相关状态
  const [calculatingReceipt, setCalculatingReceipt] = useState<Receipt | null>(null)
  const [pricingRulesModalOpen, setPricingRulesModalOpen] = useState(false)
  const [calculationResult, setCalculationResult] = useState<ChargingCostResult | null>(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)

  // 批量计算相关状态
  const [batchCalculating, setBatchCalculating] = useState(false)
  const [batchResults, setBatchResults] = useState<Array<{
    receipt: Receipt
    result?: ChargingCostResult
    error?: string
    selected: boolean
  }>>([])
  const [batchResultModalOpen, setBatchResultModalOpen] = useState(false)

  const updateFilters = useCallback((patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const receiptsQuery = useQuery<{
    receipts: Receipt[]
    statistics: {
      total_count: number
      deleted_count: number
      normal_count: number
      submitted_count: number
      not_submitted_count: number
    }
  }>({
    queryKey: ['receipts', 'charging', filters, effectiveCompanyId, user?.companyId],
    queryFn: () =>
      fetchReceipts({
        receiptType: 'charging',
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: isSuperAdmin ? effectiveCompanyId : user?.companyId,
        vehicleNo: filters.vehicleNo,
        chargingStation: filters.chargingStation,
        driverName: filters.driverName,
        scope: 'all',
      }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const receipts = receiptsQuery.data?.receipts || []

  // 获取筛选选项
  const filterOptionsQuery = useQuery({
    queryKey: ['charging-filter-options', effectiveCompanyId, user?.companyId],
    queryFn: () => fetchChargingFilterOptions({
      companyId: isSuperAdmin ? effectiveCompanyId : user?.companyId,
    }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const stationOptions = filterOptionsQuery.data?.stations || []
  const driverOptions = filterOptionsQuery.data?.drivers || []
  const vehicleOptions = filterOptionsQuery.data?.vehicles || []

  // 获取充电站的价格规则
  const rulesQuery = useQuery({
    queryKey: ['charging-rules', calculatingReceipt],
    queryFn: async () => {
      if (!calculatingReceipt) return null
      const r = calculatingReceipt as any
      if (!r.charging_station) {
        throw new Error('充电站信息缺失')
      }
      // 需要先获取充电站ID，这里假设我们通过充电站名称查询
      // 实际应该有一个API通过名称获取充电站详情
      return null // 暂时返回null，后续需要实现
    },
    enabled: false,
  })

  // 计算充电费用
  const calculateMutation = useMutation({
    mutationFn: calculateChargingCost,
    onSuccess: (data) => {
      setCalculationResult(data)
      setPricingRulesModalOpen(false)
      setResultModalOpen(true)
    },
    onError: (error) => {
      message.error((error as Error).message || '计算失败')
    },
  })

  // 更新充电单
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateChargingReceipt(id, data),
    onSuccess: () => {
      message.success('更新成功')
      setEditDrawerOpen(false)
      setEditingReceipt(null)
      setResultModalOpen(false)
      setCalculatingReceipt(null)
      setCalculationResult(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  // 导出所有数据
  const handleExport = useCallback(() => {
    if (!receipts.length) {
      message.warning('没有数据可导出')
      return
    }

    const exportData = receipts.map((r: any) => {
      const diff = (r.amount !== null && r.amount !== undefined && r.calculated_amount !== null && r.calculated_amount !== undefined)
        ? (r.amount - r.calculated_amount)
        : (r.amount_difference !== null && r.amount_difference !== undefined ? r.amount_difference : null)
      return {
        '单据编号': r.receipt_number || '',
        '车牌号': r.vehicle_no || '',
        '充电站': r.charging_station || '',
        '充电桩': r.charging_pile || '',
        '电量(kWh)': r.energy_kwh || 0,
        '识别金额(元)': r.amount || 0,
        '计算金额(元)': r.calculated_amount || '',
        '计算单价(元/kWh)': (r.calculated_price ?? r.calculated_unit_price) ?? '',
        '金额差异(元)': diff !== null ? diff.toFixed(2) : '',
        '开始充电时间': r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
        '结束充电时间': r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
        '充电时长(分钟)': r.duration_min || '',
        '创建时间': r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '充电单数据')

    const fileName = `充电单数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
    XLSX.writeFile(wb, fileName)
    message.success('导出成功')
  }, [receipts, message])

  // 导出选中数据
  const handleExportSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的数据')
      return
    }

    const selectedReceipts = receipts.filter((r) => selectedRowKeys.includes(r.id))
    
    const exportData = selectedReceipts.map((r: any) => {
      const diff = (r.amount !== null && r.amount !== undefined && r.calculated_amount !== null && r.calculated_amount !== undefined)
        ? (r.amount - r.calculated_amount)
        : (r.amount_difference !== null && r.amount_difference !== undefined ? r.amount_difference : null)
      return {
        '单据编号': r.receipt_number || '',
        '车牌号': r.vehicle_no || '',
        '充电站': r.charging_station || '',
        '充电桩': r.charging_pile || '',
        '电量(kWh)': r.energy_kwh || 0,
        '识别金额(元)': r.amount || 0,
        '计算金额(元)': r.calculated_amount || '',
        '计算单价(元/kWh)': (r.calculated_price ?? r.calculated_unit_price) ?? '',
        '金额差异(元)': diff !== null ? diff.toFixed(2) : '',
        '开始充电时间': r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
        '结束充电时间': r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
        '充电时长(分钟)': r.duration_min || '',
        '创建时间': r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '充电单数据')

    const fileName = `充电单数据_选中${selectedRowKeys.length}条_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
    XLSX.writeFile(wb, fileName)
    message.success(`成功导出 ${selectedRowKeys.length} 条数据`)
  }, [receipts, selectedRowKeys, message])

  const handleSearch = (values: any) => {
    updateFilters({
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
    })
  }

  const handleReset = () => {
    searchForm.resetFields()
    setFilters({})
  }

  const openDetail = (record: Receipt) => {
    setSelectedReceipt(record)
    setDetailDrawerOpen(true)
  }

  const openEdit = (record: Receipt) => {
    setEditingReceipt(record)
    setEditDrawerOpen(true)
    const r = record as any
    editForm.setFieldsValue({
      receipt_number: r.receipt_number,
      vehicle_no: r.vehicle_no,
      charging_station: r.charging_station,
      charging_pile: r.charging_pile,
      energy_kwh: r.energy_kwh,
      amount: r.amount,
      calculated_amount: r.calculated_amount,
      calculated_unit_price: r.calculated_unit_price ?? r.calculated_price,
      start_time: r.start_time ? dayjs(r.start_time) : undefined,
      end_time: r.end_time ? dayjs(r.end_time) : undefined,
      duration_min: r.duration_min,
    })
  }

  // 打开计算对话框
  const openCalculate = (record: Receipt) => {
    const r = record as any
    if (!r.charging_station) {
      message.warning('该充电单缺少充电站信息，无法计算')
      return
    }
    if (!r.start_time) {
      message.warning('该充电单缺少充电时间信息，无法计算')
      return
    }
    if (!r.energy_kwh || r.energy_kwh <= 0) {
      message.warning('该充电单缺少有效的电量信息，无法计算')
      return
    }
    
    setCalculatingReceipt(record)
    setPricingRulesModalOpen(true)
  }

  // 执行计算
  const handleCalculate = () => {
    if (!calculatingReceipt) return
    
    const r = calculatingReceipt as any
    calculateMutation.mutate({
      station_name: r.charging_station,
      charging_time: r.start_time,
      energy_kwh: r.energy_kwh,
      charging_receipt_id: r.id,
    })
  }

  // 应用计算结果
  const handleApplyCalculation = () => {
    if (!calculatingReceipt || !calculationResult) return
    
    modal.confirm({
      title: '确认应用计算结果',
      content: (
        <div>
          <p>确认要使用计算结果更新充电单数据吗？</p>
          <p style={{ marginTop: 8 }}>
            <Text strong>计算金额：</Text>
            <Text style={{ color: '#FFD700', fontSize: 16 }}>¥{calculationResult.amount.toFixed(2)}</Text>
          </p>
          <p>
            <Text strong>计算单价：</Text>
            <Text style={{ color: '#52c41a' }}>¥{calculationResult.price_per_kwh.toFixed(4)}/kWh</Text>
          </p>
        </div>
      ),
      onOk: () => {
        updateMutation.mutate({
          id: calculatingReceipt.id,
          data: {
            calculated_amount: calculationResult.amount,
            calculated_unit_price: calculationResult.price_per_kwh,
          },
        })
      },
    })
  }

  // 批量计算
  const handleBatchCalculate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要计算的充电单')
      return
    }

    const selectedReceipts = receipts.filter((r) => selectedRowKeys.includes(r.id))
    
    // 验证选中的充电单
    const invalidReceipts = selectedReceipts.filter((r: any) => {
      return !r.charging_station || !r.start_time || !r.energy_kwh || r.energy_kwh <= 0
    })

    if (invalidReceipts.length > 0) {
      modal.warning({
        title: '部分充电单信息不完整',
        content: (
          <div>
            <p>以下 {invalidReceipts.length} 条充电单缺少必要信息，将被跳过：</p>
            <ul style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
              {invalidReceipts.slice(0, 10).map((r: any) => (
                <li key={r.id}>
                  {r.receipt_number || `ID: ${r.id}`} - 
                  {!r.charging_station && ' 缺少充电站'}
                  {!r.start_time && ' 缺少充电时间'}
                  {(!r.energy_kwh || r.energy_kwh <= 0) && ' 缺少电量'}
                </li>
              ))}
              {invalidReceipts.length > 10 && <li>...还有 {invalidReceipts.length - 10} 条</li>}
            </ul>
            <p style={{ marginTop: 8 }}>是否继续计算其他充电单？</p>
          </div>
        ),
        onOk: () => executeBatchCalculate(selectedReceipts.filter((r: any) => 
          r.charging_station && r.start_time && r.energy_kwh && r.energy_kwh > 0
        )),
      })
    } else {
      executeBatchCalculate(selectedReceipts)
    }
  }

  // 执行批量计算
  const executeBatchCalculate = async (receiptsToCalculate: Receipt[]) => {
    setBatchCalculating(true)
    const results: Array<{
      receipt: Receipt
      result?: ChargingCostResult
      error?: string
      selected: boolean
    }> = []

    message.loading({ content: `正在计算 ${receiptsToCalculate.length} 条充电单...`, key: 'batch-calc', duration: 0 })

    for (let i = 0; i < receiptsToCalculate.length; i++) {
      const receipt = receiptsToCalculate[i] as any
      try {
        const result = await calculateChargingCost({
          station_name: receipt.charging_station,
          charging_time: receipt.start_time,
          energy_kwh: receipt.energy_kwh,
          charging_receipt_id: receipt.id,
        })
        results.push({
          receipt,
          result,
          selected: true, // 默认选中成功的结果
        })
      } catch (error) {
        results.push({
          receipt,
          error: (error as Error).message || '计算失败',
          selected: false,
        })
      }

      // 更新进度
      message.loading({ 
        content: `正在计算 ${i + 1}/${receiptsToCalculate.length}...`, 
        key: 'batch-calc', 
        duration: 0 
      })
    }

    message.destroy('batch-calc')
    setBatchCalculating(false)
    setBatchResults(results)
    setBatchResultModalOpen(true)

    const successCount = results.filter(r => r.result).length
    const failCount = results.filter(r => r.error).length
    
    if (successCount > 0) {
      message.success(`批量计算完成！成功 ${successCount} 条，失败 ${failCount} 条`)
    } else {
      message.error(`批量计算失败！所有 ${failCount} 条充电单都计算失败`)
    }
  }

  // 切换批量结果选择
  const toggleBatchResultSelection = (index: number) => {
    setBatchResults(prev => {
      const newResults = [...prev]
      newResults[index].selected = !newResults[index].selected
      return newResults
    })
  }

  // 全选/取消全选批量结果
  const toggleAllBatchResults = (selected: boolean) => {
    setBatchResults(prev => prev.map(r => ({ ...r, selected: r.result ? selected : false })))
  }

  // 应用批量计算结果
  const handleApplyBatchResults = async () => {
    const selectedResults = batchResults.filter(r => r.selected && r.result)
    
    if (selectedResults.length === 0) {
      message.warning('请至少选择一条计算结果')
      return
    }

    modal.confirm({
      title: '确认应用批量计算结果',
      content: `确认要应用 ${selectedResults.length} 条计算结果吗？这将更新充电单的计算金额和计算单价。`,
      onOk: async () => {
        message.loading({ content: '正在应用计算结果...', key: 'batch-apply', duration: 0 })
        
        let successCount = 0
        let failCount = 0

        for (const item of selectedResults) {
          try {
            await updateChargingReceipt(item.receipt.id, {
              calculated_amount: item.result!.amount,
              calculated_unit_price: item.result!.price_per_kwh,
            })
            successCount++
          } catch (error) {
            failCount++
            console.error(`更新充电单 ${item.receipt.id} 失败:`, error)
          }
        }

        message.destroy('batch-apply')
        
        if (successCount > 0) {
          message.success(`成功应用 ${successCount} 条计算结果${failCount > 0 ? `，失败 ${failCount} 条` : ''}`)
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
          setBatchResultModalOpen(false)
          setBatchResults([])
          setSelectedRowKeys([])
        } else {
          message.error('应用计算结果失败')
        }
      },
    })
  }

  // 列配置状态
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([])
  
  // 列宽状态
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    receipt_number: 150,
    driver_name: 120,
    vehicle_no: 120,
    charging_station: 150,
    charging_pile: 120,
    energy_kwh: 120,
    amount: 130,
    calculated_amount: 130,
    calculated_price: 150,
    amount_difference: 130,
    start_time: 180,
    end_time: 180,
    duration_min: 120,
    thumb_url: 100,
    action: 240,
  })

  // 处理列宽调整
  const handleResize = (key: string) => (_e: any, { size }: any) => {
    setColumnWidths(prev => ({
      ...prev,
      [key]: size.width,
    }))
  }

  const originalColumns: ColumnsType<Receipt> = useMemo(() => [
      { 
        title: '单据编号', 
        dataIndex: 'receipt_number', 
        key: 'receipt_number', 
        width: columnWidths.receipt_number,
        onHeaderCell: () => ({
          width: columnWidths.receipt_number,
          onResize: handleResize('receipt_number'),
        }),
      },
      {
        title: '司机',
        dataIndex: 'driver_name',
        key: 'driver_name',
        width: columnWidths.driver_name,
        filters: driverOptions.map((v) => ({ text: v, value: v })),
        filteredValue: filters.driverName ? [filters.driverName] : null,
        filterSearch: true,
        onHeaderCell: () => ({
          width: columnWidths.driver_name,
          onResize: handleResize('driver_name'),
        }),
      },
      {
        title: '车牌号',
        dataIndex: 'vehicle_no',
        key: 'vehicle_no',
        width: columnWidths.vehicle_no,
        filters: vehicleOptions.map((v) => ({ text: v, value: v })),
        filteredValue: filters.vehicleNo ? [filters.vehicleNo] : null,
        filterSearch: true,
        onHeaderCell: () => ({
          width: columnWidths.vehicle_no,
          onResize: handleResize('vehicle_no'),
        }),
      },
      {
        title: '充电站',
        dataIndex: 'charging_station',
        key: 'charging_station',
        width: columnWidths.charging_station,
        filters: stationOptions.map((v) => ({ text: v, value: v })),
        filteredValue: filters.chargingStation ? [filters.chargingStation] : null,
        filterSearch: true,
        onHeaderCell: () => ({
          width: columnWidths.charging_station,
          onResize: handleResize('charging_station'),
        }),
      },
      { 
        title: '充电桩', 
        dataIndex: 'charging_pile', 
        key: 'charging_pile', 
        width: columnWidths.charging_pile,
        onHeaderCell: () => ({
          width: columnWidths.charging_pile,
          onResize: handleResize('charging_pile'),
        }),
      },
      { 
        title: '电量(kWh)', 
        dataIndex: 'energy_kwh', 
        key: 'energy_kwh', 
        width: columnWidths.energy_kwh, 
        sorter: (a: any, b: any) => (a.energy_kwh || 0) - (b.energy_kwh || 0), 
        render: (v) => v?.toFixed(2) || '-',
        onHeaderCell: () => ({
          width: columnWidths.energy_kwh,
          onResize: handleResize('energy_kwh'),
        }),
      },
      { 
        title: '识别金额(元)', 
        dataIndex: 'amount', 
        key: 'amount', 
        width: columnWidths.amount, 
        sorter: (a: any, b: any) => (a.amount || 0) - (b.amount || 0),
        render: (v) => v?.toFixed(2) || '-',
        onHeaderCell: () => ({
          width: columnWidths.amount,
          onResize: handleResize('amount'),
        }),
      },
      { 
        title: '计算金额(元)', 
        dataIndex: 'calculated_amount', 
        key: 'calculated_amount', 
        width: columnWidths.calculated_amount, 
        sorter: (a: any, b: any) => (a.calculated_amount || 0) - (b.calculated_amount || 0),
        render: (v, record: any) => {
          if (v === null || v === undefined) return '-'
          // 识别金额为0时，计算金额显示为绿色
          const amount = record.amount ?? 0
          const color = amount === 0 ? '#52c41a' : undefined
          return <span style={{ color, fontWeight: amount === 0 ? 'normal' : undefined }}>￥{Number(v).toFixed(2)}</span>
        },
        onHeaderCell: () => ({
          width: columnWidths.calculated_amount,
          onResize: handleResize('calculated_amount'),
        }),
      },
      { 
        title: '计算单价(元/kWh)', 
        dataIndex: 'calculated_price', 
        key: 'calculated_price', 
        width: columnWidths.calculated_price, 
        sorter: (a: any, b: any) => ((a.calculated_price ?? a.calculated_unit_price) ?? 0) - ((b.calculated_price ?? b.calculated_unit_price) ?? 0),
        render: (_: any, record: any) => {
          const unitPrice = (record?.calculated_price ?? record?.calculated_unit_price)
          if (unitPrice === null || unitPrice === undefined) return '-'
          return <span style={{ color: '#52c41a' }}>￥{Number(unitPrice).toFixed(4)}</span>
        },
        onHeaderCell: () => ({
          width: columnWidths.calculated_price,
          onResize: handleResize('calculated_price'),
        }),
      },
      { 
        title: '金额差异(元)', 
        dataIndex: 'amount_difference',
        key: 'amount_difference', 
        width: columnWidths.amount_difference, 
        filters: [
          { text: '异常数据(差异>5元)', value: 'abnormal' },
          { text: '正常数据(差异≤5元)', value: 'normal' },
          { text: '识别金额为0', value: 'zero_amount' },
          { text: '已计算', value: 'calculated' },
          { text: '未计算', value: 'not_calculated' },
        ],
        filteredValue: filters.amountDifference || null,
        onFilter: (value, record: any) => {
          const amount = record.amount ?? 0
          const calculatedAmount = record.calculated_amount
          
          // 筛选：已计算
          if (value === 'calculated') {
            return calculatedAmount !== null && calculatedAmount !== undefined
          }
          
          // 筛选：未计算
          if (value === 'not_calculated') {
            return calculatedAmount === null || calculatedAmount === undefined
          }
          
          // 筛选：识别金额为0
          if (value === 'zero_amount') {
            return amount === 0
          }
          
          // 对于异常和正常数据筛选，必须同时满足：
          // 1. 识别金额不为0
          // 2. 计算金额存在（已经计算过）
          if (calculatedAmount === null || calculatedAmount === undefined) {
            // 未计算的数据不参与异常/正常筛选
            return false
          }
          
          // 计算差异
          let diff: number
          if (record.amount_difference !== null && record.amount_difference !== undefined) {
            diff = record.amount_difference
          } else {
            diff = amount - calculatedAmount
          }
          
          const absDiff = Math.abs(diff)
          
          if (value === 'abnormal') {
            // 识别金额不为0 且 差异绝对值大于5
            return amount !== 0 && absDiff > 5
          }
          if (value === 'normal') {
            // 识别金额不为0 且 差异绝对值小于等于5
            return amount !== 0 && absDiff <= 5
          }
          return true
        },
        sorter: (a: any, b: any) => {
          const diffA = (a.amount_difference ?? ((a.amount ?? 0) - (a.calculated_amount ?? 0)))
          const diffB = (b.amount_difference ?? ((b.amount ?? 0) - (b.calculated_amount ?? 0)))
          return diffA - diffB
        },
        render: (v, record: any) => {
          // 获取识别金额
          const amount = record.amount ?? 0
          
          // 计算差异
          const diff = (record.amount_difference ?? v)
          let computed: number
          
          if (diff === null || diff === undefined) {
            if (record.amount === null || record.amount === undefined || record.calculated_amount === null || record.calculated_amount === undefined) return '-'
            computed = Number(record.amount) - Number(record.calculated_amount)
          } else {
            computed = Number(diff)
          }
          
          // 识别金额为0：不校验，不显示颜色
          if (amount === 0) {
            const prefix = computed > 0 ? '+' : ''
            return <span>{prefix}￥{computed.toFixed(2)}</span>
          }
          
          // 识别金额不为0：进行校验
          const absDiff = Math.abs(computed)
          let color: string | undefined
          let fontWeight: string | undefined
          
          if (absDiff > 5) {
            // 差异大于5元：标红加粗
            color = '#ff4d4f'
            fontWeight = 'bold'
          } else {
            // 差异小于等于5元：显示为黑色
            color = undefined
            fontWeight = undefined
          }
          
          const prefix = computed > 0 ? '+' : ''
          return <span style={{ color, fontWeight }}>{prefix}￥{computed.toFixed(2)}</span>
        },
        onHeaderCell: () => ({
          width: columnWidths.amount_difference,
          onResize: handleResize('amount_difference'),
        }),
      },
      { 
        title: '开始充电时间', 
        dataIndex: 'start_time', 
        key: 'start_time', 
        width: columnWidths.start_time, 
        sorter: (a: any, b: any) => dayjs(a.start_time).unix() - dayjs(b.start_time).unix(), 
        render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
        onHeaderCell: () => ({
          width: columnWidths.start_time,
          onResize: handleResize('start_time'),
        }),
      },
      { 
        title: '结束充电时间', 
        dataIndex: 'end_time', 
        key: 'end_time', 
        width: columnWidths.end_time, 
        sorter: (a: any, b: any) => dayjs(a.end_time).unix() - dayjs(b.end_time).unix(), 
        render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
        onHeaderCell: () => ({
          width: columnWidths.end_time,
          onResize: handleResize('end_time'),
        }),
      },
      { 
        title: '充电时长(分钟)', 
        dataIndex: 'duration_min', 
        key: 'duration_min', 
        width: columnWidths.duration_min, 
        sorter: (a: any, b: any) => (a.duration_min || 0) - (b.duration_min || 0), 
        render: (v) => v || '-',
        onHeaderCell: () => ({
          width: columnWidths.duration_min,
          onResize: handleResize('duration_min'),
        }),
      },
      {
        title: '充电单图片',
        dataIndex: 'thumb_url',
        key: 'thumb_url',
        width: columnWidths.thumb_url,
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
        onHeaderCell: () => ({
          width: columnWidths.thumb_url,
          onResize: handleResize('thumb_url'),
        }),
      },
      {
        title: '操作',
        key: 'action',
        width: columnWidths.action,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small" direction="vertical">
            <Space size="small">
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>查看</Button>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
            </Space>
            <Button 
              type="link" 
              size="small" 
              icon={<CalculatorOutlined />} 
              onClick={() => openCalculate(record)}
              style={{ color: '#1890ff' }}
            >
              计算金额
            </Button>
          </Space>
        ),
        onHeaderCell: () => ({
          width: columnWidths.action,
          onResize: handleResize('action'),
        }),
      },
  ], [driverOptions, stationOptions, vehicleOptions, filters, columnWidths])

  // 生成列配置
  const columnSettingsConfig = useMemo(() => {
    return originalColumns.map((col) => ({
      key: String((col as any).dataIndex || (col as any).key || col.title || ''),
      title: String(col.title || ''),
      visible: true,
      fixed: col.fixed,
    }))
  }, [originalColumns])

  // 列配置变更处理
  const handleColumnConfigChange = useCallback((config: ColumnConfig[]) => {
    setColumnConfig(config)
  }, [])

  // 应用列配置后的列
  const columns = useMemo(() => {
    if (!columnConfig.length) return originalColumns

    const orderedColumns: ColumnsType<Receipt> = []
    
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

    for (const col of originalColumns) {
      const key = String((col as any).dataIndex || (col as any).key || col.title || '')
      if (!columnConfig.find((c) => c.key === key)) {
        orderedColumns.push(col)
      }
    }

    return orderedColumns
  }, [originalColumns, columnConfig])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Form form={searchForm} layout="inline" onFinish={handleSearch} onReset={handleReset}>
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button htmlType="reset">重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card>
        <Flex justify="flex-end" gap={8} style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出全部
          </Button>
          <ColumnSettings
            storageKey="charging-list-columns"
            defaultColumns={columnSettingsConfig}
            onColumnsChange={handleColumnConfigChange}
          />
        </Flex>
        {selectedRowKeys.length > 0 && (
          <Alert
            message={`已选择 ${selectedRowKeys.length} 条记录`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Space>
                <Button 
                  size="small" 
                  type="primary"
                  icon={<CalculatorOutlined />} 
                  onClick={handleBatchCalculate}
                  loading={batchCalculating}
                >
                  批量计算金额
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportSelected}>
                  导出选中
                </Button>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>
                  清空选择
                </Button>
              </Space>
            }
          />
        )}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={receipts}
          loading={receiptsQuery.isLoading}
          className="resizable-table"
          components={{
            header: {
              cell: ResizableHeaderCell,
            },
          }}
          rowClassName={(record: any) => {
            // 未计算的数据用灰色背景
            const calculatedAmount = record.calculated_amount
            if (calculatedAmount === null || calculatedAmount === undefined) {
              return 'row-not-calculated'
            }
            return ''
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            columnWidth: 50,
            fixed: 'left',
            selections: [
              {
                key: 'select-all-data',
                text: '全选所有数据',
                onSelect: () => {
                  const allKeys = receipts.map((record) => record.id)
                  setSelectedRowKeys(allKeys)
                  message.success(`已全选 ${allKeys.length} 条数据`)
                },
              },
              {
                key: 'select-current-page',
                text: '选择当前页',
                onSelect: () => {
                  const startIndex = (currentPage - 1) * pageSize
                  const endIndex = Math.min(startIndex + pageSize, receipts.length)
                  const pageKeys = receipts
                    .slice(startIndex, endIndex)
                    .map((record) => record.id)
                  setSelectedRowKeys(pageKeys)
                  message.success(`已选中当前页 ${pageKeys.length} 条数据`)
                },
              },
              {
                key: 'invert-selection',
                text: '反选当前页',
                onSelect: () => {
                  const startIndex = (currentPage - 1) * pageSize
                  const endIndex = Math.min(startIndex + pageSize, receipts.length)
                  const pageData = receipts.slice(startIndex, endIndex)
                  const pageKeys = pageData.map((record) => record.id)
                  
                  const newSelectedKeys = [...selectedRowKeys]
                  pageKeys.forEach(key => {
                    const index = newSelectedKeys.indexOf(key)
                    if (index > -1) {
                      newSelectedKeys.splice(index, 1)
                    } else {
                      newSelectedKeys.push(key)
                    }
                  })
                  setSelectedRowKeys(newSelectedKeys)
                  message.success('已反选当前页')
                },
              },
              {
                key: 'clear-all',
                text: '清空所有选择',
                onSelect: () => {
                  setSelectedRowKeys([])
                  message.success('已清空所有选择')
                },
              },
            ],
          }}
          scroll={{ x: 2400, y: 'calc(100vh - 400px)' }}
          sticky={{ offsetHeader: 0 }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: receipts.length,
            showTotal: (total) => `共 ${total} 条`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            },
          }}
          onChange={(_pagination, filters, _sorter) => {
            updateFilters({
              driverName: filters.driver_name?.[0] as string | undefined,
              vehicleNo: filters.vehicle_no?.[0] as string | undefined,
              chargingStation: filters.charging_station?.[0] as string | undefined,
              amountDifference: filters.amount_difference as string[] | undefined,
            })
          }}
        />
      </Card>
      
      {/* 详情抽屉 */}
      <Drawer title="充电单详情" open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} width={500}>
         {selectedReceipt && (
             <Descriptions column={1} bordered>
                 <Descriptions.Item label="单据编号">{(selectedReceipt as any).receipt_number}</Descriptions.Item>
                 <Descriptions.Item label="车牌号">{selectedReceipt.vehicle_no}</Descriptions.Item>
                 <Descriptions.Item label="充电站">{(selectedReceipt as any).charging_station}</Descriptions.Item>
                 <Descriptions.Item label="充电桩">{(selectedReceipt as any).charging_pile}</Descriptions.Item>
                 <Descriptions.Item label="电量">{(selectedReceipt as any).energy_kwh} kWh</Descriptions.Item>
                 <Descriptions.Item label="识别金额">
                   <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                     ￥{(selectedReceipt as any).amount?.toFixed(2) || '0.00'}
                   </span>
                 </Descriptions.Item>
                 <Descriptions.Item label="计算金额">
                   {((selectedReceipt as any).calculated_amount !== null && (selectedReceipt as any).calculated_amount !== undefined) ? (
                     <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFD700' }}>
                       ￥{Number((selectedReceipt as any).calculated_amount).toFixed(2)}
                     </span>
                   ) : '-'}
                 </Descriptions.Item>
                 <Descriptions.Item label="计算单价">
                   {(((selectedReceipt as any).calculated_price ?? (selectedReceipt as any).calculated_unit_price) !== null && ((selectedReceipt as any).calculated_price ?? (selectedReceipt as any).calculated_unit_price) !== undefined) ? (
                     <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                       ￥{Number(((selectedReceipt as any).calculated_price ?? (selectedReceipt as any).calculated_unit_price)).toFixed(4)}/kWh
                     </span>
                   ) : '-'}
                 </Descriptions.Item>
                 <Descriptions.Item label="金额差异">
                   {(() => {
                     const r: any = selectedReceipt as any
                     const diff = r.amount_difference
                     if (diff !== null && diff !== undefined) {
                       const num = Number(diff)
                       const color = num > 0 ? '#ff4d4f' : num < 0 ? '#52c41a' : undefined
                       const prefix = num > 0 ? '+' : ''
                       return <span style={{ fontSize: '16px', fontWeight: 'bold', color }}>{prefix}￥{num.toFixed(2)}</span>
                     }
                     if (r.amount === null || r.amount === undefined || r.calculated_amount === null || r.calculated_amount === undefined) return '-'
                     const computed = Number(r.amount) - Number(r.calculated_amount)
                     const color = computed > 0 ? '#ff4d4f' : computed < 0 ? '#52c41a' : undefined
                     const prefix = computed > 0 ? '+' : ''
                     return <span style={{ fontSize: '16px', fontWeight: 'bold', color }}>{prefix}￥{computed.toFixed(2)}</span>
                   })()}
                 </Descriptions.Item>
                 <Descriptions.Item label="开始时间">{(selectedReceipt as any).start_time ? dayjs((selectedReceipt as any).start_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                 <Descriptions.Item label="结束时间">{(selectedReceipt as any).end_time ? dayjs((selectedReceipt as any).end_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                 <Descriptions.Item label="创建时间">{selectedReceipt.created_at ? dayjs(selectedReceipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
             </Descriptions>
         )}
      </Drawer>
      
      {/* 编辑抽屉 */}
      <Drawer title="编辑充电单" open={editDrawerOpen} onClose={() => setEditDrawerOpen(false)} width={500}>
        <Form form={editForm} layout="vertical" onFinish={(values) => {
            updateMutation.mutate({
                id: editingReceipt!.id,
                data: {
                    ...values,
                    start_time: values.start_time?.format('YYYY-MM-DD HH:mm:ss'),
                    end_time: values.end_time?.format('YYYY-MM-DD HH:mm:ss'),
                }
            })
        }}>
            <Form.Item name="receipt_number" label="单据编号"><Input /></Form.Item>
            <Form.Item name="vehicle_no" label="车牌号"><Input /></Form.Item>
            <Form.Item name="charging_station" label="充电站"><Input /></Form.Item>
            <Form.Item name="charging_pile" label="充电桩"><Input /></Form.Item>
            <Form.Item name="energy_kwh" label="电量(kWh)"><InputNumber style={{width: '100%'}} step={0.01} precision={2} /></Form.Item>
            <Form.Item name="amount" label="识别金额(元)"><InputNumber style={{width: '100%'}} step={0.01} precision={2} /></Form.Item>
            <Form.Item name="calculated_amount" label="计算金额(元)">
              <InputNumber style={{width: '100%'}} step={0.01} precision={2} placeholder="系统计算的金额" />
            </Form.Item>
            <Form.Item name="calculated_unit_price" label="计算单价(元/kWh)">
              <InputNumber style={{width: '100%'}} step={0.0001} precision={4} placeholder="系统计算的单价" />
            </Form.Item>
            <Form.Item name="start_time" label="开始时间"><DatePicker showTime style={{width: '100%'}} /></Form.Item>
            <Form.Item name="end_time" label="结束时间"><DatePicker showTime style={{width: '100%'}} /></Form.Item>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending} block>保存</Button>
        </Form>
      </Drawer>

      {/* 计算对话框 - 显示充电站和电价表 */}
      <Modal
        title="计算充电费用"
        open={pricingRulesModalOpen}
        onCancel={() => {
          setPricingRulesModalOpen(false)
          setCalculatingReceipt(null)
        }}
        onOk={handleCalculate}
        confirmLoading={calculateMutation.isPending}
        width={700}
      >
        {calculatingReceipt && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message="系统将根据充电站的时段电价表自动计算充电费用"
              type="info"
              showIcon
            />
            
            <Card title="充电单信息" size="small">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="充电站">
                  <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                    {(calculatingReceipt as any).charging_station}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="充电桩">
                  {(calculatingReceipt as any).charging_pile || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="充电时间">
                  {(calculatingReceipt as any).start_time 
                    ? dayjs((calculatingReceipt as any).start_time).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="充电电量">
                  <Text strong style={{ color: '#52c41a' }}>
                    {(calculatingReceipt as any).energy_kwh} kWh
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="识别金额">
                  ￥{((calculatingReceipt as any).amount || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="当前计算金额">
                  {(calculatingReceipt as any).calculated_amount !== null && (calculatingReceipt as any).calculated_amount !== undefined
                    ? `￥${Number((calculatingReceipt as any).calculated_amount).toFixed(2)}`
                    : '未计算'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="生效的时段电价表" size="small">
              <Alert
                message='点击"确定"按钮后，系统将根据充电时间和电量，使用该充电站当前生效的时段电价规则进行计算'
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                注：系统将自动查询该充电站在充电时间点生效的电价规则进行计算。如需查看详细的电价规则，请前往&quot;充电站管理&quot;页面。
              </Text>
            </Card>
          </Space>
        )}
      </Modal>

      {/* 计算结果对话框 */}
      <Modal
        title="计算结果"
        open={resultModalOpen}
        onCancel={() => {
          setResultModalOpen(false)
          setCalculatingReceipt(null)
          setCalculationResult(null)
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setResultModalOpen(false)
              setCalculatingReceipt(null)
              setCalculationResult(null)
            }}
          >
            取消
          </Button>,
          <Button 
            key="apply" 
            type="primary" 
            onClick={handleApplyCalculation}
            loading={updateMutation.isPending}
          >
            应用计算结果
          </Button>,
        ]}
        width={600}
      >
        {calculationResult && calculatingReceipt && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message="计算完成！请确认是否使用此计算结果更新充电单数据"
              type="success"
              showIcon
            />

            <Card title="计算结果" size="small">
              <Descriptions column={1} bordered>
                <Descriptions.Item label="计算金额">
                  <Text strong style={{ fontSize: 20, color: '#FFD700' }}>
                    ￥{calculationResult.amount.toFixed(2)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="计算单价">
                  <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                    ￥{calculationResult.price_per_kwh.toFixed(4)}/kWh
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="充电电量">
                  {(calculatingReceipt as any).energy_kwh} kWh
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="对比信息" size="small">
              <Descriptions column={1} bordered>
                <Descriptions.Item label="识别金额">
                  ￥{((calculatingReceipt as any).amount || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="金额差异">
                  {(() => {
                    const diff = ((calculatingReceipt as any).amount || 0) - calculationResult.amount
                    const color = diff > 0 ? '#ff4d4f' : diff < 0 ? '#52c41a' : undefined
                    const prefix = diff > 0 ? '+' : ''
                    return (
                      <Text strong style={{ fontSize: 16, color }}>
                        {prefix}￥{diff.toFixed(2)}
                      </Text>
                    )
                  })()}
                </Descriptions.Item>
                {(calculatingReceipt as any).calculated_amount !== null && 
                 (calculatingReceipt as any).calculated_amount !== undefined && (
                  <Descriptions.Item label="原计算金额">
                    ￥{Number((calculatingReceipt as any).calculated_amount).toFixed(2)}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Alert
              message="提示"
              description='点击"应用计算结果"将更新充电单的计算金额和计算单价字段。原识别金额不会被修改。'
              type="info"
              showIcon
            />
          </Space>
        )}
      </Modal>

      {/* 批量计算结果对话框 */}
      <Modal
        title={`批量计算结果 (${batchResults.length} 条)`}
        open={batchResultModalOpen}
        onCancel={() => {
          setBatchResultModalOpen(false)
          setBatchResults([])
        }}
        width={1200}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setBatchResultModalOpen(false)
              setBatchResults([])
            }}
          >
            取消
          </Button>,
          <Button 
            key="apply" 
            type="primary" 
            onClick={handleApplyBatchResults}
            disabled={batchResults.filter(r => r.selected).length === 0}
          >
            应用选中的计算结果 ({batchResults.filter(r => r.selected).length})
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message={`成功计算 ${batchResults.filter(r => r.result).length} 条，失败 ${batchResults.filter(r => r.error).length} 条`}
            description="请勾选要应用的计算结果，点击下方按钮批量更新充电单数据"
            type="info"
            showIcon
          />

          <Space>
            <Button 
              size="small" 
              onClick={() => toggleAllBatchResults(true)}
            >
              全选成功项
            </Button>
            <Button 
              size="small" 
              onClick={() => toggleAllBatchResults(false)}
            >
              取消全选
            </Button>
          </Space>

          <Table
            size="small"
            rowKey={(record) => record.receipt.id}
            dataSource={batchResults}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 1400 }}
            columns={[
              {
                title: '选择',
                width: 60,
                fixed: 'left',
                render: (_, record, index) => (
                  <input
                    type="checkbox"
                    checked={record.selected}
                    disabled={!record.result}
                    onChange={() => toggleBatchResultSelection(index)}
                    style={{ cursor: record.result ? 'pointer' : 'not-allowed' }}
                  />
                ),
              },
              {
                title: '状态',
                width: 80,
                render: (_, record) => (
                  record.result ? (
                    <Tag color="success">成功</Tag>
                  ) : (
                    <Tag color="error">失败</Tag>
                  )
                ),
              },
              {
                title: '单据编号',
                width: 150,
                render: (_, record) => (record.receipt as any).receipt_number || '-',
              },
              {
                title: '车牌号',
                width: 100,
                render: (_, record) => record.receipt.vehicle_no || '-',
              },
              {
                title: '充电站',
                width: 180,
                render: (_, record) => (record.receipt as any).charging_station || '-',
              },
              {
                title: '充电时间',
                width: 160,
                render: (_, record) => {
                  const startTime = (record.receipt as any).start_time
                  return startTime ? dayjs(startTime).format('YYYY-MM-DD HH:mm') : '-'
                },
              },
              {
                title: '电量(kWh)',
                width: 100,
                align: 'right',
                render: (_, record) => (record.receipt as any).energy_kwh?.toFixed(2) || '-',
              },
              {
                title: '识别金额',
                width: 100,
                align: 'right',
                render: (_, record) => {
                  const amount = (record.receipt as any).amount
                  return amount !== null && amount !== undefined ? `¥${Number(amount).toFixed(2)}` : '-'
                },
              },
              {
                title: '计算金额',
                width: 120,
                align: 'right',
                render: (_, record) => {
                  if (record.result) {
                    return (
                      <Text strong style={{ color: '#FFD700', fontSize: 14 }}>
                        ¥{record.result.amount.toFixed(2)}
                      </Text>
                    )
                  }
                  return '-'
                },
              },
              {
                title: '计算单价',
                width: 140,
                align: 'right',
                render: (_, record) => {
                  if (record.result) {
                    return (
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ color: '#52c41a' }}>
                          ¥{record.result.price_per_kwh.toFixed(4)}/kWh
                        </Text>
                        {record.result.rule_effective_date && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            生效日期: {dayjs(record.result.rule_effective_date).format('YYYY-MM-DD')}
                          </Text>
                        )}
                      </Space>
                    )
                  }
                  return '-'
                },
              },
              {
                title: '金额差异',
                width: 100,
                align: 'right',
                render: (_, record) => {
                  if (record.result) {
                    const ocrAmount = (record.receipt as any).amount || 0
                    const diff = ocrAmount - record.result.amount
                    const color = diff > 0 ? '#ff4d4f' : diff < 0 ? '#52c41a' : undefined
                    const prefix = diff > 0 ? '+' : ''
                    return (
                      <Text strong style={{ color }}>
                        {prefix}¥{diff.toFixed(2)}
                      </Text>
                    )
                  }
                  return '-'
                },
              },
              {
                title: '错误信息',
                width: 200,
                render: (_, record) => {
                  if (record.error) {
                    return <Text type="danger" style={{ fontSize: 12 }}>{record.error}</Text>
                  }
                  return '-'
                },
              },
            ]}
          />
        </Space>
      </Modal>
    </Space>
  )
}

export default ChargingList
