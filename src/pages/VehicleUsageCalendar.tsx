import React, { useState } from 'react'
import {
  Card,
  Table,
  DatePicker,
  Button,
  Space,
  Tag,
  Tooltip,
  Empty,
} from 'antd'
import {
  CarOutlined,
  ReloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useCompanyStore from '../store/company'
import { fetchVehicleUsageCalendar } from '../api/services/vehicles'

const { RangePicker } = DatePicker

const VehicleUsageCalendar: React.FC = () => {
  const { selectedCompanyId } = useCompanyStore()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])

  // 获取车辆使用数据（按公司过滤）
  const { data: usageData, refetch, isLoading, error } = useQuery({
    queryKey: ['vehicleUsage', selectedCompanyId, dateRange],
    queryFn: async () => {
      console.log('查询车辆使用日历:', {
        company_id: selectedCompanyId,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      })
      const result = await fetchVehicleUsageCalendar({
        company_id: selectedCompanyId!,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      })
      console.log('车辆使用日历返回数据:', result)
      return result
    },
    enabled: !!selectedCompanyId,
  })
  
  // 打印错误信息
  if (error) {
    console.error('车辆使用日历查询错误:', error)
  }

  // 生成日期列
  const generateDateColumns = () => {
    const columns: any[] = [
      {
        title: '车牌号',
        dataIndex: 'plate',
        key: 'plate',
        fixed: 'left',
        width: 120,
        render: (plate: string) => (
          <Space>
            <CarOutlined />
            <strong>{plate}</strong>
          </Space>
        ),
      },
    ]

    const startDate = dateRange[0]
    const endDate = dateRange[1]
    let currentDate = startDate.clone()

    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
      const dateStr = currentDate.format('YYYY-MM-DD')
      const displayDate = currentDate.format('MM-DD')
      const weekday = currentDate.format('ddd')
      const isWeekend = currentDate.day() === 0 || currentDate.day() === 6

      columns.push({
        title: (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: isWeekend ? '#ff4d4f' : undefined }}>
              {weekday}
            </div>
            <div style={{ fontWeight: 'bold', color: isWeekend ? '#ff4d4f' : undefined }}>
              {displayDate}
            </div>
          </div>
        ),
        dataIndex: ['usage', dateStr],
        key: dateStr,
        width: 100,
        align: 'center' as const,
        render: (usage: { driver_name: string; trip_count: number } | undefined) => {
          if (!usage) {
            return <div style={{ color: '#d9d9d9' }}>-</div>
          }
          return (
            <Tooltip title={`趟数: ${usage.trip_count}`}>
              <Tag color="blue" style={{ margin: 0, cursor: 'pointer' }}>
                {usage.driver_name}
              </Tag>
            </Tooltip>
          )
        },
      })

      currentDate = currentDate.add(1, 'day')
    }

    // 添加使用率列
    columns.push({
      title: '使用率',
      key: 'usage_rate',
      fixed: 'right',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const totalDays = endDate.diff(startDate, 'day') + 1
        const usedDays = Object.keys(record.usage || {}).length
        const rate = totalDays > 0 ? ((usedDays / totalDays) * 100).toFixed(1) : 0
        
        let color = 'default'
        if (Number(rate) >= 80) color = 'success'
        else if (Number(rate) >= 50) color = 'warning'
        else color = 'error'

        return <Tag color={color}>{rate}%</Tag>
      },
    })

    return columns
  }

  const columns = generateDateColumns()
  // API返回格式：{success: true, data: [...], message: "..."}
  // usageData本身就是ApiResponse，所以usageData.data是实际的车辆数组
  const dataSource = usageData?.data || []

  // 计算统计数据
  const totalVehicles = dataSource.length
  const totalDays = dateRange[1].diff(dateRange[0], 'day') + 1
  const totalUsageDays = dataSource.reduce(
    (sum: number, vehicle: any) => sum + Object.keys(vehicle.usage || {}).length,
    0,
  )
  const avgUsageRate =
    totalVehicles > 0 && totalDays > 0
      ? ((totalUsageDays / (totalVehicles * totalDays)) * 100).toFixed(1)
      : 0

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <CalendarOutlined />
            <span>车辆使用日历</span>
          </Space>
        }
        extra={
          <Space>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]])
                }
              }}
              format="YYYY-MM-DD"
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        {/* 统计信息 */}
        <div style={{ marginBottom: 24 }}>
          <Space size="large">
            <div>
              <span style={{ color: '#999' }}>车辆总数：</span>
              <strong style={{ fontSize: 18 }}>{totalVehicles}</strong>
            </div>
            <div>
              <span style={{ color: '#999' }}>查询天数：</span>
              <strong style={{ fontSize: 18 }}>{totalDays}</strong>
            </div>
            <div>
              <span style={{ color: '#999' }}>平均使用率：</span>
              <strong style={{ fontSize: 18, color: '#52c41a' }}>
                {avgUsageRate}%
              </strong>
            </div>
          </Space>
        </div>

        {/* 使用说明 */}
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#f0f2f5',
            borderRadius: 4,
          }}
        >
          <Space direction="vertical" size={4}>
            <div>
              <strong>使用说明：</strong>
            </div>
            <div>• 表格显示每辆车每天的使用情况</div>
            <div>• 蓝色标签显示当天使用该车的司机姓名</div>
            <div>• 鼠标悬停可查看当天的趟数</div>
            <div>• 使用率 = 实际使用天数 / 总天数</div>
          </Space>
        </div>

        {/* 车辆使用表格 */}
        {error ? (
          <Empty 
            description={
              <div>
                <div>数据加载失败</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                  {(error as Error).message || '未知错误'}
                </div>
              </div>
            } 
          />
        ) : dataSource.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="plate"
            scroll={{ x: 'max-content' }}
            pagination={false}
            loading={isLoading}
            bordered
          />
        ) : (
          <Empty 
            description={
              <div>
                <div>暂无数据</div>
                {!isLoading && selectedCompanyId && (
                  <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                    当前公司ID: {selectedCompanyId}，日期范围: {dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}
                  </div>
                )}
              </div>
            } 
          />
        )}
      </Card>
    </div>
  )
}

export default VehicleUsageCalendar
