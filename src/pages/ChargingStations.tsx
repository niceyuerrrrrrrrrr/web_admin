import { useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AimOutlined,
  CalendarOutlined,
  DeleteOutlined,
  DollarOutlined,
  DownloadOutlined,
  EditOutlined,
  LineChartOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Column, Line } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import type { ChargingPriceRule, ChargingStation, ChargingStatistics } from '../api/types'
import {
  calculateChargingCost,
  createChargingRule,
  createChargingStation,
  deleteChargingRule,
  deleteChargingStation,
  fetchChargingRules,
  fetchChargingStatistics,
  fetchChargingStations,
  saveRuleTable,
  type ChargingRuleTableRow,
  updateChargingRule,
  updateChargingStation,
} from '../api/services/charging'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker
const { Dragger } = Upload

const ChargingStationsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()

  const [statsFilters, setStatsFilters] = useState<{ stationId?: number; dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }>({
    dateRange: [dayjs().subtract(6, 'day'), dayjs()],
  })
  const [stationModalOpen, setStationModalOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<ChargingStation | null>(null)
  const [stationForm] = Form.useForm()

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null)

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ChargingPriceRule | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [ruleForm] = Form.useForm()
  const [calculatorForm] = Form.useForm()

  const stationsQuery = useQuery({
    queryKey: ['charging', 'stations'],
    queryFn: () => fetchChargingStations(),
  })

  const statsQuery = useQuery({
    queryKey: ['charging', 'stats', statsFilters],
    queryFn: () =>
      fetchChargingStatistics({
        stationId: statsFilters.stationId,
        beginDate: statsFilters.dateRange ? statsFilters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: statsFilters.dateRange ? statsFilters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
      }),
  })

  const rulesQuery = useQuery({
    queryKey: ['charging', 'rules', selectedStation?.id],
    queryFn: () => fetchChargingRules(selectedStation!.id),
    enabled: detailDrawerOpen && !!selectedStation,
  })

  const createStationMutation = useMutation({
    mutationFn: createChargingStation,
    onSuccess: () => {
      message.success('充电站创建成功')
      stationForm.resetFields()
      setStationModalOpen(false)
      setEditingStation(null)
      queryClient.invalidateQueries({ queryKey: ['charging', 'stations'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateStationMutation = useMutation({
    mutationFn: (payload: { id: number; data: Partial<ChargingStation> }) => updateChargingStation(payload.id, payload.data),
    onSuccess: () => {
      message.success('充电站更新成功')
      stationForm.resetFields()
      setStationModalOpen(false)
      setEditingStation(null)
      queryClient.invalidateQueries({ queryKey: ['charging', 'stations'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteStationMutation = useMutation({
    mutationFn: deleteChargingStation,
    onSuccess: () => {
      message.success('已禁用该充电站')
      queryClient.invalidateQueries({ queryKey: ['charging', 'stations'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const createRuleMutation = useMutation({
    mutationFn: (payload: { stationId: number; data: Parameters<typeof createChargingRule>[1] }) =>
      createChargingRule(payload.stationId, payload.data),
    onSuccess: () => {
      message.success('规则创建成功')
      setRuleModalOpen(false)
      setEditingRule(null)
      ruleForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['charging', 'rules', selectedStation?.id] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateRuleMutation = useMutation({
    mutationFn: (payload: { ruleId: number; data: Parameters<typeof updateChargingRule>[1] }) =>
      updateChargingRule(payload.ruleId, payload.data),
    onSuccess: () => {
      message.success('规则更新成功')
      setRuleModalOpen(false)
      setEditingRule(null)
      queryClient.invalidateQueries({ queryKey: ['charging', 'rules', selectedStation?.id] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteRuleMutation = useMutation({
    mutationFn: deleteChargingRule,
    onSuccess: () => {
      message.success('已禁用该规则')
      queryClient.invalidateQueries({ queryKey: ['charging', 'rules', selectedStation?.id] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const saveRuleTableMutation = useMutation({
    mutationFn: (payload: { stationId: number; rows: ChargingRuleTableRow[] }) =>
      saveRuleTable(payload.stationId, payload.rows),
    onSuccess: () => {
      message.success('批量导入成功')
      setImportModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['charging', 'rules', selectedStation?.id] })
    },
    onError: (error) => message.error((error as Error).message || '导入失败'),
  })

  const calculatorMutation = useMutation({
    mutationFn: calculateChargingCost,
    onSuccess: (data) => {
      message.success(`预计费用 ¥${data.amount.toFixed(2)}`)
    },
    onError: (error) => message.error((error as Error).message || '计算失败'),
  })

  const stats = (statsQuery.data as ChargingStatistics | undefined) || ({} as ChargingStatistics)

  const summaryCards = [
    { title: '充电总电量 (kWh)', value: stats.summary?.total_energy || 0, icon: <LightningIcon /> },
    { title: '总充电费用 (元)', value: stats.summary?.total_amount || 0, icon: <DollarOutlined /> },
    { title: '充电次数', value: stats.summary?.total_sessions || 0, icon: <CalendarOutlined /> },
    { title: '平均单价 (元/kWh)', value: stats.summary?.avg_price || 0, icon: <LineChartOutlined /> },
  ]

  const trendData = useMemo(() => {
    if (!stats.daily_trend) return []
    return stats.daily_trend
      .filter((item) => item.date)
      .map((item) => ({
        date: item.date!,
        type: '电量 (kWh)',
        value: item.energy,
      }))
      .concat(
        stats.daily_trend
          .filter((item) => item.date)
          .map((item) => ({
            date: item.date!,
            type: '费用 (元)',
            value: item.amount,
          })),
      )
  }, [stats.daily_trend])

  const stationRankingData = (stats.stations || []).map((item) => ({
    station: item.station_name || '未填写',
    energy: item.total_energy,
    amount: item.total_amount,
  }))

  const stationColumns: ColumnsType<ChargingStation> = [
    { title: '充电站名称', dataIndex: 'station_name', width: 200 },
    { title: '编码', dataIndex: 'station_code', width: 140, render: (v) => v || '-' },
    { title: '位置', dataIndex: 'location', ellipsis: true, render: (v) => v || '-' },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      width: 160,
      render: (_, record) =>
        record.contact_person ? (
          <>
            <Text>{record.contact_person}</Text>
            {record.contact_phone && (
              <div>
                <PhoneOutlined /> {record.contact_phone}
              </div>
            )}
          </>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      render: (value: boolean | undefined) => <Tag color={value ? 'success' : 'default'}>{value ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setSelectedStation(record)
              setDetailDrawerOpen(true)
            }}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingStation(record)
              stationForm.setFieldsValue(record)
              setStationModalOpen(true)
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              Modal.confirm({
                title: '禁用充电站',
                content: `确认禁用 ${record.station_name} 吗？`,
                onOk: () => deleteStationMutation.mutate(record.id),
              })
            }
          >
            禁用
          </Button>
        </Space>
      ),
    },
  ]

  const ruleColumns: ColumnsType<ChargingPriceRule> = [
    {
      title: '充电时段',
      dataIndex: 'time_period_start',
      render: (_, record) => `${record.time_period_start} ~ ${record.time_period_end}`,
    },
    {
      title: '单价 (元/kWh)',
      dataIndex: 'price_per_kwh',
      width: 140,
      render: (value: number) => `¥ ${value.toFixed(4)}`,
    },
    { title: '优先级', dataIndex: 'priority', width: 100 },
    {
      title: '生效日期',
      dataIndex: 'effective_date',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: '失效日期',
      dataIndex: 'expiry_date',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setEditingRule(record)
              ruleForm.setFieldsValue({
                time_range: [dayjs(record.time_period_start, 'HH:mm'), dayjs(record.time_period_end, 'HH:mm')],
                price_per_kwh: record.price_per_kwh,
                priority: record.priority,
                description: record.description,
                effective_date: record.effective_date ? dayjs(record.effective_date) : undefined,
                expiry_date: record.expiry_date ? dayjs(record.expiry_date) : undefined,
                is_active: record.is_active,
              })
              setRuleModalOpen(true)
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            onClick={() =>
              Modal.confirm({
                title: '禁用该规则？',
                onOk: () => deleteRuleMutation.mutate(record.id),
              })
            }
          >
            禁用
          </Button>
        </Space>
      ),
    },
  ]

  const handleStationModalOk = () => {
    stationForm.validateFields().then((values) => {
      if (editingStation) {
        updateStationMutation.mutate({ id: editingStation.id, data: values })
      } else {
        createStationMutation.mutate(values)
      }
    })
  }

  const handleRuleModalOk = () => {
    if (!selectedStation) {
      message.warning('请先选择充电站')
      return
    }
    ruleForm.validateFields().then((values) => {
      const [start, end] = values.time_range || []
      const payload = {
        time_period_start: start?.format('HH:mm') || '',
        time_period_end: end?.format('HH:mm') || '',
        price_per_kwh: values.price_per_kwh,
        priority: values.priority ?? 0,
        description: values.description,
        effective_date: values.effective_date?.format('YYYY-MM-DD'),
        expiry_date: values.expiry_date?.format('YYYY-MM-DD'),
        is_active: values.is_active ?? true,
      }
      if (editingRule) {
        updateRuleMutation.mutate({ ruleId: editingRule.id, data: payload })
      } else {
        createRuleMutation.mutate({ stationId: selectedStation.id, data: payload })
      }
    })
  }

  const handleExportStats = () => {
    if (!stats.summary) {
      message.warning('暂无统计数据')
      return
    }
    const workbook = XLSX.utils.book_new()
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['指标', '数值'],
      ['充电总电量(kWh)', stats.summary.total_energy ?? 0],
      ['总充电费用(元)', stats.summary.total_amount ?? 0],
      ['充电次数', stats.summary.total_sessions ?? 0],
      ['平均单价(元/kWh)', stats.summary.avg_price ?? 0],
    ])
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总')

    if (stats.stations?.length) {
      const stationSheet = XLSX.utils.json_to_sheet(
        stats.stations.map((item) => ({
          充电站: item.station_name,
          电量: item.total_energy,
          费用: item.total_amount,
          次数: item.sessions,
        })),
      )
      XLSX.utils.book_append_sheet(workbook, stationSheet, '站点排行')
    }

    if (stats.daily_trend?.length) {
      const trendSheet = XLSX.utils.json_to_sheet(
        stats.daily_trend.map((item) => ({
          日期: item.date,
          电量: item.energy,
          费用: item.amount,
        })),
      )
      XLSX.utils.book_append_sheet(workbook, trendSheet, '每日趋势')
    }

    XLSX.writeFile(workbook, `charging-stats-${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  }

  const handleDownloadTemplate = () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['开始时间', '结束时间', '单价(元/kWh)', '优先级', '描述', '生效日期', '失效日期', '启用(是/否)'],
      ['00:00', '06:00', 0.65, 1, '夜间优惠', '2025-01-01', '', '是'],
      ['06:00', '12:00', 0.95, 2, '早高峰', '', '', '是'],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, '规则模板')
    XLSX.writeFile(workbook, 'charging-rule-template.xlsx')
  }

  const handleRuleImportFile = async (file: File) => {
    if (!selectedStation) {
      message.warning('请先在列表中选择充电站')
      return Upload.LIST_IGNORE
    }
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('未读取到工作表')
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
      const formatted: ChargingRuleTableRow[] = []
      rows.forEach((row) => {
        const start = (row['开始时间'] || row['start'] || row['time_period_start'] || '').toString().trim()
        const end = (row['结束时间'] || row['end'] || row['time_period_end'] || '').toString().trim()
        const priceRaw = row['单价(元/kWh)'] ?? row['单价'] ?? row['price_per_kwh']
        const price = priceRaw !== undefined && priceRaw !== null ? parseFloat(priceRaw) : NaN
        if (!start || !end || Number.isNaN(price)) {
          return
        }
        formatted.push({
          time_period_start: start,
          time_period_end: end,
          price_per_kwh: price,
          priority: Number(row['优先级'] ?? row['priority'] ?? 0) || 0,
          description: row['描述'] ?? row['description'] ?? '',
          effective_date: row['生效日期'] || row['effective_date'] || '',
          expiry_date: row['失效日期'] || row['expiry_date'] || '',
          is_active: `${row['启用(是/否)'] ?? row['is_active'] ?? '是'}`.trim() !== '否',
        })
      })

      if (!formatted.length) {
        message.warning('未解析到任何有效规则，请检查文件列名')
        return Upload.LIST_IGNORE
      }
      saveRuleTableMutation.mutate({ stationId: selectedStation.id, rows: formatted })
    } catch (error) {
      message.error((error as Error).message || '解析文件失败')
    }
    return Upload.LIST_IGNORE
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            充电站与电价管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            维护充电站信息、时段电价，并查看充电统计。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['charging'] })}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setStationModalOpen(true)}>
            新增充电站
          </Button>
        </Space>
      </Flex>

      <Tabs
        items={[
          {
            key: 'overview',
            label: '充电统计',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card
                  extra={
                    <Button icon={<DownloadOutlined />} onClick={handleExportStats} disabled={!stats.summary}>
                      导出统计
                    </Button>
                  }
                >
                  <Form
                    layout="inline"
                    initialValues={{
                      stationId: statsFilters.stationId,
                      dateRange: statsFilters.dateRange,
                    }}
                    onFinish={(values) =>
                      setStatsFilters({
                        stationId: values.stationId,
                        dateRange: values.dateRange,
                      })
                    }
                  >
                    <Form.Item name="stationId" label="充电站">
                      <Select
                        allowClear
                        placeholder="选择充电站"
                        options={(stationsQuery.data || []).map((station) => ({
                          value: station.id,
                          label: station.station_name,
                        }))}
                        style={{ width: 220 }}
                      />
                    </Form.Item>
                    <Form.Item name="dateRange" label="日期范围">
                      <RangePicker allowClear style={{ width: 260 }} />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        查询
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>

                <Row gutter={16}>
                  {summaryCards.map((card) => (
                    <Col xs={24} sm={12} md={6} key={card.title}>
                      <Card>
                        <Statistic title={card.title} value={card.value} prefix={card.icon} precision={2} />
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Row gutter={16}>
                  <Col span={14}>
                    <Card title="每日趋势">
                      {trendData.length ? (
                        <Line
                          data={trendData}
                          xField="date"
                          yField="value"
                          seriesField="type"
                          smooth
                          height={320}
                          tooltip={{ showMarkers: false }}
                        />
                      ) : (
                        <Alert type="info" message="暂无趋势数据" showIcon />
                      )}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title="充电站排名 (按电量)">
                      {stationRankingData.length ? (
                        <Column
                          data={stationRankingData}
                          xField="station"
                          yField="energy"
                          height={320}
                          columnStyle={{ radius: [4, 4, 0, 0] }}
                          tooltip={{
                            fields: ['energy', 'amount'],
                            formatter: (datum: { energy: number }) => ({ name: '电量(kWh)', value: datum.energy }),
                          }}
                        />
                      ) : (
                        <Alert type="info" message="暂无数据" showIcon />
                      )}
                    </Card>
                  </Col>
                </Row>
              </Space>
            ),
          },
          {
            key: 'stations',
            label: '充电站列表',
            children: (
              <Card>
                {stationsQuery.error && <Alert type="error" showIcon message={(stationsQuery.error as Error).message || '加载失败'} />}
                <Table
                  rowKey="id"
                  columns={stationColumns}
                  dataSource={stationsQuery.data || []}
                  loading={stationsQuery.isLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1200 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Drawer
        title={selectedStation ? `${selectedStation.station_name} · 详情` : '充电站详情'}
        width={760}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false)
          setSelectedStation(null)
        }}
      >
        {selectedStation ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Descriptions column={2}>
                <Descriptions.Item label="充电站名称">{selectedStation.station_name}</Descriptions.Item>
                <Descriptions.Item label="编码">{selectedStation.station_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>
                  {selectedStation.location || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="联系人">
                  {selectedStation.contact_person || '-'}
                  {selectedStation.contact_phone && (
                    <div>
                      <PhoneOutlined /> {selectedStation.contact_phone}
                    </div>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedStation.is_active ? 'green' : 'default'}>{selectedStation.is_active ? '启用' : '停用'}</Tag>
                </Descriptions.Item>
              </Descriptions>
              {selectedStation.description && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">备注：{selectedStation.description}</Text>
                </div>
              )}
            </Card>

            <Card
              title="时段电价"
              extra={
                <Space>
                  <Button onClick={handleDownloadTemplate}>下载模板</Button>
                  <Button onClick={() => setImportModalOpen(true)} disabled={!selectedStation}>
                    批量导入
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      setEditingRule(null)
                      ruleForm.resetFields()
                      setRuleModalOpen(true)
                    }}
                  >
                    新增规则
                  </Button>
                </Space>
              }
            >
              {rulesQuery.error && <Alert type="error" showIcon message={(rulesQuery.error as Error).message || '加载失败'} />}
              <Table
                rowKey="id"
                columns={ruleColumns}
                dataSource={rulesQuery.data || []}
                loading={rulesQuery.isLoading}
                pagination={false}
                size="middle"
              />
            </Card>

            <Card title="费用试算">
              <Form
                layout="inline"
                form={calculatorForm}
                initialValues={{
                  station_id: selectedStation.id,
                  charging_time: dayjs(),
                  energy_kwh: 50,
                }}
                onFinish={(values) =>
                  calculatorMutation.mutate({
                    station_id: selectedStation.id,
                    charging_time: values.charging_time?.toISOString(),
                    time_slot: values.time_slot?.format('HH:mm'),
                    energy_kwh: values.energy_kwh,
                    fallback_price: values.fallback_price,
                  })
                }
              >
                <Form.Item name="energy_kwh" label="电量 (kWh)" rules={[{ required: true }]}>
                  <InputNumber min={0} precision={2} style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="charging_time" label="充电时间">
                  <DatePicker showTime style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name="time_slot" label="时段">
                  <TimePicker style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="fallback_price" label="默认单价">
                  <InputNumber min={0} precision={4} style={{ width: 140 }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={calculatorMutation.isPending}>
                    计算
                  </Button>
                </Form.Item>
              </Form>
              {calculatorMutation.data && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>单价：</Text>¥ {calculatorMutation.data.price_per_kwh.toFixed(4)} 元/kWh
                  <br />
                  <Text strong>预计费用：</Text>¥ {calculatorMutation.data.amount.toFixed(2)}
                </div>
              )}
            </Card>
          </Space>
        ) : (
          <Alert type="info" message="请选择充电站" showIcon />
        )}
      </Drawer>

      <Modal
        title={editingStation ? '编辑充电站' : '新建充电站'}
        open={stationModalOpen}
        onCancel={() => {
          stationForm.resetFields()
          setEditingStation(null)
          setStationModalOpen(false)
        }}
        onOk={handleStationModalOk}
        confirmLoading={editingStation ? updateStationMutation.isPending : createStationMutation.isPending}
      >
        <Form layout="vertical" form={stationForm}>
          <Form.Item label="充电站名称" name="station_name" rules={[{ required: true }]}>
            <Input placeholder="请输入充电站名称" />
          </Form.Item>
          <Form.Item label="充电站编码" name="station_code">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item label="位置" name="location">
            <Input placeholder="地址/定位" />
          </Form.Item>
          <Form.Item label="联系人" name="contact_person">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="contact_phone">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRule ? '编辑价格规则' : '新增价格规则'}
        open={ruleModalOpen}
        onCancel={() => {
          setRuleModalOpen(false)
          setEditingRule(null)
          ruleForm.resetFields()
        }}
        onOk={handleRuleModalOk}
        confirmLoading={editingRule ? updateRuleMutation.isPending : createRuleMutation.isPending}
      >
        <Form layout="vertical" form={ruleForm}>
          <Form.Item label="时段" name="time_range" rules={[{ required: true, message: '请选择时段' }]}>
            <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} minuteStep={15} />
          </Form.Item>
          <Form.Item label="单价 (元/kWh)" name="price_per_kwh" rules={[{ required: true }]}>
            <InputNumber min={0} precision={4} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="生效日期" name="effective_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="失效日期" name="expiry_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="启用状态" name="is_active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入价格规则"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        {selectedStation ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert message="请使用模板填写规则后上传，时间格式为 HH:MM。" type="info" showIcon />
            <Dragger beforeUpload={handleRuleImportFile} showUploadList={false} disabled={saveRuleTableMutation.isPending}>
              <p className="ant-upload-drag-icon">
                <DownloadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此上传</p>
              <p className="ant-upload-hint">支持 .xlsx / .xls 文件，最多 24 条规则</p>
            </Dragger>
            <Button onClick={handleDownloadTemplate}>下载导入模板</Button>
          </Space>
        ) : (
          <Alert type="warning" showIcon message="请先在列表中选择一个充电站" />
        )}
      </Modal>
    </Space>
  )
}

const LightningIcon = () => <AimOutlined style={{ color: '#faad14' }} />

export default ChargingStationsPage

