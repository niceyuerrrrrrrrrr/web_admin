import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import {
  approveMakeupApplication,
  createFence,
  deleteFence,
  fetchAttendanceAlerts,
  fetchAttendanceFences,
  fetchAttendanceHistory,
  fetchAttendanceStatistics,
  fetchCompanyAttendanceSummary,
  fetchMakeupApplications,
  fetchTodayShifts,
  resolveAlert,
  updateFence,
  type AttendanceAlert,
  type AttendanceFence,
  type AttendanceRecord,
  type AttendanceShift,
  type CompanyAttendanceSummary,
  type MakeupApplication,
} from '../api/services/attendance'
import { fetchUsers } from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph } = Typography
const { RangePicker } = DatePicker

const getClockTypeLabel = (type: string) => {
  return type === 'check_in' ? '上班' : '下班'
}

const getClockTypeColor = (type: string) => {
  return type === 'check_in' ? 'blue' : 'green'
}

const AttendancePage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [activeTab, setActiveTab] = useState('history')
  const [selectedUserId, setSelectedUserId] = useState<number | 'all' | undefined>('all')
  const [summaryRange, setSummaryRange] = useState<'today' | 'week' | 'month' | 'year'>('month')
  
  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    status?: string
  }>({})
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [fenceModalOpen, setFenceModalOpen] = useState(false)
  const [editingFence, setEditingFence] = useState<AttendanceFence | null>(null)
  const [fenceForm] = Form.useForm()
  const [makeupStatusFilter, setMakeupStatusFilter] = useState<string>('pending')

  // 获取用户列表
  const usersQuery = useQuery({
    queryKey: ['users', 'list', effectiveCompanyId],
    queryFn: () => fetchUsers({ size: 1000, company_id: effectiveCompanyId }),
  })

  const users = usersQuery.data?.items || []
  
  const showCompanySummary = selectedUserId === 'all'
  const resolvedUserId = showCompanySummary ? (users[0]?.id || 1) : (selectedUserId || users[0]?.id || 1)
  const userQueriesEnabled = !showCompanySummary && !!resolvedUserId

  // 获取打卡历史
  const historyQuery = useQuery({
    queryKey: ['attendance', 'history', resolvedUserId, filters],
    queryFn: () =>
      fetchAttendanceHistory({
        userId: resolvedUserId!,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: 1,
        pageSize: 100,
      }),
    enabled: userQueriesEnabled,
  })

  // 获取今日班次
  const todayShiftsQuery = useQuery({
    queryKey: ['attendance', 'today-shifts', resolvedUserId],
    queryFn: () => fetchTodayShifts({ userId: resolvedUserId! }),
    enabled: userQueriesEnabled,
  })

  // 获取考勤统计
  const statisticsQuery = useQuery({
    queryKey: ['attendance', 'statistics', resolvedUserId, filters],
    queryFn: () =>
      fetchAttendanceStatistics({
        userId: resolvedUserId!,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    enabled: userQueriesEnabled,
  })

  // 获取告警记录
  const alertsQuery = useQuery({
    queryKey: ['attendance', 'alerts', resolvedUserId],
    queryFn: () => fetchAttendanceAlerts({ userId: resolvedUserId!, isResolved: false }),
    enabled: userQueriesEnabled,
  })

  // 获取电子围栏
  const fencesQuery = useQuery({
    queryKey: ['attendance', 'fences', resolvedUserId],
    queryFn: () => fetchAttendanceFences({ userId: resolvedUserId! }),
    enabled: userQueriesEnabled,
  })

  // 获取公司考勤汇总
  const companySummaryQuery = useQuery({
    queryKey: ['attendance', 'company-summary', summaryRange, effectiveCompanyId],
    queryFn: () =>
      fetchCompanyAttendanceSummary({
        timeRange: summaryRange,
        companyId: effectiveCompanyId,
      }),
    enabled: showCompanySummary,
  })
  const companySummary = companySummaryQuery.data

  // 获取补卡申请
  const makeupQuery = useQuery({
    queryKey: ['attendance', 'makeup', makeupStatusFilter],
    queryFn: () => fetchMakeupApplications({ status: makeupStatusFilter as any }),
  })

  const records = historyQuery.data?.records || []
  const shifts = todayShiftsQuery.data?.shifts || []
  const statistics = statisticsQuery.data
  const alerts = alertsQuery.data?.alerts || []
  const fences = fencesQuery.data?.fences || []
  const makeupApplications = makeupQuery.data?.applications || []

  const companySummaryColumns: ColumnsType<CompanyAttendanceSummary['list'][number]> = useMemo(
    () => [
      {
        title: '姓名',
        dataIndex: 'name',
        width: 200,
      },
      {
        title: '出勤天数',
        dataIndex: 'attendedDays',
        width: 120,
      },
      {
        title: '迟到天数',
        dataIndex: 'lateDays',
        width: 120,
      },
      {
        title: '缺勤天数',
        dataIndex: 'missedDays',
        width: 120,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: string) => ({
          正常: <Tag color="success">正常</Tag>,
          迟到: <Tag color="warning">迟到</Tag>,
          缺勤: <Tag color="error">缺勤</Tag>,
          未排班: <Tag>未排班</Tag>,
        }[value] || <Tag>{value}</Tag>),
      },
    ],
    [],
  )

  // 解决告警
  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: number) => resolveAlert(alertId),
    onSuccess: () => {
      message.success('告警已解决')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'alerts'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '操作失败')
    },
  })

  // 审批补卡申请
  const approveMakeupMutation = useMutation({
    mutationFn: ({ id, action, rejectReason }: { id: number; action: 'approve' | 'reject'; rejectReason?: string }) =>
      approveMakeupApplication(id, { action, reject_reason: rejectReason }),
    onSuccess: (_, variables) => {
      message.success(`补卡申请已${variables.action === 'approve' ? '批准' : '拒绝'}`)
      queryClient.invalidateQueries({ queryKey: ['attendance', 'makeup'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'history'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'statistics'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '操作失败')
    },
  })

  // 创建/更新围栏
  const saveFenceMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingFence) {
        return updateFence(editingFence.id, data)
      }
      return createFence(data)
    },
    onSuccess: () => {
      message.success(editingFence ? '围栏更新成功' : '围栏创建成功')
      setFenceModalOpen(false)
      setEditingFence(null)
      fenceForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['attendance', 'fences'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '操作失败')
    },
  })

  // 删除围栏
  const deleteFenceMutation = useMutation({
    mutationFn: (fenceId: number) => deleteFence(fenceId),
    onSuccess: () => {
      message.success('围栏删除成功')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'fences'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '删除失败')
    },
  })

  const handleSearch = (values: { dateRange?: Dayjs[]; status?: string }) => {
    setFilters({
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      status: values.status,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = useCallback((record: AttendanceRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }, [])

  const closeDetail = () => {
    setDetailDrawerOpen(false)
    setSelectedRecord(null)
  }

  // 打卡历史列定义
  const historyColumns: ColumnsType<AttendanceRecord> = useMemo(
    () => [
      {
        title: '日期',
        dataIndex: 'work_date',
        width: 120,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-'),
      },
      {
        title: '类型',
        dataIndex: 'clock_type',
        width: 100,
        render: (value: string) => (
          <Tag color={getClockTypeColor(value)}>{getClockTypeLabel(value)}</Tag>
        ),
      },
      {
        title: '打卡时间',
        dataIndex: 'clock_time',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '位置',
        dataIndex: 'location_text',
        ellipsis: true,
      },
      {
        title: '操作',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看
          </Button>
        ),
      },
    ],
    [openDetail],
  )

  // 今日班次列定义
  const shiftsColumns: ColumnsType<AttendanceShift> = useMemo(
    () => [
      {
        title: '班次',
        dataIndex: 'id',
        width: 80,
        render: (_, __, index) => `班次${index + 1}`,
      },
      {
        title: '上班时间',
        dataIndex: 'checkInTime',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('HH:mm:ss') : '-'),
      },
      {
        title: '下班时间',
        dataIndex: 'checkOutTime',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('HH:mm:ss') : '-'),
      },
      {
        title: '工作时长',
        dataIndex: 'workDurationMinutes',
        width: 120,
        render: (value: number) => {
          if (!value) return '-'
          const hours = Math.floor(value / 60)
          const minutes = value % 60
          return `${hours}小时${minutes}分钟`
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => {
          const statusMap: Record<string, { label: string; color: string }> = {
            working: { label: '工作中', color: 'processing' },
            completed: { label: '已完成', color: 'success' },
          }
          const status = statusMap[value] || { label: value, color: 'default' }
          return <Badge status={status.color as any} text={status.label} />
        },
      },
    ],
    [],
  )

  // 告警列定义
  const alertsColumns: ColumnsType<AttendanceAlert> = useMemo(
    () => [
      {
        title: '告警类型',
        dataIndex: 'alert_type',
        width: 150,
        render: (value: string) => {
          const typeMap: Record<string, { label: string; color: string }> = {
            late: { label: '迟到', color: 'warning' },
            early_leave: { label: '早退', color: 'error' },
            absent: { label: '缺勤', color: 'error' },
            location_abnormal: { label: '位置异常', color: 'warning' },
            time_abnormal: { label: '时间异常', color: 'warning' },
          }
          const type = typeMap[value] || { label: value, color: 'default' }
          return <Tag color={type.color}>{type.label}</Tag>
        },
      },
      {
        title: '告警信息',
        dataIndex: 'message',
        ellipsis: true,
      },
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '状态',
        dataIndex: 'is_resolved',
        width: 100,
        render: (value: boolean) => (
          <Tag color={value ? 'success' : 'error'}>{value ? '已解决' : '未解决'}</Tag>
        ),
      },
      {
        title: '操作',
        width: 100,
        fixed: 'right',
        render: (_, record) => {
          if (record.is_resolved) return '-'
          return (
            <Button
              type="link"
              onClick={() => {
                Modal.confirm({
                  title: '确认解决',
                  content: '确定要标记该告警为已解决吗？',
                  onOk: () => resolveAlertMutation.mutate(record.id),
                })
              }}
              loading={resolveAlertMutation.isPending}
            >
              解决
            </Button>
          )
        },
      },
    ],
    [resolveAlertMutation],
  )

  // 围栏列定义
  const fencesColumns: ColumnsType<AttendanceFence> = useMemo(
    () => [
      {
        title: '围栏名称',
        dataIndex: 'name',
        width: 200,
      },
      {
        title: '中心位置',
        render: (_, record) => `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`,
        width: 200,
      },
      {
        title: '半径(米)',
        dataIndex: 'radius',
        width: 120,
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingFence(record)
                fenceForm.setFieldsValue({
                  name: record.name,
                  center_longitude: record.longitude,
                  center_latitude: record.latitude,
                  radius: record.radius,
                  description: record.description,
                })
                setFenceModalOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除围栏"${record.name}"吗？`,
                  onOk: () => deleteFenceMutation.mutate(record.id),
                })
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [fenceForm, deleteFenceMutation],
  )

  // 补卡申请列定义
  const makeupColumns: ColumnsType<MakeupApplication> = useMemo(
    () => [
      {
        title: '用户ID',
        dataIndex: 'user_id',
        width: 100,
      },
      {
        title: '日期',
        dataIndex: 'work_date',
        width: 120,
      },
      {
        title: '类型',
        dataIndex: 'clock_type',
        width: 100,
        render: (value: string) => (
          <Tag color={value === 'check_in' ? 'blue' : 'green'}>{getClockTypeLabel(value)}</Tag>
        ),
      },
      {
        title: '原因',
        dataIndex: 'reason',
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => {
          const statusMap: Record<string, { label: string; color: string }> = {
            pending: { label: '待审批', color: 'warning' },
            approved: { label: '已批准', color: 'success' },
            rejected: { label: '已拒绝', color: 'error' },
          }
          const status = statusMap[value] || { label: value, color: 'default' }
          return <Tag color={status.color}>{status.label}</Tag>
        },
      },
      {
        title: '提交时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '操作',
        width: 150,
        fixed: 'right',
        render: (_, record) => {
          if (record.status !== 'pending') return '-'
          return (
            <Space>
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => {
                  approveMakeupMutation.mutate({ id: record.id, action: 'approve' })
                }}
                loading={approveMakeupMutation.isPending}
              >
                批准
              </Button>
              <Button
                type="link"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '拒绝补卡申请',
                    content: (
                      <Input.TextArea
                        placeholder="请输入拒绝原因"
                        rows={3}
                        id="reject-reason-input"
                      />
                    ),
                    onOk: () => {
                      const reason = (document.getElementById('reject-reason-input') as HTMLTextAreaElement)?.value
                      approveMakeupMutation.mutate({ id: record.id, action: 'reject', rejectReason: reason })
                    },
                  })
                }}
                loading={approveMakeupMutation.isPending}
              >
                拒绝
              </Button>
            </Space>
          )
        },
      },
    ],
    [approveMakeupMutation],
  )

  // 导出功能
  const handleExport = useCallback(() => {
    if (records.length === 0) {
      message.warning('没有数据可导出')
      return
    }

    try {
      const exportData = records.map((record) => ({
        日期: record.work_date ? dayjs(record.work_date).format('YYYY-MM-DD') : '',
        类型: getClockTypeLabel(record.clock_type),
        打卡时间: record.clock_time ? dayjs(record.clock_time).format('YYYY-MM-DD HH:mm:ss') : '',
        位置: record.location_text || '',
        经度: record.longitude || 0,
        纬度: record.latitude || 0,
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '打卡记录')

      const fileName = `考勤记录_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }, [records, message])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            考勤管理系统
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理员工打卡记录、考勤统计、异常告警和电子围栏。
          </Paragraph>
        </div>
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择员工"
            value={selectedUserId}
            onChange={(value) => setSelectedUserId(value)}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              {
                value: 'all',
                label: '全部员工（公司汇总）',
              },
              ...users.map((user) => ({
                value: user.id,
                label: `${user.name || user.nickname || '用户'} (${user.phone || user.id})`,
              })),
            ]}
            loading={usersQuery.isLoading}
            notFoundContent={usersQuery.isLoading ? '加载中...' : '暂无用户'}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['attendance'] })}
          >
            刷新
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出数据
          </Button>
        </Space>
      </Flex>

      {/* 公司汇总视图 */}
      {showCompanySummary && companySummary && (
        <Card
          title="全员考勤汇总"
          extra={
            <Select
              value={summaryRange}
              onChange={setSummaryRange}
              options={[
                { value: 'today', label: '今日' },
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' },
                { value: 'year', label: '本年' },
              ]}
              style={{ width: 120 }}
            />
          }
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic title="应到人数" value={companySummary.summary.should} loading={companySummaryQuery.isLoading} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic title="实到人数" value={companySummary.summary.attended} loading={companySummaryQuery.isLoading} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic title="迟到天数" value={companySummary.summary.late} loading={companySummaryQuery.isLoading} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic
                  title="出勤率"
                  value={companySummary.summary.attendanceRate}
                  suffix="%"
                  precision={1}
                  loading={companySummaryQuery.isLoading}
                />
              </Card>
            </Col>
          </Row>
          <Table
            style={{ marginTop: 24 }}
            rowKey="userId"
            columns={companySummaryColumns}
            dataSource={companySummary.list}
            loading={companySummaryQuery.isLoading}
            pagination={false}
          />
        </Card>
      )}

      {/* 个人统计卡片 */}
      {!showCompanySummary && statistics && (
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="出勤率"
                value={statistics.attendance_rate}
                precision={1}
                suffix="%"
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="工作天数"
                value={statistics.work_days}
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="迟到次数"
                value={statistics.late_count}
                loading={statisticsQuery.isLoading}
                prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="平均工作时长"
                value={statistics.average_work_minutes}
                precision={0}
                suffix="分钟"
                loading={statisticsQuery.isLoading}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 告警提示 */}
      {!showCompanySummary && alerts.length > 0 && (
        <Alert
          message={`有 ${alerts.length} 条未解决的告警记录`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          action={
            <Button size="small" onClick={() => setActiveTab('alerts')}>
              查看详情
            </Button>
          }
        />
      )}

      {!showCompanySummary && (
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'history',
                label: '打卡记录',
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
                      <Form.Item name="dateRange" label="日期范围">
                        <RangePicker allowClear />
                      </Form.Item>
                      <Form.Item>
                        <Space>
                          <Button type="primary" htmlType="submit">
                            查询
                          </Button>
                          <Button htmlType="reset">重置</Button>
                        </Space>
                      </Form.Item>
                    </Form>

                    {historyQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(historyQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    <Table
                      rowKey="attendance_id"
                      columns={historyColumns}
                      dataSource={records}
                      loading={historyQuery.isLoading}
                      pagination={{
                        total: historyQuery.data?.total || 0,
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                      scroll={{ x: 1000 }}
                    />
                  </Space>
                ),
              },
              {
                key: 'today',
                label: (
                  <Space>
                    <span>今日班次</span>
                    {shifts.length > 0 && <Badge count={shifts.length} />}
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {todayShiftsQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(todayShiftsQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    <Table
                      rowKey="id"
                      columns={shiftsColumns}
                      dataSource={shifts}
                      loading={todayShiftsQuery.isLoading}
                      pagination={false}
                      locale={{ emptyText: <Empty description="今日暂无班次记录" /> }}
                    />
                  </Space>
                ),
              },
              {
                key: 'statistics',
                label: '考勤统计',
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
                      <Form.Item name="dateRange" label="统计区间">
                        <RangePicker allowClear />
                      </Form.Item>
                      <Form.Item>
                        <Space>
                          <Button type="primary" htmlType="submit">
                            查询
                          </Button>
                          <Button htmlType="reset">重置</Button>
                        </Space>
                      </Form.Item>
                    </Form>

                    {statisticsQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(statisticsQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    {statistics && (
                      <Row gutter={16}>
                        <Col xs={24} lg={12}>
                          <Card title="出勤统计" size="small">
                            <Descriptions column={1} bordered size="small">
                              <Descriptions.Item label="总天数">{statistics.total_days}</Descriptions.Item>
                              <Descriptions.Item label="工作天数">{statistics.work_days}</Descriptions.Item>
                              <Descriptions.Item label="缺勤天数">{statistics.absent_days}</Descriptions.Item>
                              <Descriptions.Item label="出勤率">
                                {statistics.attendance_rate.toFixed(1)}%
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title="工作时长统计" size="small">
                            <Descriptions column={1} bordered size="small">
                              <Descriptions.Item label="总工作时长">
                                {Math.floor(statistics.total_work_minutes / 60)}小时
                                {statistics.total_work_minutes % 60}分钟
                              </Descriptions.Item>
                              <Descriptions.Item label="平均工作时长">
                                {Math.floor(statistics.average_work_minutes / 60)}小时
                                {statistics.average_work_minutes % 60}分钟
                              </Descriptions.Item>
                              <Descriptions.Item label="迟到次数">
                                <Tag color="warning">{statistics.late_count}</Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="早退次数">
                                <Tag color="error">{statistics.early_leave_count}</Tag>
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                      </Row>
                    )}
                  </Space>
                ),
              },
              {
                key: 'alerts',
                label: (
                  <Space>
                    <span>异常告警</span>
                    {alerts.length > 0 && <Badge count={alerts.length} />}
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {alertsQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(alertsQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    <Table
                      rowKey="id"
                      columns={alertsColumns}
                      dataSource={alerts}
                      loading={alertsQuery.isLoading}
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂无告警记录" /> }}
                    />
                  </Space>
                ),
              },
              {
                key: 'fences',
                label: '电子围栏',
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Flex justify="space-between">
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingFence(null)
                          fenceForm.resetFields()
                          setFenceModalOpen(true)
                        }}
                      >
                        新建围栏
                      </Button>
                    </Flex>

                    {fencesQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(fencesQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    <Table
                      rowKey="id"
                      columns={fencesColumns}
                      dataSource={fences}
                      loading={fencesQuery.isLoading}
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂无电子围栏配置" /> }}
                    />
                  </Space>
                ),
              },
              {
                key: 'makeup',
                label: (
                  <Space>
                    <span>补卡审批</span>
                    {makeupApplications.filter((a) => a.status === 'pending').length > 0 && (
                      <Badge count={makeupApplications.filter((a) => a.status === 'pending').length} />
                    )}
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Select
                      style={{ width: 200 }}
                      value={makeupStatusFilter}
                      onChange={setMakeupStatusFilter}
                      options={[
                        { value: 'pending', label: '待审批' },
                        { value: 'approved', label: '已批准' },
                        { value: 'rejected', label: '已拒绝' },
                      ]}
                    />

                    {makeupQuery.error && (
                      <Alert
                        type="error"
                        showIcon
                        message={(makeupQuery.error as Error).message || '数据加载失败'}
                      />
                    )}

                    <Table
                      rowKey="id"
                      columns={makeupColumns}
                      dataSource={makeupApplications}
                      loading={makeupQuery.isLoading}
                      pagination={false}
                      locale={{ emptyText: <Empty description="暂无补卡申请" /> }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* 详情Drawer */}
      <Drawer
        title="打卡详情"
        width={600}
        open={detailDrawerOpen}
        onClose={closeDetail}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="日期">
              {selectedRecord.work_date ? dayjs(selectedRecord.work_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={getClockTypeColor(selectedRecord.clock_type)}>
                {getClockTypeLabel(selectedRecord.clock_type)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="打卡时间">
              {selectedRecord.clock_time
                ? dayjs(selectedRecord.clock_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="位置信息">
              {selectedRecord.location_text || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="经度">{selectedRecord.longitude || '-'}</Descriptions.Item>
            <Descriptions.Item label="纬度">{selectedRecord.latitude || '-'}</Descriptions.Item>
            <Descriptions.Item label="班次ID">{selectedRecord.shift_id || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 围栏编辑Modal */}
      <Modal
        title={editingFence ? '编辑围栏' : '新建围栏'}
        open={fenceModalOpen}
        onCancel={() => {
          setFenceModalOpen(false)
          setEditingFence(null)
          fenceForm.resetFields()
        }}
        onOk={() => fenceForm.submit()}
        confirmLoading={saveFenceMutation.isPending}
      >
        <Form
          form={fenceForm}
          layout="vertical"
          onFinish={(values) => {
            saveFenceMutation.mutate(values)
          }}
        >
          <Form.Item name="name" label="围栏名称" rules={[{ required: true, message: '请输入围栏名称' }]}>
            <Input placeholder="请输入围栏名称" />
          </Form.Item>
          <Form.Item
            name="center_longitude"
            label="中心经度"
            rules={[{ required: true, message: '请输入经度' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入经度" precision={6} />
          </Form.Item>
          <Form.Item
            name="center_latitude"
            label="中心纬度"
            rules={[{ required: true, message: '请输入纬度' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入纬度" precision={6} />
          </Form.Item>
          <Form.Item name="radius" label="半径(米)" rules={[{ required: true, message: '请输入半径' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="请输入半径" min={1} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default AttendancePage
