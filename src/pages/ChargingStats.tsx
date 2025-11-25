import { useState } from 'react'
import {
  Alert,
  Card,
  Col,
  Row,
  Select,
  Statistic,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { fetchChargingStatsOverview } from '../api/services/charging'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title } = Typography

const ChargingStats = () => {
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [timeRange, setTimeRange] = useState('month')

  const statsQuery = useQuery({
    queryKey: ['charging', 'stats', timeRange, effectiveCompanyId],
    queryFn: () => fetchChargingStatsOverview({ timeRange, companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const summary = statsQuery.data?.summary
  const byDriver = statsQuery.data?.by_driver || []
  const byVehicle = statsQuery.data?.by_vehicle || []

  const driverColumns: ColumnsType<any> = [
    { title: '司机', dataIndex: 'name', key: 'name' },
    { title: '充电次数', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
    { title: '总充电量(kWh)', dataIndex: 'energy', key: 'energy', sorter: (a, b) => a.energy - b.energy },
    { title: '总金额(元)', dataIndex: 'amount', key: 'amount', sorter: (a, b) => a.amount - b.amount },
    { title: '平均单价(元/kWh)', dataIndex: 'avg_price', key: 'avg_price', sorter: (a, b) => a.avg_price - b.avg_price },
  ]

  const vehicleColumns: ColumnsType<any> = [
    { title: '车牌号', dataIndex: 'vehicle_no', key: 'vehicle_no' },
    { title: '充电次数', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
    { title: '总充电量(kWh)', dataIndex: 'energy', key: 'energy', sorter: (a, b) => a.energy - b.energy },
    { title: '总金额(元)', dataIndex: 'amount', key: 'amount', sorter: (a, b) => a.amount - b.amount },
    { title: '平均单价(元/kWh)', dataIndex: 'avg_price', key: 'avg_price', sorter: (a, b) => a.avg_price - b.avg_price },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>充电数据分析</Title>
        <Select
          value={timeRange}
          onChange={setTimeRange}
          style={{ width: 120 }}
          options={[
            { value: 'today', label: '今日' },
            { value: 'week', label: '本周' },
            { value: 'month', label: '本月' },
            { value: 'year', label: '今年' },
          ]}
        />
      </div>

      {statsQuery.error && (
        <Alert type="error" message="加载失败" description={(statsQuery.error as Error).message} showIcon style={{ marginBottom: 24 }} />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总充电量 (kWh)" value={summary?.total_energy} precision={2} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="总充电金额 (元)" value={summary?.total_amount} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="平均单价 (元/kWh)" value={summary?.avg_price} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="司机充电统计">
            <Table
              dataSource={byDriver}
              columns={driverColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              loading={statsQuery.isLoading}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="车辆充电统计">
            <Table
              dataSource={byVehicle}
              columns={vehicleColumns}
              rowKey="vehicle_no"
              pagination={{ pageSize: 10 }}
              loading={statsQuery.isLoading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ChargingStats
