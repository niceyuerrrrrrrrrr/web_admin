import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Space,
  DatePicker,
  Button,
  Typography,
  Select,
  Tag,
  Input,
  Divider,
  Empty
} from 'antd'
import { Line, Column, Bar, Pie } from '@ant-design/plots'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fetchReceipts } from '../api/services/receipts'
import { fetchUsers } from '../api/services/users'
import { fetchCompanyDetail } from '../api/services/companies'
import { fetchDepartments } from '../api/services/departments'
import { fetchCEOStatistics } from '../api/services/statistics'
import { fetchVehicles } from '../api/services/vehicles'
import type { Receipt, LoadingReceipt, UnloadingReceipt } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

interface MaterialStats {
  material: string
  count: number
  totalWeight: number
  maxWeight: number
  minWeight: number
  avgWeight: number
}

interface RouteStats {
  key: string
  loadingCompany: string
  unloadingCompany: string
  material: string
  count: number
  totalLoadWeight: number
  totalUnloadWeight: number
  totalDiff: number
  maxDiff: number
  minDiff: number
  avgDiff: number
  
  // Detailed weight stats
  maxLoadWeight: number
  minLoadWeight: number
  avgLoadWeight: number
}

interface TankerCompanyStats {
  company: string
  count: number
  totalSettlementVolume: number
  totalConcreteVolume: number
  maxSettlementVolume: number
  minSettlementVolume: number
  avgSettlementVolume: number
}

interface TankerDriverStats {
  driver: string
  count: number
  totalSettlementVolume: number
  totalConcreteVolume: number
  maxSettlementVolume: number
  minSettlementVolume: number
  avgSettlementVolume: number
}

interface TankerVehicleStats {
  vehicleCode: string
  plateNumber: string
  count: number
  totalSettlementVolume: number
  totalConcreteVolume: number
  maxSettlementVolume: number
  minSettlementVolume: number
  avgSettlementVolume: number
}

interface DriverVehicleStats {
  key: string
  name: string
  loadCount: number
  loadWeight: number
  unloadCount: number
  unloadWeight: number
  totalCount: number
  totalWeight: number
  maxWeight: number
  minWeight: number
  avgWeight: number
}

const ReceiptAnalytics = () => {
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    userId?: number
    departmentId?: number
  }>({})
  
  const [selectedVehicleNo, setSelectedVehicleNo] = useState<string | undefined>(undefined)

  // 优先从 CEO 统计数据获取业务类型（更准确）
  const ceoStatsQuery = useQuery({
    queryKey: ['ceo-stats-for-business-type', effectiveCompanyId],
    queryFn: () => fetchCEOStatistics({ timeRange: 'month', companyId: effectiveCompanyId }),
    enabled: !!effectiveCompanyId,
  })

  const companyQuery = useQuery({
    queryKey: ['company', effectiveCompanyId],
    queryFn: () => fetchCompanyDetail(effectiveCompanyId!),
    enabled: !!effectiveCompanyId,
  })
  
  // 优先使用 CEO 统计数据中的业务类型，否则使用公司详情中的业务类型
  const businessType = ceoStatsQuery.data?.transportDetails?.businessType || 
                      companyQuery.data?.business_type || 
                      '挂车' // 默认为挂车

  // 获取部门列表
  const departmentsQuery = useQuery({
    queryKey: ['departments', 'list', effectiveCompanyId],
    queryFn: () => fetchDepartments({ company_id: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })
  const departments = departmentsQuery.data?.records || []

  // 获取用户列表（根据选择的部门过滤）
  const usersQuery = useQuery({
    queryKey: ['users', 'list', effectiveCompanyId, filters.departmentId],
    queryFn: () => fetchUsers({ 
      size: 1000, 
      company_id: effectiveCompanyId,
      department_id: filters.departmentId,
    }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })
  const users = usersQuery.data?.items || []

  // 获取车辆列表
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'list', effectiveCompanyId],
    queryFn: () => fetchVehicles({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })
  const vehicles = vehiclesQuery.data?.vehicles || []

  // 当部门变化时，清空用户选择
  useEffect(() => {
    setFilters(prev => ({ ...prev, userId: undefined }))
  }, [filters.departmentId])

  const allReceiptsQuery = useQuery<Receipt[]>({
    queryKey: ['receipts', 'analytics', filters, effectiveCompanyId],
    queryFn: () =>
      fetchReceipts({
        userId: filters.userId,
        receiptType: undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
        departmentId: filters.departmentId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const receipts = allReceiptsQuery.data || []

  // Filter receipts in memory by vehicle
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (selectedVehicleNo && r.vehicle_no !== selectedVehicleNo) return false
      return true
    })
  }, [receipts, selectedVehicleNo])

  // ----------------------------------------------------------------
  // Trailer (挂车) Statistics Logic
  // ----------------------------------------------------------------
  
  // 1. Loading/Unloading Individual Stats
  const trailerIndividualStats = useMemo(() => {
    if (businessType !== '挂车') return { loading: [], unloading: [] }

    const processReceipts = (type: 'loading' | 'unloading') => {
      const targetReceipts = filteredReceipts.filter(r => r.type === type) as (LoadingReceipt | UnloadingReceipt)[]
      const statsMap = new Map<string, { weights: number[] }>()

      targetReceipts.forEach(r => {
        const material = r.material_name || '未知材料'
        if (!statsMap.has(material)) {
          statsMap.set(material, { weights: [] })
        }
        const weight = Number(r.net_weight || 0)
        statsMap.get(material)!.weights.push(weight)
      })

      return Array.from(statsMap.entries()).map(([material, { weights }]) => {
        const count = weights.length
        const totalWeight = weights.reduce((a, b) => a + b, 0)
        const maxWeight = Math.max(...weights)
        const minWeight = Math.min(...weights)
        const avgWeight = count > 0 ? totalWeight / count : 0
        return {
          material,
          count,
          totalWeight,
          maxWeight,
          minWeight,
          avgWeight
        } as MaterialStats
      })
    }

    return {
      loading: processReceipts('loading'),
      unloading: processReceipts('unloading')
    }
  }, [filteredReceipts, businessType])

  // 2. Matched Transport Tasks Logic
  const trailerMatchedStats = useMemo(() => {
    if (businessType !== '挂车') return []

    // Build Map of Loading Receipts by task_id
    const loadingMap = new Map<string, LoadingReceipt>()
    filteredReceipts.forEach(r => {
      if (r.type === 'loading' && (r as LoadingReceipt).task_id) {
        loadingMap.set((r as LoadingReceipt).task_id!, r as LoadingReceipt)
      }
    })

    // Find matches in Unloading Receipts
    const routeMap = new Map<string, {
      loadingCompany: string,
      unloadingCompany: string,
      material: string,
      loadWeights: number[],
      unloadWeights: number[],
      diffs: number[]
    }>()

    filteredReceipts.forEach(r => {
      if (r.type === 'unloading' && (r as UnloadingReceipt).task_id) {
        const task_id = (r as UnloadingReceipt).task_id!
        const loadingReceipt = loadingMap.get(task_id)
        
        if (loadingReceipt) {
          const loadingCompany = loadingReceipt.company || '未知装料地'
          const unloadingCompany = r.company || '未知卸货地' // Unloading receipt company is the destination
          const material = loadingReceipt.material_name || r.material_name || '未知材料'
          const key = `${loadingCompany}-${unloadingCompany}-${material}`

          if (!routeMap.has(key)) {
            routeMap.set(key, {
              loadingCompany,
              unloadingCompany,
              material,
              loadWeights: [],
              unloadWeights: [],
              diffs: []
            })
          }

          const loadWeight = Number(loadingReceipt.net_weight || 0)
          const unloadWeight = Number(r.net_weight || 0)
          const diff = loadWeight - unloadWeight

          const entry = routeMap.get(key)!
          entry.loadWeights.push(loadWeight)
          entry.unloadWeights.push(unloadWeight)
          entry.diffs.push(diff)
        }
      }
    })

    // Aggregate Route Stats
    return Array.from(routeMap.entries()).map(([key, data]) => {
      const count = data.loadWeights.length
      const totalLoadWeight = data.loadWeights.reduce((a, b) => a + b, 0)
      const totalUnloadWeight = data.unloadWeights.reduce((a, b) => a + b, 0)
      const totalDiff = data.diffs.reduce((a, b) => a + b, 0)
      
      return {
        key,
        loadingCompany: data.loadingCompany,
        unloadingCompany: data.unloadingCompany,
        material: data.material,
        count,
        totalLoadWeight,
        totalUnloadWeight,
        totalDiff,
        maxDiff: Math.max(...data.diffs),
        minDiff: Math.min(...data.diffs),
        avgDiff: count > 0 ? totalDiff / count : 0,
        maxLoadWeight: Math.max(...data.loadWeights),
        minLoadWeight: Math.min(...data.loadWeights),
        avgLoadWeight: count > 0 ? totalLoadWeight / count : 0
      } as RouteStats
    })
  }, [filteredReceipts, businessType])

  // ----------------------------------------------------------------
  // Tanker (罐车) Statistics Logic - 按方量统计
  // ----------------------------------------------------------------
  
  // 罐车出厂单数据
  const tankerDepartureReceipts = useMemo(() => {
    if (businessType !== '罐车') return []
    return filteredReceipts.filter(r => r.type === 'departure')
  }, [filteredReceipts, businessType])

  const tankerSettlementSummary = useMemo(() => {
    if (businessType !== '罐车') {
      return { totalSettlementVolume: 0, totalConcreteVolume: 0, receiptCount: 0 }
    }
    const totals = tankerDepartureReceipts.reduce(
      (acc, receipt: any) => {
        const settlement = parseFloat(receipt.settlement_volume) || 0
        const concrete = parseFloat(receipt.concrete_volume) || 0
        acc.totalSettlementVolume += settlement
        acc.totalConcreteVolume += concrete
        acc.receiptCount += 1
        return acc
      },
      { totalSettlementVolume: 0, totalConcreteVolume: 0, receiptCount: 0 }
    )
    return totals
  }, [tankerDepartureReceipts, businessType])

  // 按装料公司统计
  const tankerCompanyStats = useMemo(() => {
    if (businessType !== '罐车') return []

    const companyMap = new Map<string, { settlementVolumes: number[]; concreteVolumes: number[] }>()

    tankerDepartureReceipts.forEach((r: any) => {
      const company = r.loading_company || '未知公司'
      const settlementVolume = parseFloat(r.settlement_volume) || 0
      const concreteVolume = parseFloat(r.concrete_volume) || 0
      if (!companyMap.has(company)) {
        companyMap.set(company, { settlementVolumes: [], concreteVolumes: [] })
      }
      const entry = companyMap.get(company)!
      entry.settlementVolumes.push(settlementVolume)
      entry.concreteVolumes.push(concreteVolume)
    })

    return Array.from(companyMap.entries()).map(([company, { settlementVolumes, concreteVolumes }]) => {
      const count = settlementVolumes.length
      const totalSettlementVolume = settlementVolumes.reduce((a, b) => a + b, 0)
      const totalConcreteVolume = concreteVolumes.reduce((a, b) => a + b, 0)
      return {
        company,
        count,
        totalSettlementVolume,
        totalConcreteVolume,
        maxSettlementVolume: settlementVolumes.length > 0 ? Math.max(...settlementVolumes) : 0,
        minSettlementVolume: settlementVolumes.length > 0 ? Math.min(...settlementVolumes) : 0,
        avgSettlementVolume: count > 0 ? totalSettlementVolume / count : 0
      } as TankerCompanyStats
    })
  }, [tankerDepartureReceipts, businessType])

  // 按司机统计
  const tankerDriverStats = useMemo(() => {
    if (businessType !== '罐车') return []

    const driverMap = new Map<string, { settlementVolumes: number[]; concreteVolumes: number[] }>()

    tankerDepartureReceipts.forEach((r: any) => {
      const driver = r.driver_name || '未知司机'
      const settlementVolume = parseFloat(r.settlement_volume) || 0
      const concreteVolume = parseFloat(r.concrete_volume) || 0
      if (!driverMap.has(driver)) {
        driverMap.set(driver, { settlementVolumes: [], concreteVolumes: [] })
      }
      const entry = driverMap.get(driver)!
      entry.settlementVolumes.push(settlementVolume)
      entry.concreteVolumes.push(concreteVolume)
    })

    return Array.from(driverMap.entries()).map(([driver, { settlementVolumes, concreteVolumes }]) => {
      const count = settlementVolumes.length
      const totalSettlementVolume = settlementVolumes.reduce((a, b) => a + b, 0)
      const totalConcreteVolume = concreteVolumes.reduce((a, b) => a + b, 0)
      return {
        driver,
        count,
        totalSettlementVolume,
        totalConcreteVolume,
        maxSettlementVolume: settlementVolumes.length > 0 ? Math.max(...settlementVolumes) : 0,
        minSettlementVolume: settlementVolumes.length > 0 ? Math.min(...settlementVolumes) : 0,
        avgSettlementVolume: count > 0 ? totalSettlementVolume / count : 0
      } as TankerDriverStats
    })
  }, [tankerDepartureReceipts, businessType])

  // 按车号统计
  const tankerVehicleStats = useMemo(() => {
    if (businessType !== '罐车') return []

    const vehicleMap = new Map<string, { plateNumber: string; settlementVolumes: number[]; concreteVolumes: number[] }>()

    tankerDepartureReceipts.forEach((r: any) => {
      const vehicleCode = r.tanker_vehicle_code || r.vehicle_no || '未知车号'
      const plateNumber = r.vehicle_no || ''
      const settlementVolume = parseFloat(r.settlement_volume) || 0
      const concreteVolume = parseFloat(r.concrete_volume) || 0
      if (!vehicleMap.has(vehicleCode)) {
        vehicleMap.set(vehicleCode, { plateNumber, settlementVolumes: [], concreteVolumes: [] })
      }
      const entry = vehicleMap.get(vehicleCode)!
      entry.settlementVolumes.push(settlementVolume)
      entry.concreteVolumes.push(concreteVolume)
    })

    return Array.from(vehicleMap.entries()).map(([vehicleCode, { plateNumber, settlementVolumes, concreteVolumes }]) => {
      const count = settlementVolumes.length
      const totalSettlementVolume = settlementVolumes.reduce((a, b) => a + b, 0)
      const totalConcreteVolume = concreteVolumes.reduce((a, b) => a + b, 0)
      return {
        vehicleCode,
        plateNumber,
        count,
        totalSettlementVolume,
        totalConcreteVolume,
        maxSettlementVolume: settlementVolumes.length > 0 ? Math.max(...settlementVolumes) : 0,
        minSettlementVolume: settlementVolumes.length > 0 ? Math.min(...settlementVolumes) : 0,
        avgSettlementVolume: count > 0 ? totalSettlementVolume / count : 0
      } as TankerVehicleStats
    })
  }, [tankerDepartureReceipts, businessType])


  // ----------------------------------------------------------------
  // Daily Trend Statistics (按日期统计运单数量)
  // ----------------------------------------------------------------
  const dailyTrendData = useMemo(() => {
    const dateMap = new Map<string, number>()
    
    filteredReceipts.forEach(r => {
      const date = dayjs(r.created_at).format('YYYY-MM-DD')
      dateMap.set(date, (dateMap.get(date) || 0) + 1)
    })
    
    // 转换为数组并按日期排序
    const data = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return data
  }, [filteredReceipts])

  // ----------------------------------------------------------------
  // Driver & Vehicle Statistics Logic (Common)
  // ----------------------------------------------------------------
  const driverVehicleStats = useMemo(() => {
    const driverMap = new Map<string, { weights: number[]; loadWeights: number[]; unloadWeights: number[] }>()
    const vehicleMap = new Map<string, { weights: number[]; loadWeights: number[]; unloadWeights: number[] }>()

    filteredReceipts.forEach(r => {
      const weight = Number((r as any).net_weight || 0)
      if (r.type !== 'loading' && r.type !== 'unloading') return

      // Driver
      const driver = (r as any).driver_name || '未知司机'
      if (!driverMap.has(driver)) driverMap.set(driver, { weights: [], loadWeights: [], unloadWeights: [] })
      const dEntry = driverMap.get(driver)!
      dEntry.weights.push(weight)
      if (r.type === 'loading') dEntry.loadWeights.push(weight)
      else if (r.type === 'unloading') dEntry.unloadWeights.push(weight)

      // Vehicle
      const vehicle = r.vehicle_no || '未知车辆'
      if (!vehicleMap.has(vehicle)) vehicleMap.set(vehicle, { weights: [], loadWeights: [], unloadWeights: [] })
      const vEntry = vehicleMap.get(vehicle)!
      vEntry.weights.push(weight)
      if (r.type === 'loading') vEntry.loadWeights.push(weight)
      else if (r.type === 'unloading') vEntry.unloadWeights.push(weight)
    })

    const processMap = (map: Map<string, { weights: number[]; loadWeights: number[]; unloadWeights: number[] }>) => {
      return Array.from(map.entries()).map(([key, data]) => {
        const count = data.weights.length
        const totalWeight = data.weights.reduce((a, b) => a + b, 0)
        const loadCount = data.loadWeights.length
        const loadWeight = data.loadWeights.reduce((a, b) => a + b, 0)
        const unloadCount = data.unloadWeights.length
        const unloadWeight = data.unloadWeights.reduce((a, b) => a + b, 0)

        return {
          key,
          name: key,
          totalCount: count,
          totalWeight,
          loadCount,
          loadWeight,
          unloadCount,
          unloadWeight,
          maxWeight: Math.max(...data.weights),
          minWeight: Math.min(...data.weights),
          avgWeight: count > 0 ? totalWeight / count : 0
        } as DriverVehicleStats
      })
    }

    return {
      byDriver: processMap(driverMap),
      byVehicle: processMap(vehicleMap)
    }
  }, [filteredReceipts])

  // ----------------------------------------------------------------
  // Render Functions
  // ----------------------------------------------------------------

  const handleSearch = (dates: any) => {
    setFilters(prev => ({
      ...prev,
      startDate: dates?.[0]?.format('YYYY-MM-DD'),
      endDate: dates?.[1]?.format('YYYY-MM-DD'),
    }))
  }

  // Columns
  const materialStatsColumns: ColumnsType<MaterialStats> = [
    { title: '材料名称', dataIndex: 'material' },
    { title: '总单数', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '总重量(t)', dataIndex: 'totalWeight', render: v => v?.toFixed(2), sorter: (a, b) => a.totalWeight - b.totalWeight },
    { title: '最大重量(t)', dataIndex: 'maxWeight', render: v => v?.toFixed(2) },
    { title: '最小重量(t)', dataIndex: 'minWeight', render: v => v?.toFixed(2) },
    { title: '平均重量(t)', dataIndex: 'avgWeight', render: v => v?.toFixed(2) },
  ]

  const matchedTasksColumns: ColumnsType<RouteStats> = [
    { title: '装料公司', dataIndex: 'loadingCompany' },
    { title: '卸货公司', dataIndex: 'unloadingCompany' },
    { title: '材料', dataIndex: 'material' },
    { title: '总车次', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '装料总重(t)', dataIndex: 'totalLoadWeight', render: v => v?.toFixed(2) },
    { title: '卸货总重(t)', dataIndex: 'totalUnloadWeight', render: v => v?.toFixed(2) },
    { title: '总磅差(t)', dataIndex: 'totalDiff', render: v => <span style={{ color: v > 0 ? 'red' : 'green' }}>{v?.toFixed(2)}</span> },
    { title: '平均磅差(t)', dataIndex: 'avgDiff', render: v => v?.toFixed(2) },
    { title: '最大磅差(t)', dataIndex: 'maxDiff', render: v => v?.toFixed(2) },
    { title: '最小磅差(t)', dataIndex: 'minDiff', render: v => v?.toFixed(2) },
  ]

  // 罐车按装料公司统计列
  const tankerCompanyColumns: ColumnsType<TankerCompanyStats> = [
    { title: '装料公司', dataIndex: 'company' },
    { title: '总车次', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '结算方量(m³)', dataIndex: 'totalSettlementVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalSettlementVolume - b.totalSettlementVolume },
    { title: '方量(m³)', dataIndex: 'totalConcreteVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalConcreteVolume - b.totalConcreteVolume },
    { title: '最大结算方量', dataIndex: 'maxSettlementVolume', render: v => v?.toFixed(2) },
    { title: '最小结算方量', dataIndex: 'minSettlementVolume', render: v => v?.toFixed(2) },
    { title: '平均结算方量', dataIndex: 'avgSettlementVolume', render: v => v?.toFixed(2) },
  ]

  // 罐车按司机统计列
  const tankerDriverColumns: ColumnsType<TankerDriverStats> = [
    { title: '司机姓名', dataIndex: 'driver' },
    { title: '总车次', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '结算方量(m³)', dataIndex: 'totalSettlementVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalSettlementVolume - b.totalSettlementVolume },
    { title: '方量(m³)', dataIndex: 'totalConcreteVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalConcreteVolume - b.totalConcreteVolume },
    { title: '最大结算方量', dataIndex: 'maxSettlementVolume', render: v => v?.toFixed(2) },
    { title: '最小结算方量', dataIndex: 'minSettlementVolume', render: v => v?.toFixed(2) },
    { title: '平均结算方量', dataIndex: 'avgSettlementVolume', render: v => v?.toFixed(2) },
  ]

  // 罐车按车号统计列
  const tankerVehicleColumns: ColumnsType<TankerVehicleStats> = [
    { title: '车号', dataIndex: 'vehicleCode' },
    { title: '车牌号', dataIndex: 'plateNumber' },
    { title: '总车次', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '结算方量(m³)', dataIndex: 'totalSettlementVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalSettlementVolume - b.totalSettlementVolume },
    { title: '方量(m³)', dataIndex: 'totalConcreteVolume', render: v => v?.toFixed(2), sorter: (a, b) => a.totalConcreteVolume - b.totalConcreteVolume },
    { title: '最大结算方量', dataIndex: 'maxSettlementVolume', render: v => v?.toFixed(2) },
    { title: '最小结算方量', dataIndex: 'minSettlementVolume', render: v => v?.toFixed(2) },
    { title: '平均结算方量', dataIndex: 'avgSettlementVolume', render: v => v?.toFixed(2) },
  ]

  const driverStatsColumns: ColumnsType<DriverVehicleStats> = [
    { title: '司机姓名', dataIndex: 'name' },
    { title: '装料车次', dataIndex: 'loadCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.loadCount - b.loadCount },
    { title: '装料重量(t)', dataIndex: 'loadWeight', render: (v: number) => v?.toFixed(2) },
    ...(businessType === '挂车' ? [
      { title: '卸货车次', dataIndex: 'unloadCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.unloadCount - b.unloadCount },
      { title: '卸货重量(t)', dataIndex: 'unloadWeight', render: (v: number) => v?.toFixed(2) },
      { title: '合计车次', dataIndex: 'totalCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.totalCount - b.totalCount },
      { title: '合计重量(t)', dataIndex: 'totalWeight', render: (v: number) => v?.toFixed(2), sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.totalWeight - b.totalWeight },
    ] : []), 
    { title: '最大重量(t)', dataIndex: 'maxWeight', render: (v: number) => v?.toFixed(2) },
    { title: '最小重量(t)', dataIndex: 'minWeight', render: (v: number) => v?.toFixed(2) },
    { title: '平均重量(t)', dataIndex: 'avgWeight', render: (v: number) => v?.toFixed(2) },
  ]

  const vehicleStatsColumns: ColumnsType<DriverVehicleStats> = [
    { title: '车牌号', dataIndex: 'name' },
    { title: '装料车次', dataIndex: 'loadCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.loadCount - b.loadCount },
    { title: '装料重量(t)', dataIndex: 'loadWeight', render: (v: number) => v?.toFixed(2) },
    ...(businessType === '挂车' ? [
      { title: '卸货车次', dataIndex: 'unloadCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.unloadCount - b.unloadCount },
      { title: '卸货重量(t)', dataIndex: 'unloadWeight', render: (v: number) => v?.toFixed(2) },
      { title: '合计车次', dataIndex: 'totalCount', sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.totalCount - b.totalCount },
      { title: '合计重量(t)', dataIndex: 'totalWeight', render: (v: number) => v?.toFixed(2), sorter: (a: DriverVehicleStats, b: DriverVehicleStats) => a.totalWeight - b.totalWeight },
    ] : []),
    { title: '最大重量(t)', dataIndex: 'maxWeight', render: (v: number) => v?.toFixed(2) },
    { title: '最小重量(t)', dataIndex: 'minWeight', render: (v: number) => v?.toFixed(2) },
    { title: '平均重量(t)', dataIndex: 'avgWeight', render: (v: number) => v?.toFixed(2) },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>票据数据分析</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {businessType}业务专属分析报表
          </Paragraph>
        </div>
        <Space wrap>
          <Tag color="blue" style={{ padding: '5px 10px', fontSize: 14 }}>
            {businessType}模式
          </Tag>
          
          <RangePicker onChange={handleSearch} allowClear placeholder={['开始日期', '结束日期']} />
          
          <Select
            style={{ width: 120 }}
            placeholder="选择部门"
            value={filters.departmentId}
            onChange={(val) => setFilters(prev => ({ ...prev, departmentId: val }))}
            allowClear
            options={[
              { value: undefined, label: '全部部门' },
              ...departments.map((dept) => ({
                value: dept.id,
                label: dept.title,
              })),
            ]}
            loading={departmentsQuery.isLoading}
          />

          <Select
            style={{ width: 150 }}
            placeholder="选择用户"
            value={filters.userId}
            onChange={(val) => setFilters(prev => ({ ...prev, userId: val }))}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              { value: undefined, label: '全部用户' },
              ...users.map((user) => ({
                value: user.id,
                label: user.name || user.nickname || `用户${user.id}`,
              })),
            ]}
            loading={usersQuery.isLoading}
          />

          <Select
            style={{ width: 130 }}
            placeholder={businessType === '罐车' ? '选择车号' : '选择车牌号'}
            value={selectedVehicleNo}
            onChange={setSelectedVehicleNo}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              { value: undefined, label: '全部车辆' },
              ...vehicles.map((v) => ({
                value: v.plate_number,
                label: businessType === '罐车' 
                  ? (v.tanker_vehicle_code || v.plate_number)
                  : v.plate_number,
              })),
            ]}
            loading={vehiclesQuery.isLoading}
          />

          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => allReceiptsQuery.refetch()}
            loading={allReceiptsQuery.isFetching}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 运单数量趋势图 */}
      <Card title="运单数量趋势" size="small">
        {dailyTrendData.length > 0 ? (
          <Line
            data={dailyTrendData}
            xField="date"
            yField="count"
            height={300}
            point={{
              size: 4,
              shape: 'circle',
            }}
            label={{
              style: {
                fill: '#1890ff',
                fontSize: 12,
              },
            }}
            xAxis={{
              label: {
                autoRotate: true,
                autoHide: true,
              },
              title: {
                text: '日期',
                style: {
                  fontSize: 14,
                },
              },
            }}
            yAxis={{
              title: {
                text: '运单数',
                style: {
                  fontSize: 14,
                },
              },
              label: {
                formatter: (v: string) => `${v}`,
              },
            }}
            tooltip={{
              formatter: (datum: any) => {
                return {
                  name: '运单数',
                  value: `${datum.count} 单`,
                }
              },
            }}
            smooth
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      {businessType === '挂车' && (
        <>
          {/* 装料单和卸货单图表 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="装料单统计 (按材料) - 图表" size="small">
                {trailerIndividualStats.loading.length > 0 ? (
                  <Column
                    data={trailerIndividualStats.loading}
                    xField="material"
                    yField="totalWeight"
                    height={300}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#1890ff',
                        fontSize: 12,
                      },
                      formatter: (datum: any) => datum?.totalWeight ? `${datum.totalWeight.toFixed(2)}t` : '',
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '总重量(t)',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: '总重量',
                          value: `${datum?.totalWeight?.toFixed(2) || 0}t (${datum?.count || 0}单)`,
                        }
                      },
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="卸货单统计 (按材料) - 图表" size="small">
                {trailerIndividualStats.unloading.length > 0 ? (
                  <Column
                    data={trailerIndividualStats.unloading}
                    xField="material"
                    yField="totalWeight"
                    height={300}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#52c41a',
                        fontSize: 12,
                      },
                      formatter: (datum: any) => datum?.totalWeight ? `${datum.totalWeight.toFixed(2)}t` : '',
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '总重量(t)',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: '总重量',
                          value: `${datum?.totalWeight?.toFixed(2) || 0}t (${datum?.count || 0}单)`,
                        }
                      },
                    }}
                    color="#52c41a"
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          {/* 装料单和卸货单表格 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="装料单统计 (按材料) - 详细数据" size="small">
                <Table 
                  size="small"
                  columns={materialStatsColumns} 
                  dataSource={trailerIndividualStats.loading} 
                  rowKey="material"
                  pagination={false}
                  scroll={{ x: 500 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="卸货单统计 (按材料) - 详细数据" size="small">
                <Table 
                  size="small"
                  columns={materialStatsColumns} 
                  dataSource={trailerIndividualStats.unloading} 
                  rowKey="material"
                  pagination={false}
                  scroll={{ x: 500 }}
                />
              </Card>
            </Col>
          </Row>

          {/* 运输任务匹配分析 - 排行榜 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="装料公司车次统计 TOP10" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <div style={{ padding: '20px 0' }}>
                    {(() => {
                      const companyMap = new Map<string, number>()
                      trailerMatchedStats.forEach(item => {
                        const current = companyMap.get(item.loadingCompany) || 0
                        companyMap.set(item.loadingCompany, current + item.count)
                      })
                      const topData = Array.from(companyMap.entries())
                        .map(([company, count]) => ({ company, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10)
                      const maxCount = topData[0]?.count || 1
                      
                      return topData.map((item, index) => (
                        <div key={item.company} style={{ marginBottom: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.company}>
                              #{index + 1} {item.company}
                            </span>
                            <span style={{ fontSize: 14, color: '#1890ff', fontWeight: 'bold', marginLeft: 12 }}>
                              {item.count} 车次
                            </span>
                          </div>
                          <div style={{ 
                            height: 8, 
                            backgroundColor: '#f0f0f0', 
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{ 
                              width: `${(item.count / maxCount) * 100}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #1890ff 0%, #36cfc9 100%)',
                              borderRadius: 4,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="卸货公司车次统计 TOP10" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <div style={{ padding: '20px 0' }}>
                    {(() => {
                      const companyMap = new Map<string, number>()
                      trailerMatchedStats.forEach(item => {
                        const current = companyMap.get(item.unloadingCompany) || 0
                        companyMap.set(item.unloadingCompany, current + item.count)
                      })
                      const topData = Array.from(companyMap.entries())
                        .map(([company, count]) => ({ company, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10)
                      const maxCount = topData[0]?.count || 1
                      
                      return topData.map((item, index) => (
                        <div key={item.company} style={{ marginBottom: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.company}>
                              #{index + 1} {item.company}
                            </span>
                            <span style={{ fontSize: 14, color: '#52c41a', fontWeight: 'bold', marginLeft: 12 }}>
                              {item.count} 车次
                            </span>
                          </div>
                          <div style={{ 
                            height: 8, 
                            backgroundColor: '#f0f0f0', 
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{ 
                              width: `${(item.count / maxCount) * 100}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #52c41a 0%, #95de64 100%)',
                              borderRadius: 4,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          {/* 运输任务匹配分析 - 完整柱状图 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="装料公司车次统计 - 完整数据" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <Column
                    data={(() => {
                      const companyMap = new Map<string, number>()
                      trailerMatchedStats.forEach(item => {
                        const current = companyMap.get(item.loadingCompany) || 0
                        companyMap.set(item.loadingCompany, current + item.count)
                      })
                      return Array.from(companyMap.entries())
                        .map(([company, count]) => ({ company, count }))
                        .sort((a, b) => b.count - a.count)
                    })()}
                    xField="company"
                    yField="count"
                    height={400}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#1890ff',
                        fontSize: 11,
                      },
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                        style: {
                          fontSize: 10,
                        },
                        formatter: (text: string) => {
                          return text.length > 8 ? text.substring(0, 8) + '...' : text
                        },
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '车次',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: datum.company,
                          value: `${datum?.count || 0} 车次`,
                        }
                      },
                    }}
                    columnStyle={{
                      radius: [4, 4, 0, 0],
                      fill: 'l(270) 0:#1890ff 1:#36cfc9',
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="卸货公司车次统计 - 完整数据" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <Column
                    data={(() => {
                      const companyMap = new Map<string, number>()
                      trailerMatchedStats.forEach(item => {
                        const current = companyMap.get(item.unloadingCompany) || 0
                        companyMap.set(item.unloadingCompany, current + item.count)
                      })
                      return Array.from(companyMap.entries())
                        .map(([company, count]) => ({ company, count }))
                        .sort((a, b) => b.count - a.count)
                    })()}
                    xField="company"
                    yField="count"
                    height={400}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#52c41a',
                        fontSize: 11,
                      },
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                        style: {
                          fontSize: 10,
                        },
                        formatter: (text: string) => {
                          return text.length > 8 ? text.substring(0, 8) + '...' : text
                        },
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '车次',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: datum.company,
                          value: `${datum?.count || 0} 车次`,
                        }
                      },
                    }}
                    columnStyle={{
                      radius: [4, 4, 0, 0],
                      fill: 'l(270) 0:#52c41a 1:#95de64',
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="材料运输分布" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <Pie
                    data={(() => {
                      const materialMap = new Map<string, number>()
                      trailerMatchedStats.forEach(item => {
                        const current = materialMap.get(item.material) || 0
                        materialMap.set(item.material, current + item.count)
                      })
                      return Array.from(materialMap.entries()).map(([material, count]) => ({
                        type: material,
                        value: count,
                      }))
                    })()}
                    angleField="value"
                    colorField="type"
                    height={350}
                    radius={0.8}
                    innerRadius={0.6}
                    statistic={{
                      title: {
                        content: '总车次',
                        style: {
                          fontSize: '14px',
                        },
                      },
                      content: {
                        content: trailerMatchedStats.reduce((sum, item) => sum + item.count, 0).toString(),
                        style: {
                          fontSize: '24px',
                          fontWeight: 'bold',
                        },
                      },
                    }}
                    legend={{
                      position: 'bottom',
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: datum.type,
                          value: `${datum?.value || 0} 车次`,
                        }
                      },
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="运输路线热力 TOP5" size="small">
                {trailerMatchedStats.length > 0 ? (
                  <div style={{ padding: '20px 0' }}>
                    {trailerMatchedStats
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map((item, index) => (
                        <div key={item.key} style={{ marginBottom: 24 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>
                              #{index + 1} {item.loadingCompany} → {item.unloadingCompany}
                            </span>
                            <span style={{ fontSize: 14, color: '#1890ff', fontWeight: 'bold' }}>
                              {item.count} 车次
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ 
                              flex: 1, 
                              height: 8, 
                              backgroundColor: '#f0f0f0', 
                              borderRadius: 4,
                              overflow: 'hidden',
                            }}>
                              <div style={{ 
                                width: `${(item.count / trailerMatchedStats[0].count) * 100}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'][index]} 0%, ${['#36cfc9', '#95de64', '#ffd666', '#ff7875', '#b37feb'][index]} 100%)`,
                                borderRadius: 4,
                              }} />
                            </div>
                            <Tag color="blue">{item.material}</Tag>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          {/* 运输任务匹配分析表格 */}
          <Card title="运输任务匹配分析 (装料 -> 卸货) - 详细数据" size="small">
            <Table
              columns={matchedTasksColumns}
              dataSource={trailerMatchedStats}
              rowKey="key"
              scroll={{ x: 1000 }}
            />
          </Card>
        </>
      )}

      {businessType === '罐车' && (
        <>
          {/* 按装料公司统计图表 */}
          <Card title="方量统计 (按装料公司) - 图表" size="small">
            {tankerCompanyStats.length > 0 ? (
              <Column
                data={tankerCompanyStats}
                xField="company"
                yField="totalSettlementVolume"
                height={300}
                label={{
                  position: 'top',
                  style: {
                    fill: '#1890ff',
                    fontSize: 12,
                  },
                  formatter: (datum: any) => datum?.totalSettlementVolume ? `${datum.totalSettlementVolume.toFixed(2)}m³` : '',
                }}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: true,
                  },
                }}
                yAxis={{
                  title: {
                    text: '结算方量(m³)',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: '结算方量',
                      value: `${datum.totalSettlementVolume.toFixed(2)}m³ (${datum.count}车次)`,
                    }
                  },
                }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>

          <Card title="方量统计 (按装料公司) - 详细数据" size="small">
            <Table
              columns={tankerCompanyColumns}
              dataSource={tankerCompanyStats}
              rowKey="company"
              scroll={{ x: 800 }}
            />
          </Card>

          {/* 按司机和车号统计图表 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="方量统计 (按司机) - 图表" size="small">
                {tankerDriverStats.length > 0 ? (
                  <Column
                    data={tankerDriverStats}
                    xField="driver"
                    yField="totalSettlementVolume"
                    height={400}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#1890ff',
                        fontSize: 11,
                      },
                      formatter: (datum: any) => datum?.totalSettlementVolume ? `${datum.totalSettlementVolume.toFixed(2)}m³` : '',
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                        style: {
                          fontSize: 10,
                        },
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '结算方量(m³)',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: datum.driver,
                          value: `${datum?.totalSettlementVolume?.toFixed(2) || 0}m³ (${datum?.count || 0}车次)`,
                        }
                      },
                    }}
                    columnStyle={{
                      radius: [4, 4, 0, 0],
                      fill: 'l(270) 0:#1890ff 1:#36cfc9',
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="方量统计 (按车号) - 图表" size="small">
                {tankerVehicleStats.length > 0 ? (
                  <Column
                    data={tankerVehicleStats}
                    xField="vehicleCode"
                    yField="totalSettlementVolume"
                    height={400}
                    label={{
                      position: 'top',
                      style: {
                        fill: '#52c41a',
                        fontSize: 11,
                      },
                      formatter: (datum: any) => datum?.totalSettlementVolume ? `${datum.totalSettlementVolume.toFixed(2)}m³` : '',
                    }}
                    xAxis={{
                      label: {
                        autoRotate: true,
                        autoHide: true,
                        style: {
                          fontSize: 10,
                        },
                      },
                    }}
                    yAxis={{
                      title: {
                        text: '结算方量(m³)',
                      },
                    }}
                    tooltip={{
                      formatter: (datum: any) => {
                        return {
                          name: datum.vehicleCode,
                          value: `${datum?.totalSettlementVolume?.toFixed(2) || 0}m³ (${datum?.count || 0}车次)`,
                        }
                      },
                    }}
                    columnStyle={{
                      radius: [4, 4, 0, 0],
                      fill: 'l(270) 0:#52c41a 1:#95de64',
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="方量统计 (按司机) - 详细数据" size="small">
                <Table
                  size="small"
                  columns={tankerDriverColumns}
                  dataSource={tankerDriverStats}
                  rowKey="driver"
                  scroll={{ x: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="方量统计 (按车号) - 详细数据" size="small">
                <Table
                  size="small"
                  columns={tankerVehicleColumns}
                  dataSource={tankerVehicleStats}
                  rowKey="vehicleCode"
                  scroll={{ x: 700 }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* 司机和车辆统计 (仅挂车模式) */}
      {businessType === '挂车' && (
      <>
        {/* 司机和车辆统计图表 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="司机统计 - 图表" size="small">
              {driverVehicleStats.byDriver.length > 0 ? (
                <Column
                  data={driverVehicleStats.byDriver}
                  xField="name"
                  yField="totalWeight"
                  height={400}
                  label={{
                    position: 'top',
                    style: {
                      fill: '#1890ff',
                      fontSize: 11,
                    },
                    formatter: (datum: any) => datum?.totalWeight ? `${datum.totalWeight.toFixed(2)}t` : '',
                  }}
                  xAxis={{
                    label: {
                      autoRotate: true,
                      autoHide: true,
                      style: {
                        fontSize: 10,
                      },
                    },
                  }}
                  yAxis={{
                    title: {
                      text: '总重量(t)',
                    },
                  }}
                  tooltip={{
                    formatter: (datum: any) => {
                      return {
                        name: datum.name,
                        value: `${datum?.totalWeight?.toFixed(2) || 0}t (${datum?.totalCount || 0}车次)`,
                      }
                    },
                  }}
                  columnStyle={{
                    radius: [4, 4, 0, 0],
                    fill: 'l(270) 0:#1890ff 1:#36cfc9',
                  }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="车辆统计 - 图表" size="small">
              {driverVehicleStats.byVehicle.length > 0 ? (
                <Column
                  data={driverVehicleStats.byVehicle}
                  xField="name"
                  yField="totalWeight"
                  height={400}
                  label={{
                    position: 'top',
                    style: {
                      fill: '#52c41a',
                      fontSize: 11,
                    },
                    formatter: (datum: any) => datum?.totalWeight ? `${datum.totalWeight.toFixed(2)}t` : '',
                  }}
                  xAxis={{
                    label: {
                      autoRotate: true,
                      autoHide: true,
                      style: {
                        fontSize: 10,
                      },
                    },
                  }}
                  yAxis={{
                    title: {
                      text: '总重量(t)',
                    },
                  }}
                  tooltip={{
                    formatter: (datum: any) => {
                      return {
                        name: datum.name,
                        value: `${datum?.totalWeight?.toFixed(2) || 0}t (${datum?.totalCount || 0}车次)`,
                      }
                    },
                  }}
                  columnStyle={{
                    radius: [4, 4, 0, 0],
                    fill: 'l(270) 0:#52c41a 1:#95de64',
                  }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* 司机和车辆统计表格 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="司机统计 - 详细数据" size="small">
              <Table
                size="small"
                columns={driverStatsColumns}
                dataSource={driverVehicleStats.byDriver}
                rowKey="key"
                scroll={{ x: 800 }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="车辆统计 - 详细数据" size="small">
              <Table
                size="small"
                columns={vehicleStatsColumns}
                dataSource={driverVehicleStats.byVehicle}
                rowKey="key"
                scroll={{ x: 800 }}
              />
            </Card>
          </Col>
        </Row>
      </>
      )}
    </Space>
  )
}

export default ReceiptAnalytics
