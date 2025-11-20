import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { Column, Line } from '@ant-design/charts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCEOStatistics,
  fetchDriverStatistics,
  fetchFleetManagerStatistics,
  fetchStatisticianStatistics,
} from '../api/services/statistics'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph } = Typography

const StatisticsPage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore() // 从全局状态读取
  const [timeRange, setTimeRange] = useState<string>('month')

  // 根据用户角色选择统计API
  const getStatisticsQuery = () => {
    const positionType = (user as any)?.position_type || ''
    const role = (user as any)?.role || ''
    const roleKey = role || positionType

    if (roleKey === 'super_admin' || positionType === '超级管理员' || positionType === '总经理') {
      return useQuery({
        queryKey: ['statistics', 'ceo', timeRange, selectedCompanyId],
        queryFn: () => fetchCEOStatistics({ timeRange, companyId: selectedCompanyId }),
      })
    } else if (positionType === '车队长') {
      return useQuery({
        queryKey: ['statistics', 'fleet-manager', timeRange],
        queryFn: () => fetchFleetManagerStatistics({ timeRange }),
      })
    } else if (positionType === '统计' || positionType === '统计员') {
      return useQuery({
        queryKey: ['statistics', 'statistician', timeRange],
        queryFn: () => fetchStatisticianStatistics({ timeRange }),
      })
    } else {
      return useQuery({
        queryKey: ['statistics', 'driver', timeRange],
        queryFn: () => fetchDriverStatistics({ timeRange }),
      })
    }
  }

  const statisticsQuery = getStatisticsQuery()
  const statsData = statisticsQuery.data as any

  // 实时数据看板 - 核心指标
  const kpiCards = useMemo(() => {
    if (!statsData) return []
    
    const cards = []
    
    // CEO/总经理视图 - 使用 kpi 字段
    if (statsData.kpi) {
      cards.push({
        title: '运单数',
        value: statsData.kpi.orders || 0,
        prefix: <FileTextOutlined />,
        suffix: statsData.kpi.ordersTrend !== undefined ? (
          <span style={{ fontSize: 12, color: statsData.kpi.ordersTrend >= 0 ? '#3f8600' : '#cf1322' }}>
            {statsData.kpi.ordersTrend >= 0 ? '+' : ''}{statsData.kpi.ordersTrend?.toFixed(1)}%
          </span>
        ) : null,
      })
      
      cards.push({
        title: '收入(元)',
        value: (statsData.kpi.revenue || 0).toLocaleString(),
        prefix: <DollarOutlined />,
        suffix: statsData.kpi.revenueTrend !== undefined ? (
          <span style={{ fontSize: 12, color: statsData.kpi.revenueTrend >= 0 ? '#3f8600' : '#cf1322' }}>
            {statsData.kpi.revenueTrend >= 0 ? '+' : ''}{statsData.kpi.revenueTrend?.toFixed(1)}%
          </span>
        ) : null,
      })
      
      cards.push({
        title: '利润(元)',
        value: (statsData.kpi.profit || 0).toLocaleString(),
        prefix: <DollarOutlined />,
        suffix: statsData.kpi.profitRate !== undefined ? (
          <span style={{ fontSize: 12 }}>
            利润率 {statsData.kpi.profitRate?.toFixed(1)}%
          </span>
        ) : null,
      })
      
      if (statsData.personnel?.attendanceRate !== undefined) {
        cards.push({
          title: '出勤率',
          value: (statsData.personnel.attendanceRate || 0).toFixed(1),
          prefix: <ClockCircleOutlined />,
          suffix: '%',
        })
      }
    } 
    // 旧的数据结构兼容（如果有 summary 字段）
    else if (statsData.summary) {
      if (statsData.summary.orders) {
        cards.push({
          title: '运单数',
          value: statsData.summary.orders.current || 0,
          prefix: <FileTextOutlined />,
        })
      }
      
      if (statsData.summary.weight) {
        cards.push({
          title: '运输重量(吨)',
          value: (statsData.summary.weight.current || 0).toFixed(1),
          prefix: <TruckOutlined />,
        })
      }
      
      if (statsData.summary.income) {
        cards.push({
          title: '收入(元)',
          value: (statsData.summary.income.current || 0).toLocaleString(),
          prefix: <DollarOutlined />,
        })
      }
    }
    // 司机视图
    else if (statsData.orders) {
      cards.push({
        title: '运单数',
        value: statsData.orders.current || 0,
        prefix: <FileTextOutlined />,
      })
      
      if (statsData.weight) {
        cards.push({
          title: '运输重量(吨)',
          value: (statsData.weight.current || 0).toFixed(1),
          prefix: <TruckOutlined />,
        })
      }
    }
    
    return cards
  }, [statsData])

  // 票据统计图表数据
  const receiptChartData = useMemo(() => {
    if (!statsData) return []
    
    // 使用 operation 字段构建图表数据
    if (statsData.operation) {
      return [
        { type: '运单数', value: statsData.operation.totalOrders || 0 },
        { type: '运输重量(吨)', value: parseFloat((statsData.operation.totalWeight || 0).toFixed(1)) },
      ]
    }
    
    return []
  }, [statsData])

  // 考勤统计图表数据
  const attendanceChartData = useMemo(() => {
    if (!statsData || !statsData.personnel) return []
    
    // 使用 personnel 字段构建考勤数据
    return [
      { name: '出勤率', value: statsData.personnel.attendanceRate || 0 },
      { name: '迟到次数', value: statsData.personnel.lateCount || 0 },
      { name: '总司机数', value: statsData.personnel.totalDrivers || 0 },
    ]
  }, [statsData])

  // 能耗统计图表数据
  const energyChartData = useMemo(() => {
    if (!statsData || !statsData.business) return []
    
    // 从 business.costBreakdown 提取能耗数据
    const costBreakdown = statsData.business.costBreakdown || {}
    return [
      { type: '充电费用', value: costBreakdown.charging || 0 },
      { type: '报销费用', value: costBreakdown.reimbursement || 0 },
      { type: '人工成本', value: costBreakdown.salary || 0 },
    ]
  }, [statsData])

  // 司机排行榜数据
  const driverRankingData = useMemo(() => {
    if (!statsData || !statsData.topDrivers) return []
    
    return statsData.topDrivers.slice(0, 10).map((driver: any, index: number) => ({
      rank: index + 1,
      name: driver.name || driver.driver_name || '未知',
      orders: driver.orders || driver.order_count || 0,
      weight: parseFloat((driver.weight || driver.total_weight || 0).toFixed(1)),
    }))
  }, [statsData])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            数据统计大屏
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            实时数据看板、审批统计、票据统计、考勤统计等综合分析。
          </Paragraph>
        </div>
        <Space>
          <Select
            style={{ width: 120 }}
            value={timeRange}
            onChange={setTimeRange}
            options={[
              { value: 'today', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
              { value: 'year', label: '本年' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['statistics'] })}
          >
            刷新
          </Button>
        </Space>
      </Flex>

      {/* 错误提示 */}
      {statisticsQuery.error && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          description={(statisticsQuery.error as Error).message || '请稍后重试'}
        />
      )}

      {/* 实时数据看板 */}
      <Card title="实时数据看板" loading={statisticsQuery.isLoading}>
        <Row gutter={16}>
          {kpiCards.length > 0 ? (
            kpiCards.map((card, index) => (
              <Col xs={24} sm={12} md={6} key={index}>
                <Card>
                  <Statistic
                    title={card.title}
                    value={card.value}
                    prefix={card.prefix}
                    suffix={card.suffix}
                  />
                </Card>
              </Col>
            ))
          ) : (
            <Col span={24}>
              <Empty description="暂无数据" />
            </Col>
          )}
        </Row>
      </Card>

      {/* 统计图表 */}
      <Card>
        <Tabs
          items={[
            {
              key: 'receipt',
              label: '票据统计',
              children: (
                <div style={{ height: 400 }}>
                  {receiptChartData.length > 0 ? (
                    <Column
                      data={receiptChartData}
                      xField="type"
                      yField="value"
                      columnWidthRatio={0.8}
                      label={{ position: 'top' }}
                      color="#1890ff"
                    />
                  ) : (
                    <Empty description="暂无票据统计数据" />
                  )}
                </div>
              ),
            },
            {
              key: 'attendance',
              label: '考勤统计',
              children: (
                <div style={{ height: 400 }}>
                  {attendanceChartData.length > 0 ? (
                    <Line
                      data={attendanceChartData}
                      xField="date"
                      yField="rate"
                      point={{ size: 5, shape: 'circle' }}
                      label={{ style: { fill: '#aaa' } }}
                      smooth
                    />
                  ) : (
                    <Empty description="暂无考勤统计数据" />
                  )}
                </div>
              ),
            },
            {
              key: 'energy',
              label: '能耗统计',
              children: (
                <div style={{ height: 400 }}>
                  {energyChartData.length > 0 ? (
                    <Column
                      data={energyChartData}
                      xField="type"
                      yField="value"
                      columnWidthRatio={0.8}
                      label={{ position: 'top' }}
                      color="#52c41a"
                    />
                  ) : (
                    <Empty description="暂无能耗统计数据" />
                  )}
                </div>
              ),
            },
            {
              key: 'driver-ranking',
              label: '司机排行榜',
              children: (
                <div style={{ height: 400 }}>
                  {driverRankingData.length > 0 ? (
                    <Column
                      data={driverRankingData}
                      xField="name"
                      yField="orders"
                      columnWidthRatio={0.8}
                      label={{ position: 'top' }}
                      color="#722ed1"
                      meta={{
                        orders: { alias: '运单数' },
                        name: { alias: '司机姓名' },
                      }}
                    />
                  ) : (
                    <Empty description="暂无司机排行榜数据" />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  )
}

export default StatisticsPage

