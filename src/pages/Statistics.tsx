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

const { Title, Paragraph } = Typography

const StatisticsPage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [timeRange, setTimeRange] = useState<string>('month')

  // 根据用户角色选择统计API
  const getStatisticsQuery = () => {
    const positionType = (user as any)?.position_type || (user as any)?.role || ''
    
    if (positionType === '总经理') {
      return useQuery({
        queryKey: ['statistics', 'ceo', timeRange],
        queryFn: () => fetchCEOStatistics({ timeRange }),
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
    
    // 根据不同的统计数据类型显示不同的指标
    if (statsData.summary) {
      // CEO/车队长视图
      if (statsData.summary.orders) {
        cards.push({
          title: '运单数',
          value: statsData.summary.orders.current || 0,
          prefix: <FileTextOutlined />,
          suffix: statsData.summary.orders.growth !== undefined ? (
            <span style={{ fontSize: 12, color: statsData.summary.orders.growth >= 0 ? '#3f8600' : '#cf1322' }}>
              {statsData.summary.orders.growth >= 0 ? '+' : ''}{statsData.summary.orders.growth?.toFixed(1)}%
            </span>
          ) : null,
        })
      }
      
      if (statsData.summary.weight) {
        cards.push({
          title: '运输重量(吨)',
          value: (statsData.summary.weight.current || 0).toFixed(1),
          prefix: <TruckOutlined />,
          suffix: statsData.summary.weight.growth !== undefined ? (
            <span style={{ fontSize: 12, color: statsData.summary.weight.growth >= 0 ? '#3f8600' : '#cf1322' }}>
              {statsData.summary.weight.growth >= 0 ? '+' : ''}{statsData.summary.weight.growth?.toFixed(1)}%
            </span>
          ) : null,
        })
      }
      
      if (statsData.summary.income) {
        cards.push({
          title: '收入(元)',
          value: (statsData.summary.income.current || 0).toLocaleString(),
          prefix: <DollarOutlined />,
          suffix: statsData.summary.income.growth !== undefined ? (
            <span style={{ fontSize: 12, color: statsData.summary.income.growth >= 0 ? '#3f8600' : '#cf1322' }}>
              {statsData.summary.income.growth >= 0 ? '+' : ''}{statsData.summary.income.growth?.toFixed(1)}%
            </span>
          ) : null,
        })
      }
      
      if (statsData.summary.attendanceRate) {
        cards.push({
          title: '出勤率',
          value: (statsData.summary.attendanceRate || 0).toFixed(1),
          prefix: <ClockCircleOutlined />,
          suffix: '%',
        })
      }
    } else if (statsData.orders) {
      // 司机视图
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
    
    // 根据统计数据类型构建图表数据
    if (statsData.summary && statsData.summary.orders) {
      return [
        { type: '运单数', value: statsData.summary.orders.current || 0 },
        { type: '运输重量(吨)', value: (statsData.summary.weight?.current || 0).toFixed(1) },
      ]
    }
    
    return []
  }, [statsData])

  // 考勤统计图表数据
  const attendanceChartData = useMemo(() => {
    if (!statsData) return []
    
    // 如果有考勤数据，构建趋势图数据
    if (statsData.attendance) {
      // 根据实际数据结构调整
      return []
    }
    
    // 如果有趋势数据
    if (statsData.trendData) {
      return statsData.trendData.map((item: any) => ({
        date: item.date || item.day || '',
        rate: item.attendanceRate || item.rate || 0,
      }))
    }
    
    return []
  }, [statsData])

  // 能耗统计图表数据
  const energyChartData = useMemo(() => {
    if (!statsData) return []
    
    // 从统计数据中提取能耗数据
    if (statsData.charging) {
      return [
        { type: '充电量(kWh)', value: statsData.charging.totalEnergy || 0 },
        { type: '充电费用(元)', value: statsData.charging.totalCost || 0 },
        { type: '充电次数', value: statsData.charging.count || 0 },
      ]
    }
    
    return []
  }, [statsData])

  // 司机排行榜数据
  const driverRankingData = useMemo(() => {
    if (!statsData || !statsData.details || !statsData.details.driverRanking) return []
    
    return statsData.details.driverRanking.slice(0, 10).map((driver: any, index: number) => ({
      rank: index + 1,
      name: driver.name || driver.driver_name || '未知',
      orders: driver.orders || driver.order_count || 0,
      weight: driver.weight || driver.total_weight || 0,
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

