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
  Empty,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { Line, Column, Bar } from '@ant-design/plots'
import { fetchChargingStatsOverview, fetchChargingTrend } from '../api/services/charging'
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

  const trendQuery = useQuery({
    queryKey: ['charging', 'trend', timeRange, effectiveCompanyId],
    queryFn: () => fetchChargingTrend({ timeRange, companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const summary = statsQuery.data?.summary
  const byDriver = statsQuery.data?.by_driver || []
  const byVehicle = statsQuery.data?.by_vehicle || []
  const dailyTrend = trendQuery.data?.daily_trend || []

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

      {/* 时间趋势图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card title="充电量趋势" size="small">
            {dailyTrend.length > 0 ? (
              <Line
                data={dailyTrend}
                xField="date"
                yField="energy"
                height={300}
                point={{
                  size: 4,
                  shape: 'circle',
                  style: {
                    fill: '#1890ff',
                    stroke: '#1890ff',
                    lineWidth: 2,
                  },
                }}
                lineStyle={{
                  stroke: '#1890ff',
                  lineWidth: 2,
                }}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: true,
                  },
                }}
                yAxis={{
                  title: {
                    text: '充电量(kWh)',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: '充电量',
                      value: `${datum?.energy?.toFixed(2) || 0}kWh`,
                    }
                  },
                }}
                smooth
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="充电金额趋势" size="small">
            {dailyTrend.length > 0 ? (
              <Line
                data={dailyTrend}
                xField="date"
                yField="amount"
                height={300}
                point={{
                  size: 4,
                  shape: 'circle',
                  style: {
                    fill: '#52c41a',
                    stroke: '#52c41a',
                    lineWidth: 2,
                  },
                }}
                lineStyle={{
                  stroke: '#52c41a',
                  lineWidth: 2,
                }}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: true,
                  },
                }}
                yAxis={{
                  title: {
                    text: '金额(元)',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: '充电金额',
                      value: `¥${datum?.amount?.toFixed(2) || 0}`,
                    }
                  },
                }}
                smooth
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="充电次数趋势" size="small">
            {dailyTrend.length > 0 ? (
              <Line
                data={dailyTrend}
                xField="date"
                yField="count"
                height={300}
                point={{
                  size: 4,
                  shape: 'circle',
                  style: {
                    fill: '#fa8c16',
                    stroke: '#fa8c16',
                    lineWidth: 2,
                  },
                }}
                lineStyle={{
                  stroke: '#fa8c16',
                  lineWidth: 2,
                }}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: true,
                  },
                }}
                yAxis={{
                  title: {
                    text: '次数',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: '充电次数',
                      value: `${datum?.count || 0}次`,
                    }
                  },
                }}
                smooth
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 司机和车辆充电图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="司机充电量统计 - 图表" size="small">
            {byDriver.length > 0 ? (
              <Column
                data={byDriver}
                xField="name"
                yField="energy"
                height={350}
                label={{
                  position: 'top',
                  style: {
                    fill: '#1890ff',
                    fontSize: 11,
                  },
                  formatter: (datum: any) => datum?.energy ? `${datum.energy.toFixed(2)}` : '',
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
                    text: '充电量(kWh)',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: datum.name,
                      value: `${datum?.energy?.toFixed(2) || 0}kWh (${datum?.count || 0}次)`,
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
          <Card title="车辆充电量统计 - 图表" size="small">
            {byVehicle.length > 0 ? (
              <Column
                data={byVehicle}
                xField="vehicle_no"
                yField="energy"
                height={350}
                label={{
                  position: 'top',
                  style: {
                    fill: '#52c41a',
                    fontSize: 11,
                  },
                  formatter: (datum: any) => datum?.energy ? `${datum.energy.toFixed(2)}` : '',
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
                    text: '充电量(kWh)',
                  },
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: datum.vehicle_no,
                      value: `${datum?.energy?.toFixed(2) || 0}kWh (${datum?.count || 0}次)`,
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

      {/* 充电金额统计图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="司机充电金额统计 - 图表" size="small">
            {byDriver.length > 0 ? (
              <Bar
                data={byDriver.slice().sort((a, b) => b.amount - a.amount).slice(0, 10)}
                xField="amount"
                yField="name"
                height={Math.max(300, Math.min(byDriver.length, 10) * 35)}
                label={{
                  position: 'right',
                  style: {
                    fill: '#000',
                    fontSize: 11,
                  },
                  formatter: (datum: any) => datum?.amount ? `¥${datum.amount.toFixed(2)}` : '',
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: datum.name,
                      value: `¥${datum?.amount?.toFixed(2) || 0} (${datum?.count || 0}次)`,
                    }
                  },
                }}
                barStyle={{
                  radius: [0, 4, 4, 0],
                  fill: 'l(0) 0:#fa8c16 1:#faad14',
                }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="车辆充电金额统计 - 图表" size="small">
            {byVehicle.length > 0 ? (
              <Bar
                data={byVehicle.slice().sort((a, b) => b.amount - a.amount).slice(0, 10)}
                xField="amount"
                yField="vehicle_no"
                height={Math.max(300, Math.min(byVehicle.length, 10) * 35)}
                label={{
                  position: 'right',
                  style: {
                    fill: '#000',
                    fontSize: 11,
                  },
                  formatter: (datum: any) => datum?.amount ? `¥${datum.amount.toFixed(2)}` : '',
                }}
                tooltip={{
                  formatter: (datum: any) => {
                    return {
                      name: datum.vehicle_no,
                      value: `¥${datum?.amount?.toFixed(2) || 0} (${datum?.count || 0}次)`,
                    }
                  },
                }}
                barStyle={{
                  radius: [0, 4, 4, 0],
                  fill: 'l(0) 0:#eb2f96 1:#f759ab',
                }}
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 司机和车辆充电统计表格 */}
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
