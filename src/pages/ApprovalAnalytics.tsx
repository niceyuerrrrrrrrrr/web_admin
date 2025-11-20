import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Column, Line, Pie } from '@ant-design/charts'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  APPROVAL_TYPES,
  fetchManagerStats,
  fetchTrendStats,
  type ApprovalManagerStats,
  type ApprovalTrendStats,
} from '../api/services/approval'
import useCompanyStore from '../store/company'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

const normalizeNumber = (value: any): number => {
  const num = Number(value)
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return 0
  }
  return num
}

const TREND_TYPE_OPTIONS = [
  { label: '总审批量', value: '总审批量', color: '#1890ff' },
  { label: '通过量', value: '通过量', color: '#52c41a' },
  { label: '驳回量', value: '驳回量', color: '#ff4d4f' },
] as const

const trendTypeColorMap = TREND_TYPE_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.color
  return acc
}, {})

type DateRangePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

const ApprovalAnalytics = () => {
  const { selectedCompanyId } = useCompanyStore() // 从全局状态读取
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('month')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(29, 'day'),
    dayjs(),
  ])
  const [selectedType, setSelectedType] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [selectedTrendTypes, setSelectedTrendTypes] = useState<string[]>(
    TREND_TYPE_OPTIONS.map((item) => item.value),
  )

  // 获取统计数据
  const managerQuery = useQuery<ApprovalManagerStats>({
    queryKey: ['approval', 'manager-stats', selectedType, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), selectedCompanyId],
    queryFn: () =>
      fetchManagerStats({
        approvalType: selectedType === 'all' ? undefined : selectedType,
        beginDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        companyId: selectedCompanyId,
      }),
  })

  // 获取趋势数据
  const trendQuery = useQuery<ApprovalTrendStats>({
    queryKey: ['approval', 'trend-stats', selectedType, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), groupBy, selectedCompanyId],
    queryFn: () =>
      fetchTrendStats({
        approvalType: selectedType === 'all' ? undefined : selectedType,
        beginDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        groupBy: groupBy,
        companyId: selectedCompanyId,
      }),
  })

  const stats = managerQuery.data
  const trendData = trendQuery.data

  // 快速日期选择
  const handleDatePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    const today = dayjs()
    
    switch (preset) {
      case 'today':
        setDateRange([today.startOf('day'), today.endOf('day')])
        setGroupBy('day')
        break
      case 'week':
        setDateRange([today.subtract(6, 'day'), today])
        setGroupBy('day')
        break
      case 'month':
        setDateRange([today.subtract(29, 'day'), today])
        setGroupBy('day')
        break
      case 'quarter':
        setDateRange([today.subtract(89, 'day'), today])
        setGroupBy('week')
        break
      case 'year':
        setDateRange([today.subtract(364, 'day'), today])
        setGroupBy('month')
        break
    }
  }

  const handleTrendTypeToggle = (type: string, checked: boolean) => {
    setSelectedTrendTypes((prev) => {
      if (checked) {
        if (prev.includes(type)) return prev
        return [...prev, type]
      }
      if (prev.length === 1 && prev[0] === type) {
        return prev
      }
      return prev.filter((item) => item !== type)
    })
  }

  // KPI卡片数据
  const kpiData = useMemo(() => {
    if (!stats) return []

    const totalApprovals = stats.types.reduce((sum: number, item: any) => sum + item.total, 0)
    const totalPending = stats.types.reduce((sum: number, item: any) => {
      return sum + (item.status.find((s: any) => s.status === 'reviewing')?.count || 0)
    }, 0)
    const totalApproved = stats.types.reduce((sum: number, item: any) => {
      return sum + (item.status.find((s: any) => s.status === 'approved')?.count || 0)
    }, 0)
    const totalRejected = stats.types.reduce((sum: number, item: any) => {
      return sum + (item.status.find((s: any) => s.status === 'rejected')?.count || 0)
    }, 0)
    
    const approvalRate = totalApprovals > 0 ? ((totalApproved / totalApprovals) * 100).toFixed(1) : '0'
    const rejectionRate = totalApprovals > 0 ? ((totalRejected / totalApprovals) * 100).toFixed(1) : '0'

    return [
      {
        title: '总审批数',
        value: totalApprovals,
        icon: <SyncOutlined style={{ color: '#1890ff' }} />,
        color: '#1890ff',
      },
      {
        title: '待审批',
        value: totalPending,
        icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
        color: '#faad14',
        status: totalPending > 10 ? 'warning' : undefined,
      },
      {
        title: '已通过',
        value: totalApproved,
        suffix: `(${approvalRate}%)`,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        color: '#52c41a',
      },
      {
        title: '已驳回',
        value: totalRejected,
        suffix: `(${rejectionRate}%)`,
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        color: '#ff4d4f',
      },
    ]
  }, [stats])

  // 类型分布饼图
  const typePieData = useMemo(() => {
    if (!stats) return []
    return stats.types
      .filter((item: any) => item.total > 0) // 只显示有数据的类型
      .map((item: any) => ({
        type: item.type_name,
        value: item.total,
      }))
  }, [stats])

  // 状态分布柱状图
  const statusBarData = useMemo(() => {
    if (!stats) return []
    const statusMap: Record<string, string> = {
      reviewing: '审核中',
      approved: '已通过',
      rejected: '已驳回',
    }
    const statusCounts: Record<string, number> = {}
    
    stats.types.forEach((item: any) => {
      item.status.forEach((s: any) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + s.count
      })
    })
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      status: statusMap[status] || status,
      count,
    }))
  }, [stats])

  // 趋势折线图数据
  const trendLineData = useMemo(() => {
    if (!trendData?.trend) return []
    
    const result: any[] = []
    const invalidRecords: any[] = []
    
    trendData.trend.forEach((item: any, index: number) => {
      if (!item?.date) {
        invalidRecords.push({ index, reason: 'missing date', raw: item })
        return
      }
      const safeDate = dayjs(item.date).format('YYYY-MM-DD')
      const reviewing = normalizeNumber(item.statuses?.reviewing)
      const approved = normalizeNumber(item.statuses?.approved)
      const rejected = normalizeNumber(item.statuses?.rejected)
      const total = reviewing + approved + rejected
      
      const appendPoint = (label: string, value: number) => {
        if (typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value)) {
          result.push({ date: safeDate, type: label, value })
        } else {
          invalidRecords.push({ index, reason: `${label} invalid value`, raw: item, value })
        }
      }
      
      appendPoint('总审批量', total)
      appendPoint('通过量', approved)
      appendPoint('驳回量', rejected)
    })
    
    if (invalidRecords.length > 0) {
      console.warn('[ApprovalTrend] invalid trendLineData records', invalidRecords)
    }
    
    const sanitizedResult = result.filter(
      (item) =>
        typeof item.value === 'number' && !Number.isNaN(item.value) && Number.isFinite(item.value),
    )
    const valueMap = new Map<string, number>()
    sanitizedResult.forEach((item) => {
      valueMap.set(`${item.date}-${item.type}`, item.value)
    })
    const sortedDates = Array.from(new Set(sanitizedResult.map((item) => item.date))).sort(
      (a, b) => dayjs(a).valueOf() - dayjs(b).valueOf(),
    )

    const completedData: typeof sanitizedResult = []
    sortedDates.forEach((date) => {
      TREND_TYPE_OPTIONS.forEach((option) => {
        const key = `${date}-${option.value}`
        completedData.push({
          date,
          type: option.value,
          value: valueMap.has(key) ? valueMap.get(key)! : 0,
        })
      })
    })

    return completedData
  }, [trendData])

  const filteredTrendLineData = useMemo(() => {
    if (!trendLineData.length) return []
    const source =
      selectedTrendTypes.length > 0
        ? trendLineData.filter((item) => selectedTrendTypes.includes(item.type))
        : trendLineData

    return source.filter(
      (item) =>
        typeof item.date === 'string' &&
        item.date.trim().length > 0 &&
        typeof item.value === 'number' &&
        !Number.isNaN(item.value) &&
        Number.isFinite(item.value),
    )
  }, [trendLineData, selectedTrendTypes])

  // 效率分析数据
  const efficiencyData = useMemo(() => {
    if (!stats) return { avgProcessTime: 0, fastestType: '-', slowestType: '-', overdueCount: 0 }
    
    // 计算平均处理时长（示例数据，实际需要后端支持）
    const avgProcessTime = 2.5 // 小时
    
    // 找出最快和最慢的类型（按通过率）
    const validTypes = stats.types.filter((t: any) => t.total > 0)
    const sortedByRate = [...validTypes].sort((a: any, b: any) => {
      const rateA = a.total > 0 ? (a.status.find((s: any) => s.status === 'approved')?.count || 0) / a.total : 0
      const rateB = b.total > 0 ? (b.status.find((s: any) => s.status === 'approved')?.count || 0) / b.total : 0
      return rateB - rateA
    })
    const fastestType = sortedByRate[0]?.type_name || '-'
    const slowestType = sortedByRate[sortedByRate.length - 1]?.type_name || '-'
    
    return { avgProcessTime, fastestType, slowestType, overdueCount: 3 }
  }, [stats])

  // 类型对比堆叠柱状图
  const typeComparisonData = useMemo(() => {
    if (!stats) return []
    
    const result: any[] = []
    stats.types.forEach((item: any) => {
      const approved = item.status.find((s: any) => s.status === 'approved')?.count || 0
      const rejected = item.status.find((s: any) => s.status === 'rejected')?.count || 0
      const reviewing = item.status.find((s: any) => s.status === 'reviewing')?.count || 0
      
      result.push({ type: item.type_name, category: '已通过', value: approved })
      result.push({ type: item.type_name, category: '已驳回', value: rejected })
      result.push({ type: item.type_name, category: '审核中', value: reviewing })
    })
    return result
  }, [stats])

  // 通过率趋势
  const approvalRateTrendData = useMemo(() => {
    if (!trendData?.trend) return []
    
    const invalidRecords: any[] = []
    
    const sanitized = trendData.trend
      .map((item: any, index: number) => {
        if (!item?.date) {
          invalidRecords.push({ index, reason: 'missing date', raw: item })
          return null
        }
        const approved = normalizeNumber(item.statuses?.approved)
        const rejected = normalizeNumber(item.statuses?.rejected)
        const total = approved + rejected
        const rate = total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0
        return {
          date: dayjs(item.date).format('YYYY-MM-DD'),
          rate,
        }
      })
      .filter(Boolean) as { date: string; rate: number }[]
    
    const finalData = sanitized.filter(
      (item) =>
        typeof item.date === 'string' &&
        item.date.trim().length > 0 &&
        typeof item.rate === 'number' &&
        !Number.isNaN(item.rate) &&
        Number.isFinite(item.rate),
    )
    finalData.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
    
    if (invalidRecords.length > 0) {
      console.warn('[ApprovalTrend] invalid approvalRateTrendData records', invalidRecords)
    }
    
    return finalData
  }, [trendData])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px' }}>
      {/* 加载和错误状态提示 */}
      {managerQuery.isLoading && (
        <Alert message="数据加载中..." type="info" showIcon />
      )}
      {managerQuery.isError && (
        <Alert 
          message="数据加载失败" 
          description={managerQuery.error instanceof Error ? managerQuery.error.message : '未知错误'} 
          type="error" 
          showIcon 
        />
      )}
      
      {/* 标题栏 */}
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          审批数据分析中心
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          多维度审批数据分析，助力管理决策优化
        </Paragraph>
      </div>

      {/* 筛选器 */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>快速选择：</Text>
            <Button
              type={dateRangePreset === 'today' ? 'primary' : 'default'}
              size="small"
              onClick={() => handleDatePresetChange('today')}
            >
              今天
            </Button>
            <Button
              type={dateRangePreset === 'week' ? 'primary' : 'default'}
              size="small"
              onClick={() => handleDatePresetChange('week')}
            >
              近7天
            </Button>
            <Button
              type={dateRangePreset === 'month' ? 'primary' : 'default'}
              size="small"
              onClick={() => handleDatePresetChange('month')}
            >
              近30天
            </Button>
            <Button
              type={dateRangePreset === 'quarter' ? 'primary' : 'default'}
              size="small"
              onClick={() => handleDatePresetChange('quarter')}
            >
              近3个月
            </Button>
            <Button
              type={dateRangePreset === 'year' ? 'primary' : 'default'}
              size="small"
              onClick={() => handleDatePresetChange('year')}
            >
              近1年
            </Button>
          </Space>

          <Space wrap size="large">
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]])
                  setDateRangePreset('custom')
                }
              }}
              format="YYYY-MM-DD"
            />
            <Select
              value={selectedType}
              onChange={setSelectedType}
              style={{ width: 180 }}
              options={[{ value: 'all', label: '全部类型' }, ...APPROVAL_TYPES]}
            />
            <Select
              value={groupBy}
              onChange={setGroupBy}
              style={{ width: 120 }}
              options={[
                { value: 'day', label: '按日统计' },
                { value: 'week', label: '按周统计' },
                { value: 'month', label: '按月统计' },
              ]}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                managerQuery.refetch()
                trendQuery.refetch()
              }}
              loading={managerQuery.isFetching || trendQuery.isFetching}
            >
              刷新
            </Button>
          </Space>
        </Space>
      </Card>

      {/* KPI 指标卡片 */}
      <Row gutter={[16, 16]}>
        {kpiData.map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={
                  <Space>
                    {item.icon}
                    <span>{item.title}</span>
                  </Space>
                }
                value={item.value}
                suffix={item.suffix}
                valueStyle={{ color: item.color }}
              />
              {item.status === 'warning' && (
                <Alert
                  message="审批积压预警"
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ marginTop: 12 }}
                  banner
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* 效率分析 */}
      <Card title="审批效率分析">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="平均处理时长"
              value={efficiencyData.avgProcessTime}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="处理最快类型"
              value={efficiencyData.fastestType}
              valueStyle={{ color: '#52c41a', fontSize: 16 }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="处理最慢类型"
              value={efficiencyData.slowestType}
              valueStyle={{ color: '#faad14', fontSize: 16 }}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Statistic
              title="超时审批"
              value={efficiencyData.overdueCount}
              suffix="件"
              valueStyle={{ color: efficiencyData.overdueCount > 0 ? '#ff4d4f' : undefined }}
              prefix={efficiencyData.overdueCount > 0 ? <WarningOutlined /> : undefined}
            />
          </Col>
        </Row>
      </Card>

      {/* 数据可视化 */}
      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: '数据概览',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="类型分布" bordered={false}>
                    {managerQuery.isLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
                        <div style={{ marginTop: 16, color: '#999' }}>数据加载中...</div>
                      </div>
                    ) : typePieData.length > 0 ? (
                      <Pie
                        data={typePieData}
                        angleField="value"
                        colorField="type"
                        radius={0.8}
                        innerRadius={0.6}
                        label={{
                          formatter: (data: any) => {
                            if (!data) return ''
                            const type = data.type || ''
                            const value = data.value || 0
                            return `${type}: ${value}条`
                          },
                        }}
                        statistic={{
                          title: false,
                          content: {
                            customHtml: () => {
                              const total = typePieData.reduce((sum, item) => sum + item.value, 0)
                              return `<div style="text-align:center"><div style="font-size:24px;font-weight:bold">${total}</div><div style="color:#999">总数</div></div>`
                            },
                          },
                        }}
                        legend={{
                          position: 'bottom',
                        }}
                        height={350}
                      />
                    ) : (
                      <Empty 
                        description={
                          <div>
                            <div>当前日期范围内暂无审批数据</div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                              {dateRange[0].format('YYYY-MM-DD')} 至 {dateRange[1].format('YYYY-MM-DD')}
                            </div>
                          </div>
                        } 
                        style={{ padding: '60px 0' }} 
                      />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="状态分布" bordered={false}>
                    {statusBarData.length > 0 ? (
                      <Column
                        data={statusBarData}
                        xField="status"
                        yField="count"
                        seriesField="status"
                        color={(datum: any) => {
                          if (datum.status === '已通过') return '#52c41a'
                          if (datum.status === '已驳回') return '#ff4d4f'
                          return '#faad14'
                        }}
                        label={{
                          position: 'top',
                          style: { fill: '#000', opacity: 0.6 },
                        }}
                        legend={false}
                        height={350}
                      />
                    ) : (
                      <Empty description="暂无数据" style={{ padding: '60px 0' }} />
                    )}
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card title="各类型审批情况对比" bordered={false}>
                    {typeComparisonData.length > 0 ? (
                      <Column
                        data={typeComparisonData}
                        xField="type"
                        yField="value"
                        seriesField="category"
                        isStack
                        color={['#52c41a', '#ff4d4f', '#faad14']}
                        legend={{
                          position: 'top',
                        }}
                        height={400}
                      />
                    ) : (
                      <Empty description="暂无数据" style={{ padding: '60px 0' }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'trend',
            label: '趋势分析',
            children: (
              <Card
                title="审批量趋势"
                bordered={false}
                extra={
                  <Space size={8} wrap>
                    <Text type="secondary">展示维度：</Text>
                    {TREND_TYPE_OPTIONS.map((option) => {
                      const checked = selectedTrendTypes.includes(option.value)
                      return (
                        <Tag.CheckableTag
                          key={option.value}
                          checked={checked}
                          onChange={(tagChecked) => handleTrendTypeToggle(option.value, tagChecked)}
                          style={{
                            borderColor: option.color,
                            color: checked ? '#fff' : option.color,
                            backgroundColor: checked ? option.color : '#fff',
                          }}
                        >
                          {option.label}
                        </Tag.CheckableTag>
                      )
                    })}
                  </Space>
                }
              >
                {filteredTrendLineData.length > 0 ? (
                  <Line
                    data={filteredTrendLineData}
                    xField="date"
                    yField="value"
                    seriesField="type"
                    colorField="type"
                    smooth
                    color={(datum: any) => trendTypeColorMap[datum.type] || '#1890ff'}
                    lineStyle={(datum: any) => ({
                      lineWidth: datum.type === '总审批量' ? 3 : 2,
                      stroke: trendTypeColorMap[datum.type] || '#1890ff',
                    })}
                    point={{
                      size: 4,
                      shape: 'circle',
                      style: (datum: any) => ({
                        stroke: trendTypeColorMap[datum.type] || '#1890ff',
                        fill: '#fff',
                        lineWidth: 2,
                      }),
                    }}
                    tooltip={{
                      shared: true,
                      showMarkers: true,
                      formatter: (datum: any) => ({
                        name: datum.type,
                        value: `${datum.value} 条`,
                      }),
                    }}
                    legend={{
                      position: 'top',
                    }}
                    height={420}
                  />
                ) : (
                  <Empty description="暂无数据" style={{ padding: '60px 0' }} />
                )}
              </Card>
            ),
          },
          {
            key: 'detail',
            label: '明细数据',
            children: (
              <Card bordered={false}>
                <Table
                  columns={[
                    { title: '审批类型', dataIndex: 'type_name', key: 'type' },
                    { title: '总数', dataIndex: 'total', key: 'total', sorter: (a: any, b: any) => a.total - b.total },
                    {
                      title: '审核中',
                      key: 'reviewing',
                      render: (_, record: any) => record.status.find((s: any) => s.status === 'reviewing')?.count || 0,
                    },
                    {
                      title: '已通过',
                      key: 'approved',
                      render: (_, record: any) => record.status.find((s: any) => s.status === 'approved')?.count || 0,
                    },
                    {
                      title: '已驳回',
                      key: 'rejected',
                      render: (_, record: any) => record.status.find((s: any) => s.status === 'rejected')?.count || 0,
                    },
                    {
                      title: '通过率',
                      key: 'rate',
                      render: (_, record: any) => {
                        const approved = record.status.find((s: any) => s.status === 'approved')?.count || 0
                        const rate = record.total > 0 ? ((approved / record.total) * 100).toFixed(1) : 0
                        return (
                          <Space>
                            <Progress
                              type="circle"
                              percent={Number(rate)}
                              width={50}
                              strokeColor={Number(rate) > 80 ? '#52c41a' : Number(rate) > 50 ? '#faad14' : '#ff4d4f'}
                            />
                            <span>{rate}%</span>
                          </Space>
                        )
                      },
                    },
                  ]}
                  dataSource={stats?.types || []}
                  loading={managerQuery.isLoading}
                  pagination={false}
                  rowKey="type"
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  )
}

export default ApprovalAnalytics

