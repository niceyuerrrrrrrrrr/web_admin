import React, { useState, useMemo } from 'react'
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
  Tag,
  Popconfirm,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  DollarOutlined,
  SettingOutlined,
  CalculatorOutlined,
  ReloadOutlined,
  SaveOutlined,
  CheckOutlined,
  SendOutlined,
  TeamOutlined,
  MoneyCollectOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  fetchGlobalConfigs,
  createOrUpdateGlobalConfig,
  fetchAvailableStaff,
  fetchUserConfigs,
  batchCreateUserConfigs,
  fetchSalarySummary,
  calculateSalary,
  batchConfirmSalary,
  batchSendSalary,
  batchSendSalaryByIds,
  type GlobalConfig,
  type AvailableStaff,
  type UserConfig,
  type SalarySummary,
} from '../api/services/staffSalary'
import { fetchUsers } from '../api/services/users'
import { fetchDepartments } from '../api/services/departments'
import useCompanyStore from '../store/company'
import useAuthStore from '../store/auth'

const StaffSalaryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('salary')
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    dayjs().format('YYYY-MM'),
  )
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>()
  const [globalConfigForm] = Form.useForm()
  const [userConfigForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editingConfigs, setEditingConfigs] = useState<Record<number, any>>({})
  const queryClient = useQueryClient()
  const { selectedCompanyId } = useCompanyStore()
  const { user: currentUser } = useAuthStore()

  // 权限检查
  const canManageSalary =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'general_manager' ||
    currentUser?.role === 'finance' ||
    currentUser?.positionType === '超级管理员' ||
    currentUser?.positionType === '总经理' ||
    currentUser?.positionType === '财务'

  // ==================== 数据查询 ====================

  // 查询全局配置
  const { data: globalConfigsData, refetch: refetchGlobalConfigs } = useQuery({
    queryKey: ['staff-salary-global-configs', selectedPeriod, selectedCompanyId],
    queryFn: () =>
      fetchGlobalConfigs({
        period: selectedPeriod,
        company_id: selectedCompanyId,
      }),
    enabled: !!selectedCompanyId && activeTab === 'global-config',
  })

  // 查询可配置的人员列表（从users表读取）
  const { data: availableStaffData, refetch: refetchAvailableStaff } = useQuery({
    queryKey: ['staff-salary-available-staff', selectedCompanyId, selectedDepartmentId],
    queryFn: () =>
      fetchAvailableStaff({
        company_id: selectedCompanyId,
        department_id: selectedDepartmentId,
      }),
    enabled: !!selectedCompanyId && activeTab === 'user-config',
  })

  // 查询已配置的人员工资（用于回填）
  const { data: userConfigsData, refetch: refetchUserConfigs } = useQuery({
    queryKey: [
      'staff-salary-user-configs',
      selectedPeriod,
      selectedCompanyId,
      selectedDepartmentId,
    ],
    queryFn: () =>
      fetchUserConfigs({
        period: selectedPeriod,
        company_id: selectedCompanyId,
        department_id: selectedDepartmentId,
      }),
    enabled: !!selectedCompanyId && activeTab === 'user-config',
  })

  // 查询工资汇总
  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: [
      'staff-salary-summary',
      selectedPeriod,
      selectedCompanyId,
      selectedDepartmentId,
    ],
    queryFn: () =>
      fetchSalarySummary({
        period: selectedPeriod,
        company_id: selectedCompanyId,
        department_id: selectedDepartmentId,
      }),
    enabled: !!selectedCompanyId && !!selectedPeriod && activeTab === 'salary',
  })

  // 查询用户列表（用于人员配置）
  const { data: usersData } = useQuery({
    queryKey: ['users-for-staff-salary', selectedCompanyId],
    queryFn: () =>
      fetchUsers({
        company_id: selectedCompanyId,
        size: 1000,
      }),
    enabled: !!selectedCompanyId && activeTab === 'user-config',
  })

  // 查询部门列表
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', selectedCompanyId],
    queryFn: () => fetchDepartments({ company_id: selectedCompanyId }),
    enabled: !!selectedCompanyId,
  })

  // ==================== Mutations ====================

  // 保存全局配置
  const saveGlobalConfigMutation = useMutation({
    mutationFn: createOrUpdateGlobalConfig,
    onSuccess: () => {
      message.success('全局配置已保存')
      refetchGlobalConfigs()
      globalConfigForm.resetFields()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '保存失败')
    },
  })

  // 批量保存人员配置
  const batchSaveUserConfigsMutation = useMutation({
    mutationFn: batchCreateUserConfigs,
    onSuccess: (res: any) => {
      if (res.error_count > 0) {
        // 有错误，显示详细错误信息
        const errorMsg = res.errors?.join('; ') || '部分配置保存失败'
        message.error(
          `保存完成：成功 ${res.success_count}，失败 ${res.error_count}。错误：${errorMsg}`,
          5,
        )
      } else {
        message.success(
          `保存完成：成功 ${res.success_count}，失败 ${res.error_count}`,
        )
      }
      refetchAvailableStaff()
      refetchUserConfigs()
      setEditingConfigs({})
    },
    onError: (error: any) => {
      message.error(error.message || error.response?.data?.message || '保存失败')
    },
  })

  // 计算工资
  const calculateMutation = useMutation({
    mutationFn: calculateSalary,
    onSuccess: (res: any) => {
      message.success(res.message || '计算完成')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '计算失败')
    },
  })

  // 批量确认
  const batchConfirmMutation = useMutation({
    mutationFn: batchConfirmSalary,
    onSuccess: (res: any) => {
      message.success(res.message || '确认成功')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '确认失败')
    },
  })

  // 批量发放
  const batchSendMutation = useMutation({
    mutationFn: batchSendSalary,
    onSuccess: (res: any) => {
      message.success(res.message || '发放成功')
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '发放失败')
    },
  })

  // 按选中ID批量发放
  const batchSendByIdsMutation = useMutation({
    mutationFn: batchSendSalaryByIds,
    onSuccess: (res: any) => {
      message.success(
        `发放完成：成功 ${res.success}，失败 ${res.failed}，已推送 ${res.notify_sent}`,
      )
      setSelectedRowKeys([])
      refetchSummary()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '发放失败')
    },
  })

  // ==================== 事件处理 ====================

  const handleSaveGlobalConfig = () => {
    globalConfigForm.validateFields().then((values) => {
      saveGlobalConfigMutation.mutate({
        period: selectedPeriod,
        company_id: selectedCompanyId!,
        department_id: values.department_id,
        performance_x: values.performance_x,
      })
    })
  }

  const handleSaveUserConfigs = () => {
    // 合并编辑的配置和原始配置，确保所有字段都有值
    const configs = Object.entries(editingConfigs).map(([userId, editedConfig]) => {
      const originalConfig = mergedStaffConfigs.find(c => c.user_id === parseInt(userId))
      return {
        user_id: parseInt(userId),
        base_salary: editedConfig.base_salary ?? originalConfig?.base_salary ?? 0,
        leader_ratio: editedConfig.leader_ratio ?? originalConfig?.leader_ratio ?? 0,
        managed_department_ids: editedConfig.managed_department_ids ?? originalConfig?.managed_department_ids ?? [],
      }
    })

    if (configs.length === 0) {
      message.warning('请先编辑人员配置')
      return
    }

    batchSaveUserConfigsMutation.mutate({
      period: selectedPeriod,
      configs,
    })
  }

  const handleCalculate = () => {
    calculateMutation.mutate({
      period: selectedPeriod,
      company_id: selectedCompanyId,
    })
  }

  const handleBatchConfirm = () => {
    batchConfirmMutation.mutate({
      period: selectedPeriod,
      company_id: selectedCompanyId,
      department_id: selectedDepartmentId,
    })
  }

  const handleBatchSend = () => {
    batchSendMutation.mutate({
      period: selectedPeriod,
      company_id: selectedCompanyId,
      department_id: selectedDepartmentId,
    })
  }

  const handleBatchSendByIds = () => {
    batchSendByIdsMutation.mutate({
      summary_ids: selectedRowKeys.map((k) => Number(k)),
    })
  }

  // ==================== 表格列定义 ====================

  // 合并可配置人员和已配置数据
  const mergedStaffConfigs = useMemo(() => {
    const staff = availableStaffData?.staff || []
    const configs = userConfigsData?.configs || []
    
    // 创建已配置数据的映射
    const configMap = new Map(configs.map(c => [c.user_id, c]))
    
    // 合并数据
    return staff.map(s => {
      const existingConfig = configMap.get(s.user_id)
      return {
        user_id: s.user_id,
        user_name: s.user_name,
        department_id: s.department_id,
        department_name: s.department_name,
        position_type: s.position_type,
        base_salary: existingConfig?.base_salary || 0,
        leader_ratio: existingConfig?.leader_ratio || 0,
        managed_department_ids: existingConfig?.managed_department_ids || [],
        is_active: existingConfig?.is_active ?? true,
      }
    })
  }, [availableStaffData, userConfigsData])

  const userConfigColumns = [
    {
      title: '姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 150,
    },
    {
      title: '职位',
      dataIndex: 'position_type',
      key: 'position_type',
      width: 100,
      render: (text: string) => (
        <Tag color={text === '车队长' ? 'blue' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '基本工资',
      dataIndex: 'base_salary',
      key: 'base_salary',
      width: 150,
      render: (value: number, record: any) => (
        <InputNumber
          value={editingConfigs[record.user_id]?.base_salary ?? value}
          onChange={(val) =>
            setEditingConfigs({
              ...editingConfigs,
              [record.user_id]: {
                ...editingConfigs[record.user_id],
                base_salary: val || 0,
              },
            })
          }
          min={0}
          precision={2}
          style={{ width: '100%' }}
          placeholder="请输入基本工资"
        />
      ),
    },
    {
      title: '车队长比例',
      dataIndex: 'leader_ratio',
      key: 'leader_ratio',
      width: 150,
      render: (value: number, record: any) =>
        record.position_type === '车队长' ? (
          <InputNumber
            value={editingConfigs[record.user_id]?.leader_ratio ?? value}
            onChange={(val) =>
              setEditingConfigs({
                ...editingConfigs,
                [record.user_id]: {
                  ...editingConfigs[record.user_id],
                  leader_ratio: val || 0,
                },
              })
            }
            min={0}
            max={1}
            step={0.01}
            precision={4}
            style={{ width: '100%' }}
            placeholder="0-1之间"
          />
        ) : (
          <span>-</span>
        ),
    },
    {
      title: '管理部门',
      dataIndex: 'managed_department_ids',
      key: 'managed_department_ids',
      width: 250,
      render: (value: number[], record: any) =>
        record.position_type === '车队长' ? (
          <Select
            mode="multiple"
            placeholder="选择管理的司机部门"
            value={editingConfigs[record.user_id]?.managed_department_ids ?? value}
            onChange={(val) =>
              setEditingConfigs({
                ...editingConfigs,
                [record.user_id]: {
                  ...editingConfigs[record.user_id],
                  managed_department_ids: val,
                },
              })
            }
            style={{ width: '100%' }}
            options={departmentsData?.records
              ?.filter((d: any) => d.title !== '行政部门')
              ?.map((d: any) => ({
                label: d.title,
                value: d.id,
              }))}
          />
        ) : (
          <span>-</span>
        ),
    },
  ]

  const summaryColumns = [
    {
      title: '姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '职位',
      dataIndex: 'position_type',
      key: 'position_type',
      width: 100,
      render: (text: string) => (
        <Tag color={text === '车队长' ? 'blue' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '基本工资',
      dataIndex: 'base_salary',
      key: 'base_salary',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '绩效奖金',
      dataIndex: 'performance_bonus',
      key: 'performance_bonus',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '应发工资',
      dataIndex: 'total_salary',
      key: 'total_salary',
      width: 120,
      render: (val: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          ¥{val.toFixed(2)}
        </span>
      ),
    },
    {
      title: '车队长比例',
      dataIndex: 'leader_ratio',
      key: 'leader_ratio',
      width: 100,
      render: (val: number, record: SalarySummary) =>
        record.position_type === '车队长' ? `${(val * 100).toFixed(2)}%` : '-',
    },
    {
      title: '部门司机趟数',
      dataIndex: 'dept_driver_trips',
      key: 'dept_driver_trips',
      width: 120,
      render: (val: number, record: SalarySummary) =>
        record.position_type === '车队长' ? val : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap = {
          pending: { text: '待确认', color: 'orange' },
          confirmed: { text: '已确认', color: 'blue' },
          sent: { text: '已发放', color: 'green' },
        }
        const s = statusMap[status as keyof typeof statusMap] || {
          text: status,
          color: 'default',
        }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '确认时间',
      dataIndex: 'confirmed_at',
      key: 'confirmed_at',
      width: 150,
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '发放时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      width: 150,
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ]

  // ==================== 渲染 ====================

  if (!canManageSalary) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <p>您没有权限访问此页面</p>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'salary',
              label: (
                <span>
                  <DollarOutlined />
                  工资汇总
                </span>
              ),
              children: (
                <div>
                  {/* KPI统计卡片 */}
                  {summaryData?.statistics && (
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="总人数"
                            value={summaryData.statistics.total_count}
                            prefix={<TeamOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="工资总额"
                            value={summaryData.statistics.total_salary}
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
                            value={`${summaryData.statistics.confirmed_count} / ${summaryData.statistics.total_count}`}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card>
                          <Statistic
                            title="已发放"
                            value={`${summaryData.statistics.sent_count} / ${summaryData.statistics.total_count}`}
                          />
                        </Card>
                      </Col>
                    </Row>
                  )}

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <DatePicker
                        picker="month"
                        value={dayjs(selectedPeriod, 'YYYY-MM')}
                        onChange={(date) =>
                          setSelectedPeriod(date?.format('YYYY-MM') || '')
                        }
                        format="YYYY-MM"
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="全部部门"
                        allowClear
                        value={selectedDepartmentId}
                        onChange={setSelectedDepartmentId}
                        style={{ width: '100%' }}
                        options={departmentsData?.records?.map((d: any) => ({
                          label: d.title,
                          value: d.id,
                        }))}
                      />
                    </Col>
                    <Col span={12}>
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => refetchSummary()}
                        >
                          刷新
                        </Button>
                        <Popconfirm
                          title="确认要计算工资吗？"
                          onConfirm={handleCalculate}
                        >
                          <Button
                            type="primary"
                            icon={<CalculatorOutlined />}
                            loading={calculateMutation.isPending}
                          >
                            计算工资
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="确认要批量确认吗？"
                          onConfirm={handleBatchConfirm}
                        >
                          <Button
                            icon={<CheckOutlined />}
                            loading={batchConfirmMutation.isPending}
                          >
                            批量确认
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title="确认要批量发放吗？将推送订阅消息"
                          onConfirm={handleBatchSend}
                        >
                          <Button
                            icon={<SendOutlined />}
                            loading={batchSendMutation.isPending}
                          >
                            批量发放
                          </Button>
                        </Popconfirm>
                        {selectedRowKeys.length > 0 && (
                          <Popconfirm
                            title={`确认发放选中的 ${selectedRowKeys.length} 条记录吗？`}
                            onConfirm={handleBatchSendByIds}
                          >
                            <Button
                              type="primary"
                              icon={<SendOutlined />}
                              loading={batchSendByIdsMutation.isPending}
                            >
                              发放选中
                            </Button>
                          </Popconfirm>
                        )}
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={summaryColumns}
                    dataSource={summaryData?.summaries || []}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 1400 }}
                    summary={() => {
                      if (!summaryData?.statistics) return null
                      return (
                        <Table.Summary fixed>
                          <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                            <Table.Summary.Cell index={0} colSpan={3}>
                              <strong>总计</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3}>
                              <strong style={{ color: '#1890ff' }}>
                                ¥{summaryData.statistics.total_base_salary.toFixed(2)}
                              </strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4}>
                              <strong style={{ color: '#1890ff' }}>
                                ¥{summaryData.statistics.total_performance_bonus.toFixed(2)}
                              </strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5}>
                              <strong style={{ color: '#1890ff', fontSize: 16 }}>
                                ¥{summaryData.statistics.total_salary.toFixed(2)}
                              </strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} colSpan={4} />
                          </Table.Summary.Row>
                        </Table.Summary>
                      )
                    }}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                      getCheckboxProps: (record: SalarySummary) => ({
                        disabled: record.status !== 'confirmed',
                      }),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'user-config',
              label: (
                <span>
                  <SettingOutlined />
                  人员配置
                </span>
              ),
              children: (
                <div>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <DatePicker
                        picker="month"
                        value={dayjs(selectedPeriod, 'YYYY-MM')}
                        onChange={(date) =>
                          setSelectedPeriod(date?.format('YYYY-MM') || '')
                        }
                        format="YYYY-MM"
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="全部部门"
                        allowClear
                        value={selectedDepartmentId}
                        onChange={setSelectedDepartmentId}
                        style={{ width: '100%' }}
                        options={departmentsData?.records?.map((d: any) => ({
                          label: d.title,
                          value: d.id,
                        }))}
                      />
                    </Col>
                    <Col span={12}>
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            refetchAvailableStaff()
                            refetchUserConfigs()
                          }}
                        >
                          刷新
                        </Button>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          onClick={handleSaveUserConfigs}
                          loading={batchSaveUserConfigsMutation.isPending}
                          disabled={Object.keys(editingConfigs).length === 0}
                        >
                          保存配置
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={userConfigColumns}
                    dataSource={mergedStaffConfigs}
                    rowKey="user_id"
                    pagination={false}
                    loading={availableStaffData === undefined || userConfigsData === undefined}
                  />
                </div>
              ),
            },
            {
              key: 'global-config',
              label: (
                <span>
                  <SettingOutlined />
                  全局配置
                </span>
              ),
              children: (
                <div>
                  <Card title="绩效单价配置" style={{ marginBottom: 16 }}>
                    <Form
                      form={globalConfigForm}
                      layout="inline"
                      onFinish={handleSaveGlobalConfig}
                    >
                      <Form.Item
                        name="department_id"
                        label="部门"
                        style={{ width: 200 }}
                      >
                        <Select
                          placeholder="全公司（可选）"
                          allowClear
                          options={departmentsData?.records?.map((d: any) => ({
                            label: d.title,
                            value: d.id,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name="performance_x"
                        label="绩效单价（元/趟）"
                        rules={[{ required: true, message: '请输入绩效单价' }]}
                        style={{ width: 200 }}
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          placeholder="每趟多少元"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={saveGlobalConfigMutation.isPending}
                        >
                          保存
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>

                  <Card title="已有配置">
                    <Table
                      columns={[
                        {
                          title: '周期',
                          dataIndex: 'period',
                          key: 'period',
                        },
                        {
                          title: '部门',
                          dataIndex: 'department_id',
                          key: 'department_id',
                          render: (id: number) => {
                            const dept = departmentsData?.records?.find(
                              (d: any) => d.id === id,
                            )
                            return dept?.title || '全公司'
                          },
                        },
                        {
                          title: '绩效单价（元/趟）',
                          dataIndex: 'performance_x',
                          key: 'performance_x',
                          render: (val: number) => `¥${val.toFixed(2)}`,
                        },
                        {
                          title: '创建时间',
                          dataIndex: 'created_at',
                          key: 'created_at',
                          render: (val: string) =>
                            dayjs(val).format('YYYY-MM-DD HH:mm'),
                        },
                      ]}
                      dataSource={globalConfigsData?.configs || []}
                      rowKey="id"
                      pagination={false}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default StaffSalaryPage
