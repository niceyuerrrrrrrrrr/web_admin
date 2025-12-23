import React, { useState } from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Space,
  message,
  Modal,
  Checkbox,
  Tag,
  Popconfirm,
  DatePicker,
  Statistic,
  Row,
  Col,
  Descriptions,
  Tooltip,
  Select,
} from 'antd'
import {
  DollarOutlined,
  SettingOutlined,
  CalculatorOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  fetchGlobalConfig,
  createOrUpdateGlobalConfig,
  fetchDriverConfigList,
  createOrUpdateDriverConfig,
  fetchSalarySummaryList,
  calculateDriverSalary,
  batchCalculateSalary,
  confirmSalary,
  sendSalarySlip,
  type GlobalConfig,
  type SalarySummary,
} from '../api/services/driverSalary'
import { fetchUsers } from '../api/services/users'
import { fetchDepartments } from '../api/services/departments'
import useCompanyStore from '../store/company'

const DriverSalaryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('salary')
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    dayjs().format('YYYY-MM'),
  )
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>()
  const [globalConfigForm] = Form.useForm()
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState<SalarySummary | null>(
    null,
  )
  const [editingConfig, setEditingConfig] = useState<Record<number, any>>({})
  const queryClient = useQueryClient()
  const { selectedCompanyId } = useCompanyStore()

  // ==================== 全局配置 ====================

  const { data: globalConfigData, refetch: refetchGlobalConfig } = useQuery({
    queryKey: ['globalConfig', selectedPeriod],
    queryFn: () => fetchGlobalConfig(selectedPeriod),
    enabled: activeTab === 'config',
  })

  const saveGlobalConfigMutation = useMutation({
    mutationFn: createOrUpdateGlobalConfig,
    onSuccess: () => {
      message.success('全局配置保存成功')
      refetchGlobalConfig()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '保存失败')
    },
  })

  const handleSaveGlobalConfig = () => {
    globalConfigForm.validateFields().then((values) => {
      saveGlobalConfigMutation.mutate({
        ...values,
        effective_period: selectedPeriod,
      })
    })
  }

  // ==================== 工资汇总 ====================

  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['salarySummary', selectedPeriod],
    queryFn: () => fetchSalarySummaryList({ period: selectedPeriod }),
    enabled: activeTab === 'salary',
  })

  const { data: driverConfigData, refetch: refetchDriverConfig } = useQuery({
    queryKey: ['driverConfig', selectedPeriod],
    queryFn: () => fetchDriverConfigList({ period: selectedPeriod }),
    enabled: activeTab === 'salary',
  })

  // 获取部门列表
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', selectedCompanyId],
    queryFn: () => fetchDepartments({ company_id: selectedCompanyId }),
    enabled: !!selectedCompanyId,
  })

  // 获取所有司机列表（按公司和部门过滤）
  const { data: usersData } = useQuery({
    queryKey: ['drivers', selectedCompanyId, selectedDepartmentId],
    queryFn: () => fetchUsers({ 
      company_id: selectedCompanyId || undefined,
      department_id: selectedDepartmentId,
    }),
    enabled: activeTab === 'salary' && !!selectedCompanyId,
  })

  // 批量计算工资
  const batchCalculateMutation = useMutation({
    mutationFn: batchCalculateSalary,
    onSuccess: () => {
      message.success('批量计算完成')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '计算失败')
    },
  })

  // 保存司机配置
  const saveDriverConfigMutation = useMutation({
    mutationFn: createOrUpdateDriverConfig,
    onSuccess: () => {
      message.success('配置保存成功')
      refetchDriverConfig()
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '保存失败')
    },
  })

  // 单个计算工资
  const calculateMutation = useMutation({
    mutationFn: calculateDriverSalary,
    onSuccess: () => {
      message.success('计算完成')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '计算失败')
    },
  })

  // 确认工资
  const confirmMutation = useMutation({
    mutationFn: confirmSalary,
    onSuccess: () => {
      message.success('确认成功')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '确认失败')
    },
  })

  // 发放工资条
  const sendMutation = useMutation({
    mutationFn: sendSalarySlip,
    onSuccess: () => {
      message.success('发放成功')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '发放失败')
    },
  })

  const handleViewDetail = (record: SalarySummary) => {
    setSelectedSummary(record)
    setDetailModalVisible(true)
  }

  // 处理配置变更
  const handleConfigChange = (userId: number, field: string, value: any) => {
    setEditingConfig((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value,
      },
    }))
  }

  // 保存单个司机配置
  const handleSaveConfig = (userId: number) => {
    const config = editingConfig[userId]
    if (!config) {
      message.warning('没有修改')
      return
    }

    saveDriverConfigMutation.mutate({
      user_id: userId,
      has_safety_bonus: config.has_safety_bonus ?? false,
      has_attendance_bonus: config.has_attendance_bonus ?? false,
      has_hygiene_bonus: config.has_hygiene_bonus ?? false,
      has_energy_saving_bonus: config.has_energy_saving_bonus ?? false,
      deduction: config.deduction ?? 0,
      deduction_reason: config.deduction_reason ?? '',
      effective_period: selectedPeriod,
    })

    // 清除编辑状态
    setEditingConfig((prev) => {
      const newState = { ...prev }
      delete newState[userId]
      return newState
    })
  }

  // 合并汇总数据和配置数据
  const summaryList = summaryData?.data || []
  const configList = driverConfigData?.data || []
  
  const allUsers = (usersData as any)?.items || []
  
  const configMap = new Map(configList.map((c) => [c.user_id, c]))
  const summaryMap = new Map(summaryList.map((s) => [s.user_id, s]))

  // 从所有用户中筛选司机，并合并工资汇总和配置信息
  const mergedData = allUsers
    .filter((user: any) => {
      // 严格筛选：只显示职位类型为"司机"的用户
      const isDriver = user.position_type === '司机' || user.positionType === '司机'
      return isDriver
    })
    .map((user: any) => {
      const summary = summaryMap.get(user.id)
      const config = configMap.get(user.id)
      const editing = editingConfig[user.id] || {}
      
      // 如果有工资汇总数据，使用汇总数据；否则创建默认数据
      if (summary) {
        return {
          ...summary,
          config: config || {
            has_safety_bonus: false,
            has_attendance_bonus: false,
            has_hygiene_bonus: false,
            has_energy_saving_bonus: false,
            deduction: 0,
            deduction_reason: '',
          },
          editing,
        }
      } else {
        // 没有工资汇总数据，创建默认记录
        return {
          id: user.id,
          user_id: user.id,
          user_name: user.name,
          period: selectedPeriod,
          trip_count: 0,
          trip_income: 0,
          safety_bonus: 0,
          attendance_bonus: 0,
          hygiene_bonus: 0,
          energy_saving_bonus: 0,
          total_bonus: 0,
          deduction: 0,
          gross_salary: 0,
          net_salary: 0,
          status: 'pending',
          config: config || {
            has_safety_bonus: false,
            has_attendance_bonus: false,
            has_hygiene_bonus: false,
            has_energy_saving_bonus: false,
            deduction: 0,
            deduction_reason: '',
          },
          editing,
        }
      }
    })

  // ==================== 表格列定义 ====================

  const salaryColumns = [
    {
      title: '司机姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '趟数',
      dataIndex: 'trip_count',
      key: 'trip_count',
      width: 80,
    },
    {
      title: '基本工资',
      dataIndex: 'trip_income',
      key: 'trip_income',
      width: 120,
      render: (value: number, record: any) => (
        <Tooltip title={`${record.trip_count} 趟 × 单价`}>
          ¥{value.toFixed(2)}
        </Tooltip>
      ),
    },
    {
      title: '安全奖',
      key: 'safety_bonus',
      width: 80,
      render: (_: any, record: any) => (
        <Checkbox
          checked={
            record.editing.has_safety_bonus !== undefined
              ? record.editing.has_safety_bonus
              : record.config.has_safety_bonus
          }
          onChange={(e) =>
            handleConfigChange(
              record.user_id,
              'has_safety_bonus',
              e.target.checked,
            )
          }
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '全勤奖',
      key: 'attendance_bonus',
      width: 80,
      render: (_: any, record: any) => (
        <Checkbox
          checked={
            record.editing.has_attendance_bonus !== undefined
              ? record.editing.has_attendance_bonus
              : record.config.has_attendance_bonus
          }
          onChange={(e) =>
            handleConfigChange(
              record.user_id,
              'has_attendance_bonus',
              e.target.checked,
            )
          }
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '卫生奖',
      key: 'hygiene_bonus',
      width: 80,
      render: (_: any, record: any) => (
        <Checkbox
          checked={
            record.editing.has_hygiene_bonus !== undefined
              ? record.editing.has_hygiene_bonus
              : record.config.has_hygiene_bonus
          }
          onChange={(e) =>
            handleConfigChange(
              record.user_id,
              'has_hygiene_bonus',
              e.target.checked,
            )
          }
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '节能奖',
      key: 'energy_saving_bonus',
      width: 80,
      render: (_: any, record: any) => (
        <Checkbox
          checked={
            record.editing.has_energy_saving_bonus !== undefined
              ? record.editing.has_energy_saving_bonus
              : record.config.has_energy_saving_bonus
          }
          onChange={(e) =>
            handleConfigChange(
              record.user_id,
              'has_energy_saving_bonus',
              e.target.checked,
            )
          }
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '总奖金',
      dataIndex: 'total_bonus',
      key: 'total_bonus',
      width: 100,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '扣款',
      key: 'deduction',
      width: 120,
      render: (_: any, record: any) => (
        <InputNumber
          size="small"
          value={
            record.editing.deduction !== undefined
              ? record.editing.deduction
              : record.config.deduction
          }
          onChange={(value) =>
            handleConfigChange(record.user_id, 'deduction', value || 0)
          }
          prefix="¥"
          min={0}
          precision={2}
          style={{ width: '100%' }}
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '扣款原因',
      key: 'deduction_reason',
      width: 150,
      render: (_: any, record: any) => (
        <Input
          size="small"
          value={
            record.editing.deduction_reason !== undefined
              ? record.editing.deduction_reason
              : record.config.deduction_reason
          }
          onChange={(e) =>
            handleConfigChange(
              record.user_id,
              'deduction_reason',
              e.target.value,
            )
          }
          placeholder="扣款原因"
          disabled={record.status !== 'pending'}
        />
      ),
    },
    {
      title: '应发工资',
      dataIndex: 'gross_salary',
      key: 'gross_salary',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '实发工资',
      dataIndex: 'net_salary',
      key: 'net_salary',
      width: 120,
      render: (value: number) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
          ¥{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待确认' },
          confirmed: { color: 'processing', text: '已确认' },
          sent: { color: 'success', text: '已发放' },
        }
        const config = statusMap[status] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              {editingConfig[record.user_id] && (
                <Button
                  type="link"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={() =>
                    handleSaveConfig(record.user_id)
                  }
                >
                  保存
                </Button>
              )}
              <Button
                type="link"
                size="small"
                onClick={() =>
                  calculateMutation.mutate({
                    user_id: record.user_id,
                    period: selectedPeriod,
                    force_recalculate: true,
                  })
                }
              >
                重算
              </Button>
              <Popconfirm
                title="确认工资？"
                onConfirm={() => confirmMutation.mutate(record.id)}
              >
                <Button type="link" size="small">
                  确认
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'confirmed' && (
            <Popconfirm
              title="发放工资条？"
              onConfirm={() => sendMutation.mutate(record.id)}
            >
              <Button type="link" size="small">
                发放
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // ==================== 统计数据 ====================

  const totalSalary = mergedData.reduce(
    (sum: number, item: any) => sum + item.net_salary,
    0,
  )
  const confirmedCount = mergedData.filter(
    (item: any) => item.status === 'confirmed' || item.status === 'sent',
  ).length
  const sentCount = mergedData.filter((item: any) => item.status === 'sent').length

  // ==================== 渲染 ====================

  React.useEffect(() => {
    if (globalConfigData?.data) {
      globalConfigForm.setFieldsValue(globalConfigData.data)
    }
  }, [globalConfigData, globalConfigForm])

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <DollarOutlined />
            <span>工资管理</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="选择部门"
              style={{ width: 150 }}
              allowClear
              value={selectedDepartmentId}
              onChange={(value: number | undefined) => setSelectedDepartmentId(value)}
              options={(departmentsData as any)?.records?.map((dept: any) => ({
                label: dept.title,
                value: dept.id,
              }))}
            />
            <DatePicker
              picker="month"
              value={dayjs(selectedPeriod)}
              onChange={(date) =>
                setSelectedPeriod(date?.format('YYYY-MM') || '')
              }
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (activeTab === 'config') refetchGlobalConfig()
                if (activeTab === 'salary') {
                  refetchSummary()
                  refetchDriverConfig()
                }
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 工资汇总（合并了配置功能） */}
          <Tabs.TabPane
            tab={
              <span>
                <CalculatorOutlined />
                工资管理
              </span>
            }
            key="salary"
          >
            {/* 统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总人数"
                    value={mergedData.length}
                    prefix={<DollarOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="工资总额"
                    value={totalSalary}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="已确认"
                    value={confirmedCount}
                    suffix={`/ ${summaryList.length}`}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="已发放"
                    value={sentCount}
                    suffix={`/ ${summaryList.length}`}
                  />
                </Card>
              </Col>
            </Row>

            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<CalculatorOutlined />}
                  onClick={() => batchCalculateMutation.mutate(selectedPeriod)}
                  loading={batchCalculateMutation.isPending}
                >
                  批量计算工资
                </Button>
                <span style={{ color: '#999', fontSize: 12 }}>
                  提示：勾选奖励项、填写扣款后，点击"保存"按钮，然后点击"重算"更新工资
                </span>
              </Space>
            </div>
            <Table
              columns={salaryColumns}
              dataSource={mergedData}
              rowKey="id"
              scroll={{ x: 1800 }}
              pagination={false}
            />
          </Tabs.TabPane>

          {/* 全局配置 */}
          <Tabs.TabPane
            tab={
              <span>
                <SettingOutlined />
                全局配置
              </span>
            }
            key="config"
          >
            <Form
              form={globalConfigForm}
              layout="vertical"
              style={{ maxWidth: 600 }}
            >
              <Form.Item
                label="单趟价格"
                name="price_per_trip"
                rules={[{ required: true, message: '请输入单趟价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                />
              </Form.Item>
              <Form.Item
                label="安全奖金额"
                name="safety_bonus_amount"
                rules={[{ required: true, message: '请输入安全奖金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                />
              </Form.Item>
              <Form.Item
                label="全勤奖金额"
                name="attendance_bonus_amount"
                rules={[{ required: true, message: '请输入全勤奖金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                />
              </Form.Item>
              <Form.Item
                label="卫生奖金额"
                name="hygiene_bonus_amount"
                rules={[{ required: true, message: '请输入卫生奖金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                />
              </Form.Item>
              <Form.Item
                label="节能奖金额"
                name="energy_saving_bonus_amount"
                rules={[{ required: true, message: '请输入节能奖金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  onClick={handleSaveGlobalConfig}
                  loading={saveGlobalConfigMutation.isPending}
                >
                  保存配置
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 工资详情弹窗 */}
      <Modal
        title="工资详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedSummary && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="司机姓名">
              {selectedSummary.user_name}
            </Descriptions.Item>
            <Descriptions.Item label="工资周期">
              {selectedSummary.period}
            </Descriptions.Item>
            <Descriptions.Item label="趟数">
              {selectedSummary.trip_count}
            </Descriptions.Item>
            <Descriptions.Item label="趟数收入">
              ¥{selectedSummary.trip_income.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="安全奖">
              ¥{selectedSummary.safety_bonus.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="全勤奖">
              ¥{selectedSummary.attendance_bonus.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="卫生奖">
              ¥{selectedSummary.hygiene_bonus.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="节能奖">
              ¥{selectedSummary.energy_saving_bonus.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="总奖金">
              ¥{selectedSummary.total_bonus.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="扣款">
              ¥{selectedSummary.deduction.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="应发工资">
              <span style={{ fontWeight: 'bold' }}>
                ¥{selectedSummary.gross_salary.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="实发工资">
              <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                ¥{selectedSummary.net_salary.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag
                color={
                  selectedSummary.status === 'sent'
                    ? 'success'
                    : selectedSummary.status === 'confirmed'
                      ? 'processing'
                      : 'default'
                }
              >
                {selectedSummary.status === 'sent'
                  ? '已发放'
                  : selectedSummary.status === 'confirmed'
                    ? '已确认'
                    : '待确认'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default DriverSalaryPage
