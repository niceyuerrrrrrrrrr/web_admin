import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  Progress,
  List,
  ConfigProvider,
  theme,
  Tabs,
  Avatar,
  Tooltip,
} from 'antd'
import { Area, Pie, Column, Bar, DualAxes } from '@ant-design/charts'
import { 
  ReloadOutlined, 
  RiseOutlined, 
  ArrowDownOutlined,
  CarOutlined, 
  UserOutlined, 
  AccountBookOutlined,
  ArrowRightOutlined,
  ThunderboltFilled,
  AuditOutlined,
  AreaChartOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import CompanySelector from '../components/CompanySelector'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import { fetchCEOStatistics } from '../api/services/statistics'
import { fetchManagerStats } from '../api/services/approval'

const { Title, Text } = Typography

// --- 类型定义 ---
type ApprovalStatCard = {
  key: string
  typeName: string
  total: number
  pending: number
  processed: number
  status: { text: string; count: number }[]
}

// --- 工具函数 ---
const formatWeight = (value?: number | string | null) => {
  if (value === null || value === undefined) return '0.00'
  const num = Number(value)
  return Number.isNaN(num) ? '0.00' : num.toFixed(2)
}

const formatVolume = (value?: number | string | null) => {
  if (value === null || value === undefined) return '0.00'
  const num = Number(value)
  return Number.isNaN(num) ? '0.00' : num.toFixed(2)
}

const getDateRange = (timeRange: string) => {
  const now = dayjs()
  switch (timeRange) {
    case 'today': return { beginDate: now.startOf('day').format('YYYY-MM-DD'), endDate: now.endOf('day').format('YYYY-MM-DD') }
    case 'week': return { beginDate: now.startOf('week').format('YYYY-MM-DD'), endDate: now.endOf('week').format('YYYY-MM-DD') }
    case 'year': return { beginDate: now.startOf('year').format('YYYY-MM-DD'), endDate: now.endOf('year').format('YYYY-MM-DD') }
    case 'month': default: return { beginDate: now.startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') }
  }
}

// --- 样式组件 ---
const DashboardCard = ({ title, children, extra, style }: { title: string, children: React.ReactNode, extra?: React.ReactNode, style?: React.CSSProperties }) => (
  <Card 
    title={<span style={{ fontSize: 16, fontWeight: 600, color: '#00b96b', letterSpacing: 0.5 }}>{title}</span>} 
    bordered={false}
    extra={extra}
    style={{ height: '100%', background: '#1f1f1f', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', ...style }}
    headStyle={{ borderBottom: '1px solid #303030', minHeight: 48 }}
    bodyStyle={{ padding: 20, height: 'calc(100% - 48px)', overflow: 'hidden', overflowY: 'auto' }}
  >
    {children}
  </Card>
)

const KPICard = ({ title, value, suffix, icon, color, trend }: { title: string, value: string | number, suffix?: string, icon: React.ReactNode, color: string, trend?: number }) => (
  <div style={{ 
    background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`, 
    padding: '24px', 
    borderRadius: 12, 
    border: `1px solid ${color}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 100,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: `0 4px 12px ${color}10`
  }}>
    <div style={{ zIndex: 1 }}>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', lineHeight: 1, fontFamily: 'Helvetica Neue' }}>
        {value} <span style={{ fontSize: 14, fontWeight: 'normal', color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>{suffix}</span>
      </div>
      {trend !== undefined && (
        <div style={{ fontSize: 12, color: trend >= 0 ? '#ff4d4f' : '#52c41a', marginTop: 8, display: 'flex', alignItems: 'center' }}>
          {trend >= 0 ? <RiseOutlined style={{ marginRight: 4 }}/> : <ArrowDownOutlined style={{ marginRight: 4 }}/>}
          {Math.abs(trend)}% 环比
        </div>
      )}
    </div>
    <div style={{ 
      width: 56, height: 56, borderRadius: '50%', 
      background: `${color}20`, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28,
      backdropFilter: 'blur(4px)'
    }}>
      {icon}
    </div>
    {/* 装饰背景 */}
    <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, background: `${color}10`, borderRadius: '50%', filter: 'blur(20px)' }} />
  </div>
)

// 进度条排行榜项
const RankItem = ({ rank, name, value, unit, max, color = '#1890ff' }: { rank: number, name: string, value: number, unit: string, max: number, color?: string }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ 
          width: 20, height: 20, borderRadius: 4, 
          background: rank <= 3 ? color : '#333', color: '#fff',
          textAlign: 'center', lineHeight: '20px', fontSize: 12, fontWeight: 'bold'
        }}>{rank}</div>
        <Text style={{ color: 'rgba(255,255,255,0.9)', width: 140 }} ellipsis={{ tooltip: name }}>{name}</Text>
      </div>
      <Text style={{ color: color, fontWeight: 'bold' }}>{value} {unit}</Text>
    </div>
    <Progress percent={(value / max) * 100} showInfo={false} strokeColor={color} trailColor="#333" size="small" />
  </div>
)

const DashboardPage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()
  const [timeRange, setTimeRange] = useState<string>('month')

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const shouldLoad = !isSuperAdmin || !!selectedCompanyId
  const { beginDate, endDate } = useMemo(() => getDateRange(timeRange), [timeRange])

  const ceoStatsQuery = useQuery({
    queryKey: ['data-screen-ceo', timeRange, effectiveCompanyId],
    queryFn: () => fetchCEOStatistics({ timeRange, companyId: effectiveCompanyId }),
    enabled: shouldLoad,
  })

  const approvalStatsQuery = useQuery({
    queryKey: ['data-screen-approvals', beginDate, endDate, effectiveCompanyId],
    queryFn: () => fetchManagerStats({ beginDate, endDate, companyId: effectiveCompanyId }),
    enabled: shouldLoad,
  })

  const statsData = ceoStatsQuery.data
  const transportDetails = statsData?.transportDetails
  const businessType = transportDetails?.businessType

  // --- 数据处理 ---
  const kpis = useMemo(() => {
    const op = statsData?.operation || {}
    const personnel = statsData?.personnel || {}
    const finance = statsData?.kpi || {}
    
    const baseKpis = [
      { title: '运输订单总数', value: op.totalOrders || 0, suffix: '单', icon: <AccountBookOutlined />, color: '#1890ff', trend: finance.ordersTrend },
    ]

    if (businessType === '罐车') {
      const summary = transportDetails?.tanker?.summary || {}
      // 罐车模式：显示方量而非重量
      // 总方量 (concrete_volume)
      baseKpis.push({
        title: '总运输方量',
        value: formatVolume(summary.totalConcreteVolume || summary.totalVolume),
        suffix: 'm³',
        icon: <AreaChartOutlined />,
        color: '#13c2c2',
        trend: undefined,
      })
      // 总结算方量 (settlement_volume) - 后端的 totalWeight 实际存储的是这个值
      baseKpis.push({
        title: '总结算方量',
        value: formatVolume(summary.totalSettlementVolume || op.totalWeight),
        suffix: 'm³',
        icon: <AreaChartOutlined />,
        color: '#722ed1',
        trend: undefined,
      })
    } else {
      // 非罐车模式：显示重量
      baseKpis.push({
        title: '总运输重量',
        value: op.totalWeight ? Number(op.totalWeight).toFixed(1) : '0.0',
        suffix: '吨',
        icon: <RiseOutlined />,
        color: '#00b96b',
        trend: undefined,
      })
    }

    // 挂车模式特有指标：磅差
    if (businessType === '挂车' && transportDetails?.trailer?.matched?.byCompanyPair) {
      const matched = transportDetails.trailer.matched.byCompanyPair
      const totalDiff = matched.reduce((sum: number, item: any) => sum + (item.totalDiff || 0), 0)
      
      baseKpis.push({
        title: '累计磅差',
        value: totalDiff > 0 ? `+${formatWeight(totalDiff)}` : formatWeight(totalDiff),
        suffix: '吨',
        icon: <ThunderboltFilled />,
        color: totalDiff < 0 ? '#ff4d4f' : '#52c41a', // 亏吨显示红色警告，盈吨显示绿色
        trend: undefined
      })
    } else if (businessType !== '罐车') {
      // 非罐车、非挂车匹配模式显示车辆使用率
      baseKpis.push({ 
        title: '车辆使用率', 
        value: op.vehicleUtilization || 0, 
        suffix: '%', 
        icon: <CarOutlined />, 
        color: '#722ed1',
        trend: undefined
      })
    }

    // 最后一个指标：司机出勤率
    baseKpis.push({ title: '司机出勤率', value: personnel.attendanceRate || 0, suffix: '%', icon: <UserOutlined />, color: '#fa8c16', trend: undefined })

    return baseKpis
  }, [statsData, businessType, transportDetails])

  const approvalCards: ApprovalStatCard[] = useMemo(() => {
    const types = approvalStatsQuery.data?.types || []
    const order = ['reimbursement', 'leave', 'report', 'material', 'purchase']
    
    return [...types]
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((item) => {
        // 解析状态，计算待办和已办
        let pending = 0
        let processed = 0
        let approved = 0
        let rejected = 0
        
        item.status?.forEach((s: any) => {
          // 根据后端返回的状态文本或key判断
          if (s.text === '待审批' || s.text === '待处理' || s.status === 'pending') {
            pending += s.count
          } else {
            processed += s.count
            if (s.text === '已通过' || s.text === '已完成' || s.status === 'approved') {
              approved += s.count
            } else if (s.text === '已拒绝' || s.text === '已驳回' || s.status === 'rejected') {
              rejected += s.count
            }
          }
        })

        return {
          key: item.key,
          typeName: item.type_name,
          total: item.total,
          pending,
          processed,
          approved,
          rejected,
          status: item.status || [],
        }
      })
  }, [approvalStatsQuery.data])

  // 准备成本数据（过滤掉 0 值）
  const costChartData = useMemo(() => {
    const breakdown = statsData?.business?.costBreakdown || {}
    return Object.entries(breakdown)
      .map(([k, v]: any) => ({
        type: k === 'salary' ? '人工' : k === 'charging' ? '电费' : '报销',
        value: Number(v.amount || 0)
      }))
      .filter(item => item.value > 0)
  }, [statsData])

  // 辅助函数：预处理饼图数据，添加显示标签
  const processPieData = (data: any[]) => {
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    return data.map(item => ({
      ...item,
      displayLabel: `${item.type}: ${total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%`
    }));
  };

  // --- 渲染辅助: 罐车视图 (图形化) ---
  const renderTankerContent = () => {
    const tanker = transportDetails?.tanker
    if (!tanker) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />

    const { loadingByCompany = [], loadingByMaterial = [], waterTickets = {} } = tanker
    const waterTicketList = waterTickets.byCompany || []

    // 图表数据转换 - 分组柱状图：方量 vs 结算方量
    // 先按公司聚合，然后根据总方量排序
    const companyDataMap = new Map<string, { concrete: number, settlement: number }>()
    loadingByCompany.forEach((i: any) => {
      const company = i.company || i.name || '未知公司'
      const concrete = Number(i.totalConcreteVolume || i.totalVolume || i.weight || 0)
      const settlement = Number(i.totalSettlementVolume || 0)
      companyDataMap.set(company, { concrete, settlement })
    })
    
    // 按结算方量排序并展平为图表数据
    const sortedCompanies = Array.from(companyDataMap.entries())
      .sort((a, b) => b[1].settlement - a[1].settlement)
    
    const companyChartData = sortedCompanies.flatMap(([company, data]) => [
      { company, category: '本车方量', value: data.concrete },
      { company, category: '结算方量', value: data.settlement },
    ])

    // 饼图数据：各装料公司结算方量占比
    const rawCompanyPieData = (loadingByCompany || [])
      .map((i: any) => ({
        type: i.company || i.name || '未知公司',
        value: Number(i.totalSettlementVolume || i.totalVolume || i.weight || 0),
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
    const companyPieData = processPieData(rawCompanyPieData)

    return (
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <DashboardCard title="各公司方量 vs 结算方量对比">
            {companyChartData.length > 0 ? (
              <Column 
                {...{
                  data: companyChartData,
                  xField: 'company',
                  yField: 'value',
                  seriesField: 'category',
                  isGroup: true,
                  // 显式指定颜色字段和颜色序列（兼容 @ant-design/charts 2.x）
                  colorField: 'category',
                  color: ['#1890ff', '#fa541c'], // 本车方量=蓝，结算方量=红
                  meta: {
                    category: {
                      values: ['本车方量', '结算方量'], // 固定顺序，确保颜色稳定
                    },
                  },
                  xAxis: { 
                    label: { 
                      autoRotate: true, 
                      autoHide: false, 
                      style: { fill: '#fff', fontSize: 12 } 
                    } 
                  },
                  yAxis: { 
                    label: { style: { fill: '#fff' } },
                    title: { text: '方量 (m³)', style: { fill: '#fff' } }
                  },
                  label: { 
                    position: 'top' as const,
                    offset: 4,
                    style: { fill: '#fff', fontWeight: 'bold', fontSize: 11 },
                    formatter: (datum: any) => {
                      return datum.value > 0 ? `${datum.value.toFixed(1)}` : ''
                    }
                  },
                  legend: { 
                    position: 'top-right' as const,
                    itemName: {
                      style: { fill: '#fff', fontSize: 13 }
                    }
                  },
                  tooltip: {
                    formatter: (datum: any) => ({
                      name: datum.category,
                      value: `${datum.value.toFixed(2)} m³`
                    })
                  },
                  theme: 'dark' as const,
                  height: 280,
                  autoFit: true
                }}
              />
            ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </DashboardCard>
        </Col>
        <Col xs={24} lg={10}>
          <DashboardCard title="各公司结算方量占比">
             {companyPieData.length > 0 ? (
               <Pie 
                data={companyPieData} 
                angleField="value" 
                colorField="type" 
                radius={0.8} 
                innerRadius={0.6}
                label={{
                  position: 'outside',
                  style: { fill: '#fff', fontWeight: 'bold' },
                  connector: true,
                  text: (item: any) => {
                    // G2 把原始数据挂在 item.data 上，优先使用我们预处理好的 displayLabel
                    const dataItem = item.data || item;
                    if (dataItem?.displayLabel) return dataItem.displayLabel;
                    if (!dataItem || !dataItem.type) return '';
                    const total = companyPieData.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
                    const percent = total > 0 ? ((dataItem.value / total) * 100).toFixed(0) : '0';
                    return `${dataItem.type}: ${percent}%`;
                  },
                }}
                theme="dark"
                legend={{ position: 'bottom' }}
                color={['#00b96b', '#1890ff', '#fa8c16', '#722ed1', '#eb2f96']}
                height={240}
                autoFit
               />
             ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </DashboardCard>
        </Col>
        <Col span={24}>
          <DashboardCard title={`水票统计 (总计: ${waterTickets.total || 0} 张)`}>
             <Row gutter={48}>
                {waterTicketList.length > 0 ? waterTicketList.map((item: any, idx: number) => (
                  <Col xs={24} md={12} lg={8} key={idx}>
                    <RankItem 
                      rank={idx + 1} 
                      name={item.company} 
                      value={item.count} 
                      unit="张" 
                      max={Math.max(...waterTicketList.map((i:any)=>i.count))} 
                      color="#00b96b"
                    />
                  </Col>
                )) : <Empty description="暂无水票数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
             </Row>
          </DashboardCard>
        </Col>
      </Row>
    )
  }

  // --- 渲染辅助: 挂车视图 (图形化) ---
  const renderTrailerContent = () => {
    const trailer = transportDetails?.trailer
    if (!trailer) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    
    const { loading = {}, unloading = {}, matched = {} } = trailer
    const matchedPairs = matched.byCompanyPair || []
    const matchedMaterials = matched.byMaterial || []
    
    // 准备材料分布数据
    const rawLoadingMaterials = (loading.byMaterial || [])
      .map((i: any) => ({
        type: i.material || i.name || i.material_name || '未知材料',
        value: Number(i.totalWeight || i.weight || i.totalVolume || 0),
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
    const loadingMaterials = processPieData(rawLoadingMaterials)
    
    const rawUnloadingMaterials = (unloading.byMaterial || [])
      .map((i: any) => ({
        type: i.material || i.name || i.material_name || '未知材料',
        value: Number(i.totalWeight || i.weight || i.totalVolume || 0),
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
    const unloadingMaterials = processPieData(rawUnloadingMaterials)

    // 运输匹配 - 卡片化展示
    const renderMatchedCards = () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {matchedPairs.length > 0 ? matchedPairs.map((pair: any, idx: number) => (
           <div key={idx} style={{ background: '#262626', borderRadius: 8, padding: 16, borderLeft: `4px solid #1890ff` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                 <Space>
                    <Tag color="blue">路线 {idx + 1}</Tag>
                    <Text style={{ color: '#fff', fontSize: 15 }}>{pair.loadingCompany}</Text>
                    <ArrowRightOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />
                    <Text style={{ color: '#fff', fontSize: 15 }}>{pair.unloadingCompany}</Text>
                 </Space>
                 <Statistic value={pair.transportCount} suffix="单" valueStyle={{ color: '#1890ff', fontSize: 18 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#141414', padding: '10px', borderRadius: 6 }}>
                 <div>
                   <div style={{ fontSize: 12, color: '#8c8c8c' }}>装料重</div>
                   <div style={{ color: '#fff', fontWeight: 'bold' }}>{formatWeight(pair.totalLoadingWeight)} t</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 12, color: '#8c8c8c' }}>卸货重</div>
                   <div style={{ color: '#fff', fontWeight: 'bold' }}>{formatWeight(pair.totalUnloadingWeight)} t</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 12, color: '#8c8c8c' }}>总磅差</div>
                   <div style={{ color: pair.totalDiff < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
                     {pair.totalDiff > 0 ? '+' : ''}{formatWeight(pair.totalDiff)} t
                   </div>
                 </div>
                 <div>
                   <div style={{ fontSize: 12, color: '#8c8c8c' }}>平均磅差</div>
                   <div style={{ color: pair.avgDiff < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
                     {pair.avgDiff > 0 ? '+' : ''}{formatWeight(pair.avgDiff)} t
                   </div>
                 </div>
              </div>
           </div>
        )) : <Empty description="暂无匹配数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </div>
    )

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Tabs 
          type="card" 
          defaultActiveKey="matched" 
          items={[
            {
              key: 'matched',
              label: <span><ThunderboltFilled /> 核心匹配分析</span>,
              children: (
                 <Row gutter={[24, 24]}>
                    <Col xs={24} lg={14}>
                      <DashboardCard title="热门运输路线 (Top 5)">
                         {renderMatchedCards()}
                      </DashboardCard>
                    </Col>
                    <Col xs={24} lg={10}>
                      <DashboardCard title="按材料匹配 (磅差分析)">
                         {matchedMaterials.map((m: any, idx: number) => (
                           <div key={idx} style={{ marginBottom: 20 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#fff' }}>{m.material}</Text>
                                <Text style={{ color: m.avgDiff < 0 ? '#ff4d4f' : '#52c41a' }}>平均磅差: {formatWeight(m.avgDiff)} t</Text>
                              </div>
                              <Tooltip title={`装: ${m.totalLoadingWeight}t / 卸: ${m.totalUnloadingWeight}t`}>
                                <Progress 
                                  percent={100} 
                                  success={{ percent: (m.totalUnloadingWeight / Math.max(m.totalLoadingWeight, m.totalUnloadingWeight)) * 100, strokeColor: '#52c41a' }} 
                                  strokeColor="#ff4d4f" // 实际上代表装料重（如果有亏吨，红条会露出来）
                                  showInfo={false} 
                                  size="small"
                                  trailColor="#333"
                                />
                              </Tooltip>
                           </div>
                         ))}
                         {matchedMaterials.length === 0 && <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                      </DashboardCard>
                    </Col>
                 </Row>
              )
            },
            {
              key: 'loading',
              label: '装料分析',
              children: (
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={14}>
                    <DashboardCard title="装料公司排行 (Top 10)">
                      {(loading.byCompany || []).slice(0, 10).map((item: any, idx: number) => (
                        <RankItem 
                          key={idx}
                          rank={idx + 1} 
                          name={item.company} 
                          value={item.totalWeight} 
                          unit="吨" 
                          max={Math.max(...loading.byCompany.map((i:any)=>i.totalWeight))}
                          color="#1890ff"
                        />
                      ))}
                    </DashboardCard>
                  </Col>
                  <Col xs={24} lg={10}>
                    <DashboardCard title="装料材料占比">
                       {loadingMaterials.length > 0 ? (
                         <Pie 
                          data={loadingMaterials} 
                          angleField="value" 
                          colorField="type" 
                          radius={0.8} 
                          innerRadius={0.6}
                          label={{
                            position: 'outside',
                            style: { fill: '#fff', fontWeight: 'bold' },
                            connector: true,
                            text: (item: any) => {
                              const dataItem = item.data || item;
                              if (!dataItem || !dataItem.type) return '';
                              const total = loadingMaterials.reduce((sum: number, d: any) => sum + d.value, 0);
                              const percent = total > 0 ? ((dataItem.value / total) * 100).toFixed(0) : '0';
                              return `${dataItem.type}: ${percent}%`;
                            }
                          }}
                          theme="dark"
                          legend={{ position: 'bottom' }}
                          color={['#1890ff', '#00b96b', '#fa8c16', '#722ed1', '#eb2f96']}
                          height={240}
                          autoFit
                         />
                       ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                    </DashboardCard>
                  </Col>
                </Row>
              )
            },
            {
              key: 'unloading',
              label: '卸货分析',
              children: (
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={14}>
                    <DashboardCard title="卸货公司排行 (Top 10)">
                      {(unloading.byCompany || []).slice(0, 10).map((item: any, idx: number) => (
                        <RankItem 
                          key={idx}
                          rank={idx + 1} 
                          name={item.company} 
                          value={item.totalWeight} 
                          unit="吨" 
                          max={Math.max(...unloading.byCompany.map((i:any)=>i.totalWeight))}
                          color="#722ed1"
                        />
                      ))}
                    </DashboardCard>
                  </Col>
                  <Col xs={24} lg={10}>
                    <DashboardCard title="卸货材料占比">
                       {unloadingMaterials.length > 0 ? (
                         <Pie 
                          data={unloadingMaterials} 
                          angleField="value" 
                          colorField="type" 
                          radius={0.8} 
                          innerRadius={0.6}
                          label={{
                            position: 'outside',
                            style: { fill: '#fff', fontWeight: 'bold' },
                            connector: true,
                            text: (item: any) => {
                              const dataItem = item.data || item;
                              if (!dataItem || !dataItem.type) return '';
                              const total = unloadingMaterials.reduce((sum: number, d: any) => sum + d.value, 0);
                              const percent = total > 0 ? ((dataItem.value / total) * 100).toFixed(0) : '0';
                              return `${dataItem.type}: ${percent}%`;
                            }
                          }}
                          theme="dark"
                          legend={{ position: 'bottom' }}
                          color={['#722ed1', '#fa8c16', '#00b96b', '#1890ff', '#eb2f96']}
                          height={240}
                          autoFit
                         />
                       ) : <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                    </DashboardCard>
                  </Col>
                </Row>
              )
            }
          ]} 
        />
      </Space>
    )
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00b96b',
          colorBgContainer: '#1f1f1f',
          colorBgLayout: '#000000',
        },
      }}
    >
      <div style={{ padding: 24, minHeight: '100vh', background: '#000', margin: -24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#00b96b' }}>LOGI</span> 运营指挥中心
              {businessType && <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px' }}>{businessType}模式</Tag>}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.45)' }}>{dayjs().format('YYYY年MM月DD日 dddd')} | 实时监控物流运输、成本与人员效率</Text>
          </div>
          <Space>
            <Select
              value={timeRange}
              onChange={setTimeRange}
              options={[
                { label: '今日', value: 'today' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' },
                { label: '本年', value: 'year' },
              ]}
              style={{ width: 120 }}
              bordered={false}
              className="glass-select"
              dropdownStyle={{ background: '#1f1f1f' }}
            />
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['data-screen-ceo'] })
                queryClient.invalidateQueries({ queryKey: ['data-screen-approvals'] })
              }}
              ghost
            >
              刷新
            </Button>
            {isSuperAdmin && (
              <CompanySelector value={selectedCompanyId} onChange={setSelectedCompanyId} />
            )}
          </Space>
        </div>

        <Spin spinning={ceoStatsQuery.isLoading && shouldLoad}>
          {/* 1. 核心 KPI */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            {kpis.map((kpi, idx) => (
              <Col xs={24} sm={12} md={6} key={idx}>
                <KPICard {...kpi} />
              </Col>
            ))}
          </Row>

          {/* 2. 核心运输数据 (业务视图) */}
          <div style={{ marginBottom: 24 }}>
            {businessType === '罐车' ? renderTankerContent() : 
             businessType === '挂车' ? renderTrailerContent() : 
             <div style={{ padding: 40, textAlign: 'center', background: '#1f1f1f', borderRadius: 8 }}>
               <Empty description={<span style={{ color: '#fff' }}>请选择公司或该类公司无业务类型定义</span>} />
             </div>
            }
          </div>

          {/* 3. 辅助模块 */}
          <Row gutter={[24, 24]}>
            {/* 充电数据 */}
            <Col xs={24} md={8}>
              <DashboardCard title="充电成本分析">
                 <div style={{ height: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Row gutter={[16, 24]}>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>总充电量</span>}
                           value={statsData?.business?.chargingStats?.totalVolume || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 14 }}>kWh</span>}
                           valueStyle={{ color: '#1890ff', fontSize: 20, fontWeight: 'bold' }}
                         />
                      </Col>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>总金额</span>}
                           value={statsData?.business?.chargingStats?.totalAmount || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 14 }}>元</span>}
                           valueStyle={{ color: '#1890ff', fontSize: 20, fontWeight: 'bold' }}
                         />
                      </Col>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>平均单次</span>}
                           value={statsData?.business?.chargingStats?.avgAmount || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 12 }}>元</span>}
                           valueStyle={{ color: '#fff', fontSize: 18 }}
                         />
                      </Col>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>平均单价</span>}
                           value={statsData?.business?.chargingStats?.avgPrice || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 12 }}>元/度</span>}
                           valueStyle={{ color: '#fff', fontSize: 18 }}
                         />
                      </Col>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>最高单价</span>}
                           value={statsData?.business?.chargingStats?.maxPrice || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 12 }}>元/度</span>}
                           valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
                         />
                      </Col>
                      <Col span={12}>
                         <Statistic 
                           title={<span style={{ color: 'rgba(255,255,255,0.45)' }}>最低单价</span>}
                           value={statsData?.business?.chargingStats?.minPrice || 0}
                           precision={2}
                           suffix={<span style={{ fontSize: 12 }}>元/度</span>}
                           valueStyle={{ color: '#52c41a', fontSize: 16 }}
                         />
                      </Col>
                    </Row>
                 </div>
              </DashboardCard>
            </Col>

            {/* 审批数据 */}
            <Col xs={24} md={8}>
              <DashboardCard title="待办审批">
                 <div style={{ height: 220, overflowY: 'auto' }}>
                   {approvalCards.map((item) => (
                     <div key={item.key} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#262626', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar style={{ backgroundColor: '#1890ff' }} icon={<AuditOutlined />} size="small" />
                          <Text style={{ color: '#fff' }}>{item.typeName}</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                           <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>{item.pending}</div>
                           <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>待处理</div>
                        </div>
                     </div>
                   ))}
                 </div>
              </DashboardCard>
            </Col>

             {/* 资源概览 */}
             <Col xs={24} md={8}>
              <DashboardCard title="资源状态">
                 <Row gutter={[12, 24]} style={{ marginTop: 12 }}>
                   <Col span={12}>
                     <Statistic title="车辆总数" value={statsData?.operation?.totalVehicles || 0} valueStyle={{ color: '#fff' }} suffix="台" />
                   </Col>
                   <Col span={12}>
                     <Statistic title="故障待处理" value={statsData?.operation?.faultCount || 0} valueStyle={{ color: '#ff4d4f' }} suffix="起" />
                   </Col>
                   <Col span={12}>
                     <Statistic title="在岗司机" value={statsData?.personnel?.totalDrivers || 0} valueStyle={{ color: '#fff' }} suffix="人" />
                   </Col>
                   <Col span={12}>
                     <Statistic title="今日迟到" value={statsData?.personnel?.todayLateCount || 0} valueStyle={{ color: '#fa8c16' }} suffix="人" />
                   </Col>
                 </Row>
              </DashboardCard>
            </Col>
          </Row>
        </Spin>
      </div>
    </ConfigProvider>
  )
}

export default DashboardPage
