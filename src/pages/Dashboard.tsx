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
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Column } from '@ant-design/charts'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import CompanySelector from '../components/CompanySelector'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import { fetchCEOStatistics } from '../api/services/statistics'
import { fetchManagerStats } from '../api/services/approval'

const { Title, Paragraph, Text } = Typography

type ApprovalStatCard = {
  key: string
  typeName: string
  total: number
  status: { text: string; count: number }[]
}

const approvalSectionsOrder = [
  'reimbursement',
  'leave',
  'report',
  'material',
  'purchase',
] as const

const timeRangeOptions = [
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本年', value: 'year' },
]

const getDateRange = (timeRange: string) => {
  const now = dayjs()
  switch (timeRange) {
    case 'today':
      return {
        beginDate: now.startOf('day').format('YYYY-MM-DD'),
        endDate: now.endOf('day').format('YYYY-MM-DD'),
      }
    case 'week':
      return {
        beginDate: now.startOf('week').format('YYYY-MM-DD'),
        endDate: now.endOf('week').format('YYYY-MM-DD'),
      }
    case 'year':
      return {
        beginDate: now.startOf('year').format('YYYY-MM-DD'),
        endDate: now.endOf('year').format('YYYY-MM-DD'),
      }
    case 'month':
    default:
      return {
        beginDate: now.startOf('month').format('YYYY-MM-DD'),
        endDate: now.endOf('month').format('YYYY-MM-DD'),
      }
  }
}

const DashboardPage = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()
  const [timeRange, setTimeRange] = useState<string>('month')

  const isSuperAdmin =
    user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const shouldLoad = !isSuperAdmin || !!selectedCompanyId

  const { beginDate, endDate } = useMemo(
    () => getDateRange(timeRange),
    [timeRange],
  )

  const ceoStatsQuery = useQuery({
    queryKey: ['data-screen-ceo', timeRange, effectiveCompanyId],
    queryFn: () =>
      fetchCEOStatistics({
        timeRange,
        companyId: effectiveCompanyId,
      }),
    enabled: shouldLoad,
  })

  const approvalStatsQuery = useQuery({
    queryKey: ['data-screen-approvals', beginDate, endDate, effectiveCompanyId],
    queryFn: () =>
      fetchManagerStats({
        beginDate,
        endDate,
        companyId: effectiveCompanyId,
      }),
    enabled: shouldLoad,
  })

  const statsData = ceoStatsQuery.data

  const transportCards = useMemo(() => {
    if (!statsData?.operation) return []
    const operation = statsData.operation
    return [
      {
        title: '运输订单',
        value: operation.totalOrders ?? 0,
        suffix: '单',
      },
      {
        title: '运输重量',
        value: operation.totalWeight ?? 0,
        suffix: '吨',
        precision: 2,
      },
      {
        title: '平均单次重量',
        value: operation.avgWeightPerOrder ?? 0,
        suffix: '吨/单',
        precision: 2,
      },
      {
        title: '故障事件',
        value: operation.faultCount ?? 0,
        suffix: '起',
      },
    ]
  }, [statsData])

  const chargingCards = useMemo(() => {
    const breakdown = statsData?.business?.costBreakdown
    if (!breakdown) return []
    return [
      {
        title: '充电总费用',
        value: breakdown.charging ?? 0,
        suffix: '元',
        precision: 2,
      },
      {
        title: '报销费用',
        value: breakdown.reimbursement ?? 0,
        suffix: '元',
        precision: 2,
      },
      {
        title: '人工成本',
        value: breakdown.salary ?? 0,
        suffix: '元',
        precision: 2,
      },
    ]
  }, [statsData])

  const chargingChartData = useMemo(() => {
    const breakdown = statsData?.business?.costBreakdown
    if (!breakdown) return []
    return Object.entries(breakdown).map(([key, value]) => ({
      type:
        key === 'charging'
          ? '充电'
          : key === 'reimbursement'
            ? '报销'
            : key === 'salary'
              ? '人工'
              : key,
      value: Number(value || 0),
    }))
  }, [statsData])

  const approvalCards: ApprovalStatCard[] = useMemo(() => {
    const types = approvalStatsQuery.data?.types || []
    const ordered = [...types].sort((a, b) => {
      const indexA = approvalSectionsOrder.indexOf(a.key as any)
      const indexB = approvalSectionsOrder.indexOf(b.key as any)
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB)
    })
    return ordered.map((item) => ({
      key: item.key,
      typeName: item.type_name,
      total: item.total,
      status: item.status?.map((statusItem) => ({
        text: statusItem.text,
        count: statusItem.count,
      })) || [],
    }))
  }, [approvalStatsQuery.data])

  const attendanceCards = useMemo(() => {
    const personnel = statsData?.personnel
    if (!personnel) return []
    return [
      {
        title: '出勤率',
        value: personnel.attendanceRate ?? 0,
        suffix: '%',
        precision: 1,
      },
      {
        title: '迟到次数',
        value: personnel.lateCount ?? 0,
        suffix: '次',
      },
      {
        title: '司机人数',
        value: personnel.totalDrivers ?? 0,
        suffix: '人',
      },
      {
        title: '效率评分',
        value: personnel.driverEfficiency ?? 0,
        suffix: '%',
        precision: 1,
      },
    ]
  }, [statsData])

  const vehicleCards = useMemo(() => {
    const operation = statsData?.operation
    if (!operation) return []
    return [
      {
        title: '车辆总数',
        value: operation.totalVehicles ?? 0,
        suffix: '台',
      },
      {
        title: '车辆使用率',
        value: operation.vehicleUtilization ?? 0,
        suffix: '%',
        precision: 1,
      },
    ]
  }, [statsData])

  const vehicleRanking =
    (statsData?.details?.vehicleRanking as Record<string, any>[]) || []
  const driverRanking =
    (statsData?.details?.driverRanking as Record<string, any>[]) || []

  const renderMetricCard = ({
    title,
    value,
    suffix,
    precision,
  }: {
    title: string
    value: number
    suffix?: string
    precision?: number
  }) => (
    <Card>
      <Statistic
        title={title}
        value={value}
        precision={precision}
        suffix={suffix}
      />
    </Card>
  )

  const renderApprovalCard = (card: ApprovalStatCard) => (
    <Card key={card.key} title={card.typeName}>
      <Statistic value={card.total} title="总申请数" />
      <Space wrap style={{ marginTop: 12 }}>
        {card.status.map((status) => (
          <Tag key={status.text}>
            {status.text}: {status.count}
          </Tag>
        ))}
        {card.status.length === 0 && <Text type="secondary">暂无数据</Text>}
      </Space>
    </Card>
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space
        direction="vertical"
        size="small"
        style={{ width: '100%' }}
      >
        <FlexWrap>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              数据统计大屏
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              覆盖运输、充电、审批、考勤、车辆、人员的综合运营数据。
            </Paragraph>
          </div>
          <Space>
            <Select
              style={{ width: 140 }}
              value={timeRange}
              options={timeRangeOptions}
              onChange={setTimeRange}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['data-screen-ceo'] })
                queryClient.invalidateQueries({
                  queryKey: ['data-screen-approvals'],
                })
              }}
            >
              刷新
            </Button>
            {isSuperAdmin && (
              <CompanySelector
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                allowClear={false}
                placeholder="请选择公司"
              />
            )}
          </Space>
        </FlexWrap>
        {isSuperAdmin && !selectedCompanyId && (
          <Alert
            showIcon
            type="info"
            message="请选择公司以查看对应的数据。"
          />
        )}
      </Space>

      {ceoStatsQuery.error && (
        <Alert
          showIcon
          type="error"
          message={(ceoStatsQuery.error as Error).message || '统计数据加载失败'}
        />
      )}

      <Spin spinning={ceoStatsQuery.isLoading && shouldLoad}>
        {/* 1. 运输数据 */}
        <SectionCard title="运输数据">
          <Row gutter={[16, 16]}>
            {transportCards.map((card) => (
              <Col xs={24} sm={12} md={6} key={card.title}>
                {renderMetricCard(card)}
              </Col>
            ))}
            {transportCards.length === 0 && (
              <Col span={24}>
                <Empty description="暂无运输数据" />
              </Col>
            )}
          </Row>
        </SectionCard>

        {/* 2. 充电数据 */}
        <SectionCard title="充电与成本数据">
          <Row gutter={[16, 16]}>
            {chargingCards.map((card) => (
              <Col xs={24} sm={12} md={8} key={card.title}>
                {renderMetricCard(card)}
              </Col>
            ))}
          </Row>
          <div style={{ height: 320, marginTop: 16 }}>
            {chargingChartData.length > 0 ? (
              <Column
                data={chargingChartData}
                xField="type"
                yField="value"
                columnWidthRatio={0.5}
                color="#1890ff"
                label={{ position: 'top' }}
              />
            ) : (
              <Empty description="暂无成本数据" />
            )}
          </div>
        </SectionCard>

        {/* 3. 审批数据 */}
        <SectionCard title="审批数据">
          {approvalStatsQuery.error && (
            <Alert
              showIcon
              type="error"
              message={
                (approvalStatsQuery.error as Error).message ||
                '审批统计加载失败'
              }
            />
          )}
          <Row gutter={[16, 16]}>
            {approvalCards.length > 0 ? (
              approvalCards.map((card) => (
                <Col xs={24} sm={12} md={8} key={card.key}>
                  {renderApprovalCard(card)}
                </Col>
              ))
            ) : (
              <Col span={24}>
                <Empty description="暂无审批统计" />
              </Col>
            )}
          </Row>
        </SectionCard>

        {/* 4. 考勤数据 */}
        <SectionCard title="考勤数据">
          <Row gutter={[16, 16]}>
            {attendanceCards.map((card) => (
              <Col xs={24} sm={12} md={6} key={card.title}>
                {renderMetricCard(card)}
              </Col>
            ))}
            {attendanceCards.length === 0 && (
              <Col span={24}>
                <Empty description="暂无考勤数据" />
              </Col>
            )}
          </Row>
        </SectionCard>

        {/* 5. 车辆数据 */}
        <SectionCard title="车辆数据">
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {vehicleCards.map((card) => (
              <Col xs={24} sm={12} md={6} key={card.title}>
                {renderMetricCard(card)}
              </Col>
            ))}
          </Row>
          <Table
            size="small"
            rowKey={(record) =>
              record.vehicle_no || record.name || record.rank
            }
            dataSource={vehicleRanking}
            pagination={false}
            locale={{ emptyText: '暂无车辆排行数据' }}
            columns={[
              { title: '车辆', dataIndex: 'vehicle_no', width: 120 },
              { title: '出勤次数', dataIndex: 'orders', width: 100 },
              {
                title: '运输重量(吨)',
                dataIndex: 'weight',
                render: (value: number) => (value || 0).toFixed(1),
              },
            ]}
          />
        </SectionCard>

        {/* 6. 人员数据 */}
        <SectionCard title="人员数据">
          <Table
            size="small"
            rowKey={(record) => record.name || record.rank}
            dataSource={driverRanking}
            pagination={false}
            locale={{ emptyText: '暂无司机排行数据' }}
            columns={[
              { title: '排名', dataIndex: 'rank', width: 80 },
              { title: '司机', dataIndex: 'name' },
              { title: '运单数', dataIndex: 'orders', width: 120 },
              {
                title: '运输重量(吨)',
                dataIndex: 'weight',
                width: 140,
                render: (value: number) => (value || 0).toFixed(1),
              },
            ]}
          />
        </SectionCard>
      </Spin>
    </Space>
  )
}

const SectionCard = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <Card title={title} bordered={false}>
    {children}
  </Card>
)

const FlexWrap = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 16,
    }}
  >
    {children}
  </div>
)

export default DashboardPage
