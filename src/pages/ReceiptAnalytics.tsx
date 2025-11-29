import { useMemo, useState } from 'react'
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
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fetchReceipts } from '../api/services/receipts'
import { fetchUsers } from '../api/services/users'
import { fetchCompanyDetail } from '../api/services/companies'
import { fetchCEOStatistics } from '../api/services/statistics'
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
  totalWeight: number
  maxWeight: number
  minWeight: number
  avgWeight: number
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
  }>({})
  
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')

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

  const usersQuery = useQuery({
    queryKey: ['users', 'list', effectiveCompanyId],
    queryFn: () => fetchUsers({ size: 1000 }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })
  const users = usersQuery.data?.items || []

  const allReceiptsQuery = useQuery<Receipt[]>({
    queryKey: ['receipts', 'analytics', filters, effectiveCompanyId],
    queryFn: () =>
      fetchReceipts({
        userId: filters.userId,
        receiptType: undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const receipts = allReceiptsQuery.data || []

  // Filter receipts in memory by vehicle and driver name
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (vehicleFilter && !r.vehicle_no?.toLowerCase().includes(vehicleFilter.toLowerCase())) return false
      if (driverFilter && !(r as any).driver_name?.toLowerCase().includes(driverFilter.toLowerCase())) return false
      return true
    })
  }, [receipts, vehicleFilter, driverFilter])

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
  // Tanker (罐车) Statistics Logic
  // ----------------------------------------------------------------
  const tankerStats = useMemo(() => {
    if (businessType !== '罐车') return []

    const loadingReceipts = filteredReceipts.filter(r => r.type === 'loading') as LoadingReceipt[]
    const companyMap = new Map<string, { weights: number[] }>()

    loadingReceipts.forEach(r => {
      const company = r.company || '未知公司'
      if (!companyMap.has(company)) {
        companyMap.set(company, { weights: [] })
      }
      companyMap.get(company)!.weights.push(Number(r.net_weight || 0))
    })

    return Array.from(companyMap.entries()).map(([company, { weights }]) => {
      const count = weights.length
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      return {
        company,
        count,
        totalWeight,
        maxWeight: Math.max(...weights),
        minWeight: Math.min(...weights),
        avgWeight: count > 0 ? totalWeight / count : 0
      } as TankerCompanyStats
    })
  }, [filteredReceipts, businessType])


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

  const tankerColumns: ColumnsType<TankerCompanyStats> = [
    { title: '装料公司', dataIndex: 'company' },
    { title: '总车次', dataIndex: 'count', sorter: (a, b) => a.count - b.count },
    { title: '总重量(t)', dataIndex: 'totalWeight', render: v => v?.toFixed(2), sorter: (a, b) => a.totalWeight - b.totalWeight },
    { title: '最大重量(t)', dataIndex: 'maxWeight', render: v => v?.toFixed(2) },
    { title: '最小重量(t)', dataIndex: 'minWeight', render: v => v?.toFixed(2) },
    { title: '平均重量(t)', dataIndex: 'avgWeight', render: v => v?.toFixed(2) },
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
            style={{ width: 150 }}
            placeholder="选择用户(司机)"
            value={filters.userId}
            onChange={(val) => setFilters(prev => ({ ...prev, userId: val }))}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={users.map((user) => ({
              value: user.id,
              label: user.name || user.nickname || `用户${user.id}`,
            }))}
          />

          <Input 
            placeholder="车牌号" 
            style={{ width: 120 }} 
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            allowClear
          />

          <Input 
            placeholder="司机姓名(模糊)" 
            style={{ width: 120 }} 
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            allowClear
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

      {businessType === '挂车' && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="装料单统计 (按材料)" size="small">
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
              <Card title="卸货单统计 (按材料)" size="small">
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

          <Card title="运输任务匹配分析 (装料 -> 卸货)" size="small">
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
        <Card title="装料统计 (按公司)" size="small">
          <Table
            columns={tankerColumns}
            dataSource={tankerStats}
            rowKey="company"
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      {/* 司机和车辆统计 (所有模式通用，但列会根据模式动态调整) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="司机统计" size="small">
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
          <Card title="车辆统计" size="small">
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
    </Space>
  )
}

export default ReceiptAnalytics
