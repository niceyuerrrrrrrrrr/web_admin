import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  DatePicker,
  message,
  Radio,
  Upload,
  Checkbox,
} from 'antd'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { DownloadOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'

dayjs.extend(weekOfYear)
import {
  listShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  exportShiftTemplates,
  importShiftTemplates,
  getAttendancePolicy,
  updateAttendancePolicy,
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  listRosters,
  setRosters,
  listFences,
  createFence,
  updateFence,
  deleteFence,
  listMakeupQuotas,
  updateMakeupQuota,
  type ShiftTemplate,
  type AttendancePolicy,
  type LeaveTypeDict,
  type RosterItemPayload,
  type GeoFence,
  type MakeupQuota,
} from '../api/services/attendanceConfig'
import { fetchUsers, type User } from '../api/services/users'
import useCompanyStore from '../store/company'
import useAuthStore from '../store/auth'
import MapPicker from '../components/MapPicker'

const { RangePicker } = DatePicker

const AttendanceConfigPage = () => {
  const { message: antdMessage, modal } = AntdApp.useApp()

  const [loadingShifts, setLoadingShifts] = useState(false)
  const [shifts, setShifts] = useState<ShiftTemplate[]>([])
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null)
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDict[]>([])
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false)
  const [rosterData, setRosterData] = useState<any[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // 矩阵视图相关状态
  const [rosterViewMode, setRosterViewMode] = useState<'week' | 'month'>('week')
  const [rosterStartDate, setRosterStartDate] = useState(dayjs().startOf('week'))
  const [rosterUsers, setRosterUsers] = useState<User[]>([])
  const [rosterUserFilter, setRosterUserFilter] = useState<{
    search?: string
    department?: string
    role?: string
  }>({})
  const [selectedUsersForBatch, setSelectedUsersForBatch] = useState<number[]>([])
  const [selectedDatesForBatch, setSelectedDatesForBatch] = useState<string[]>([])
  const [rosterEditModal, setRosterEditModal] = useState<{
    open: boolean
    userId: number
    userName: string
    date: string
    shiftId: number | null
  } | null>(null)

  const [fenceList, setFenceList] = useState<GeoFence[]>([])
  const [loadingFences, setLoadingFences] = useState(false)
  const [fenceModalOpen, setFenceModalOpen] = useState(false)
  const [editingFence, setEditingFence] = useState<GeoFence | null>(null)
  const [fenceForm] = Form.useForm()
  
  // 补卡配额相关状态
  const [makeupQuotas, setMakeupQuotas] = useState<MakeupQuota[]>([])
  const [loadingMakeupQuotas, setLoadingMakeupQuotas] = useState(false)
  const [makeupQuotaSearch, setMakeupQuotaSearch] = useState<string>('')
  const [editingQuota, setEditingQuota] = useState<MakeupQuota | null>(null)
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [quotaForm] = Form.useForm()
  const currentCompanyId = useCompanyStore((s) => s.currentCompany?.id)
  const { user } = useAuthStore()
  
  // 检查是否有权限操作电子围栏（只有总经理和统计可以）
  const canManageFences = useMemo(() => {
    if (!user) return false
    const isSuperAdmin = user.role === 'super_admin' || user.positionType === '超级管理员'
    const allowedRoles = ['总经理', '统计', '统计员']
    return isSuperAdmin || (user.positionType && allowedRoles.includes(user.positionType))
  }, [user])

  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftTemplate | null>(null)
  const [shiftForm] = Form.useForm()
  const [formPolicy] = Form.useForm()

  const [leaveTypeModalOpen, setLeaveTypeModalOpen] = useState(false)
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveTypeDict | null>(null)
  const [leaveTypeForm] = Form.useForm()

  const fetchShifts = async () => {
    setLoadingShifts(true)
    try {
      const data = await listShiftTemplates(currentCompanyId || undefined)
      setShifts(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取班次失败')
    } finally {
      setLoadingShifts(false)
    }
  }

  const fetchPolicy = async () => {
    setLoadingPolicy(true)
    try {
      const data = await getAttendancePolicy(currentCompanyId || undefined)
      setPolicy(data)
      formPolicy.setFieldsValue(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取策略失败')
    } finally {
      setLoadingPolicy(false)
    }
  }

  const fetchLeaveTypes = async () => {
    setLoadingLeaveTypes(true)
    try {
      const data = await listLeaveTypes(currentCompanyId || undefined)
      setLeaveTypes(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取请假类型失败')
    } finally {
      setLoadingLeaveTypes(false)
    }
  }

  // 注意：fetchRoster函数已不再使用，排班数据通过fetchRosterMatrix获取
  // 保留此函数以防将来需要，但已移除rosterForm依赖
  const fetchRoster = async () => {
    // 此函数已废弃，使用fetchRosterMatrix代替
    console.warn('fetchRoster已废弃，请使用fetchRosterMatrix')
  }

  useEffect(() => {
    fetchShifts()
    fetchPolicy()
    fetchLeaveTypes()
    fetchFenceList()
    fetchUserOptions()
    fetchMakeupQuotas()
  }, [currentCompanyId])

  useEffect(() => {
    fetchRosterUsers()
  }, [currentCompanyId, rosterUserFilter])

  useEffect(() => {
    fetchRosterMatrix()
  }, [currentCompanyId, rosterStartDate, rosterViewMode])

  const fetchFenceList = async () => {
    setLoadingFences(true)
    try {
      const data = await listFences(currentCompanyId || undefined)
      setFenceList(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取围栏失败')
    } finally {
      setLoadingFences(false)
    }
  }

  // 获取补卡配额列表
  const fetchMakeupQuotas = async () => {
    setLoadingMakeupQuotas(true)
    try {
      const data = await listMakeupQuotas(currentCompanyId || undefined, makeupQuotaSearch || undefined)
      setMakeupQuotas(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取补卡配额列表失败')
    } finally {
      setLoadingMakeupQuotas(false)
    }
  }

  // 更新补卡配额
  const handleUpdateQuota = async (values: { monthly_makeup_quota: number }) => {
    if (!editingQuota) return
    try {
      await updateMakeupQuota(
        {
          user_id: editingQuota.user_id,
          monthly_makeup_quota: values.monthly_makeup_quota,
        },
        currentCompanyId || undefined
      )
      antdMessage.success('补卡配额更新成功')
      setQuotaModalOpen(false)
      setEditingQuota(null)
      quotaForm.resetFields()
      fetchMakeupQuotas()
    } catch (err: any) {
      antdMessage.error(err.message || '更新补卡配额失败')
    }
  }

  const fetchUserOptions = async (keyword?: string) => {
    setLoadingUsers(true)
    try {
      const res = await fetchUsers({ page: 1, size: 200, name: keyword || undefined, company_id: currentCompanyId || undefined })
      setUserOptions(
        res.items.map((u: User) => ({
          label: `${u.name || u.nickname || '用户'}（ID:${u.id}）`,
          value: u.id,
        })),
      )
    } catch (err: any) {
      antdMessage.error(err.message || '获取用户列表失败')
    } finally {
      setLoadingUsers(false)
    }
  }

  // 获取用户列表（用于矩阵视图）
  const fetchRosterUsers = async () => {
    try {
      const res = await fetchUsers({
        page: 1,
        size: 1000,
        name: rosterUserFilter.search,
        company_id: currentCompanyId || undefined,
      })
      let users = res.items
      
      // 按部门筛选
      if (rosterUserFilter.department) {
        users = users.filter((u: User) => u.position_type === rosterUserFilter.department)
      }
      
      // 按角色筛选
      if (rosterUserFilter.role) {
        users = users.filter((u: User) => u.role === rosterUserFilter.role)
      }
      
      setRosterUsers(users)
    } catch (err: any) {
      antdMessage.error(err.message || '获取用户列表失败')
    }
  }

  // 获取排班数据（用于矩阵视图）
  const fetchRosterMatrix = async () => {
    if (!rosterStartDate) return
    
    const endDate = rosterViewMode === 'week' 
      ? rosterStartDate.clone().add(6, 'day')
      : rosterStartDate.clone().add(1, 'month').subtract(1, 'day')
    
    setLoadingRoster(true)
    try {
      const start = rosterStartDate.format('YYYY-MM-DD')
      const end = endDate.format('YYYY-MM-DD')
      const data = await listRosters({ start_date: start, end_date: end }, currentCompanyId || undefined)
      setRosterData(data || [])
    } catch (err: any) {
      antdMessage.error(err.message || '获取排班失败')
    } finally {
      setLoadingRoster(false)
    }
  }

  // 获取日期列表
  const getDateList = () => {
    if (!rosterStartDate) return []
    const dates: string[] = []
    const endDate = rosterViewMode === 'week' 
      ? rosterStartDate.clone().add(6, 'day')
      : rosterStartDate.clone().add(1, 'month').subtract(1, 'day')
    
    let current = rosterStartDate.clone()
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    return dates
  }

  // 获取某用户某天的班次
  const getShiftForUserDate = (userId: number, date: string) => {
    const roster = rosterData.find((r: any) => r.user_id === userId && r.work_date === date)
    if (!roster || !roster.shift_id) return null
    return shifts.find((s) => s.id === roster.shift_id)
  }

  // 获取某用户某天的考勤状态
  const getAttendanceStatusForUserDate = (userId: number, date: string) => {
    const roster = rosterData.find((r: any) => r.user_id === userId && r.work_date === date)
    return roster?.attendance_status || null
  }

  // 判断日期是否为往日（今天之前）
  const isPastDate = (date: string) => {
    return dayjs(date).isBefore(dayjs(), 'day')
  }

  // 更新单个单元格的排班
  const updateCellRoster = async (userId: number, date: string, shiftId: number | null) => {
    try {
      await setRosters(
        [
          {
            user_id: userId,
            work_date: date,
            shift_id: shiftId,
            status: 'normal',
          },
        ],
        currentCompanyId || undefined,
      )
      antdMessage.success('排班已更新')
      await fetchRosterMatrix()
    } catch (err: any) {
      antdMessage.error(err.message || '更新排班失败')
    }
  }

  // 批量排班
  const handleBatchRoster = async (shiftId: number | null) => {
    if (!selectedUsersForBatch.length || !selectedDatesForBatch.length) {
      antdMessage.warning('请选择员工和日期')
      return
    }
    
    try {
      const items: RosterItemPayload[] = []
      selectedUsersForBatch.forEach((userId) => {
        selectedDatesForBatch.forEach((date) => {
          items.push({
            user_id: userId,
            work_date: date,
            shift_id: shiftId || undefined,
            status: 'normal',
          })
        })
      })
      await setRosters(items, currentCompanyId || undefined)
      antdMessage.success('批量排班已保存')
      await fetchRosterMatrix()
      setSelectedUsersForBatch([])
      setSelectedDatesForBatch([])
    } catch (err: any) {
      antdMessage.error(err.message || '批量排班失败')
    }
  }

  // 导出排班数据
  const exportRoster = () => {
    const dates = getDateList()
    const headers = ['员工姓名', '员工ID', ...dates]
    const rows: string[][] = []
    
    rosterUsers.forEach((user) => {
      const row = [
        user.name || user.nickname || '未知',
        String(user.id),
        ...dates.map((date) => {
          const shift = getShiftForUserDate(user.id, date)
          return shift ? shift.name : ''
        }),
      ]
      rows.push(row)
    })
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `排班表_${rosterStartDate.format('YYYY-MM-DD')}_${rosterViewMode === 'week' ? '周' : '月'}.csv`
    link.click()
  }

  // 导入排班数据
  const importRoster = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())
      if (lines.length < 2) {
        antdMessage.error('文件格式错误')
        return
      }
      
      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim())
      const dateCols = headers.slice(2) // 跳过员工姓名和ID
      const items: RosterItemPayload[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map((c) => c.replace(/"/g, '').trim())
        const userId = parseInt(cells[1])
        if (!userId) continue
        
        dateCols.forEach((date, idx) => {
          const shiftName = cells[idx + 2]
          if (!shiftName) return
          
          const shift = shifts.find((s) => s.name === shiftName)
          if (shift) {
            items.push({
              user_id: userId,
              work_date: date,
              shift_id: shift.id,
              status: 'normal',
            })
          }
        })
      }
      
      if (items.length > 0) {
        await setRosters(items, currentCompanyId || undefined)
        antdMessage.success(`成功导入 ${items.length} 条排班数据`)
        await fetchRosterMatrix()
      } else {
        antdMessage.warning('没有有效的排班数据')
      }
    } catch (err: any) {
      antdMessage.error(err.message || '导入失败')
    }
  }

  const shiftColumns = useMemo(
    () => [
      { title: '名称', dataIndex: 'name' },
      { title: '上班', dataIndex: 'start_time' },
      { title: '下班', dataIndex: 'end_time' },
      { title: '宽限(分)', dataIndex: 'grace_minutes' },
      {
        title: '启用',
        dataIndex: 'is_active',
        render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
      },
      {
        title: '角色',
        dataIndex: 'roles',
        render: (roles: string[]) => roles?.join('、') || '-',
      },
      {
        title: '操作',
        render: (_: any, record: ShiftTemplate) => (
          <Space>
            <Button
              type="link"
              onClick={() => {
                setEditingShift(record)
                shiftForm.setFieldsValue({
                  name: record.name,
                  start_time: record.start_time,
                  end_time: record.end_time,
                  grace_minutes: record.grace_minutes,
                  is_active: record.is_active,
                  workday_flag: record.workday_flag,
                  roles: record.roles,
                })
                setShiftModalOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              onClick={() =>
                modal.confirm({
                  title: '确认删除该班次？',
                  onOk: async () => {
                    try {
                      await deleteShiftTemplate(record.id, currentCompanyId || undefined)
                      antdMessage.success('已删除')
                      fetchShifts()
                    } catch (err: any) {
                      antdMessage.error(err.message || '删除失败')
                    }
                  },
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [modal, shiftForm],
  )

  const leaveTypeColumns = useMemo(
    () => [
      { title: '名称', dataIndex: 'name' },
      {
        title: '外勤/出差',
        dataIndex: 'is_field_trip',
        render: (v: boolean) => <Tag color={v ? 'blue' : 'default'}>{v ? '是' : '否'}</Tag>,
      },
      {
        title: '需佐证',
        dataIndex: 'requires_proof',
        render: (v: boolean) => <Tag color={v ? 'orange' : 'default'}>{v ? '是' : '否'}</Tag>,
      },
      {
        title: '启用',
        dataIndex: 'is_active',
        render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
      },
      {
        title: '操作',
        render: (_: any, record: LeaveTypeDict) => (
          <Space>
            <Button
              type="link"
              onClick={() => {
                setEditingLeaveType(record)
                leaveTypeForm.setFieldsValue({
                  name: record.name,
                  is_field_trip: record.is_field_trip,
                  requires_proof: record.requires_proof,
                  is_active: record.is_active,
                })
                setLeaveTypeModalOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              onClick={() =>
                modal.confirm({
                  title: '确认删除该类型？',
                  onOk: async () => {
                    try {
                      await deleteLeaveType(record.id, currentCompanyId || undefined)
                      antdMessage.success('已删除')
                      fetchLeaveTypes()
                    } catch (err: any) {
                      antdMessage.error(err.message || '删除失败')
                    }
                  },
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [modal, leaveTypeForm],
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <h2>考勤配置中心</h2>
      <Tabs
        items={[
          {
            key: 'shifts',
            label: '班次模板',
            children: (
              <Card
                title="班次模板"
                extra={
                  <Space>
                    <Button
                      onClick={async () => {
                        try {
                          const data = await exportShiftTemplates(currentCompanyId || undefined)
                          const blob = new Blob([data.content], { type: 'text/csv;charset=utf-8;' })
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = data.filename || 'shift_templates.csv'
                          a.click()
                          window.URL.revokeObjectURL(url)
                          antdMessage.success('已导出')
                        } catch (err: any) {
                          antdMessage.error(err.message || '导出失败')
                        }
                      }}
                    >
                      导出
                    </Button>
                    <Button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = '.csv'
                        input.onchange = async (e: any) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            await importShiftTemplates(file, currentCompanyId || undefined)
                            antdMessage.success('导入完成')
                            fetchShifts()
                          } catch (err: any) {
                            antdMessage.error(err.message || '导入失败')
                          }
                        }
                        input.click()
                      }}
                    >
                      导入
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => {
                        setEditingShift(null)
                        shiftForm.resetFields()
                        shiftForm.setFieldsValue({ grace_minutes: 5, is_active: true, workday_flag: true })
                        setShiftModalOpen(true)
                      }}
                    >
                      新建班次
                    </Button>
                  </Space>
                }
              >
                <Table rowKey="id" loading={loadingShifts} columns={shiftColumns} dataSource={shifts} />
              </Card>
            ),
          },
          {
            key: 'policy',
            label: '考勤策略',
            children: (
              <Card
                title="公司考勤策略"
                extra={
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        const values = await formPolicy.validateFields()
                        await updateAttendancePolicy(values, currentCompanyId || undefined)
                        antdMessage.success('策略已保存')
                        fetchPolicy()
                      } catch {}
                    }}
                  >
                    保存
                  </Button>
                }
              >
                <Form
                  layout="vertical"
                  initialValues={policy || { on_duty_grace: 5, off_duty_grace: 5, min_work_minutes: 240, location_check_enabled: true }}
                  form={formPolicy}
                >
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item label="上班宽限(分钟)" name="on_duty_grace" rules={[{ required: true }]}>
                        <InputNumber min={0} max={120} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="下班宽限(分钟)" name="off_duty_grace" rules={[{ required: true }]}>
                        <InputNumber min={0} max={120} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="工作时长异常阈值(分钟)" name="min_work_minutes" rules={[{ required: true }]}>
                        <InputNumber min={0} max={720} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="位置异常检测" name="location_check_enabled" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            ),
          },
          {
            key: 'leave-types',
            label: '请假/外勤类型',
            children: (
              <Card
                title="请假/外勤类型"
                extra={
                  <Button
                    type="primary"
                    onClick={() => {
                      setEditingLeaveType(null)
                      leaveTypeForm.resetFields()
                      leaveTypeForm.setFieldsValue({ is_active: true, is_field_trip: false, requires_proof: false })
                      setLeaveTypeModalOpen(true)
                    }}
                  >
                    新建类型
                  </Button>
                }
              >
                <Table rowKey="id" loading={loadingLeaveTypes} columns={leaveTypeColumns} dataSource={leaveTypes} />
              </Card>
            ),
          },
          {
            key: 'roster',
            label: '排班管理',
            children: (
              <Card
                title="排班管理（矩阵视图）"
                extra={
                  <Space>
                    <Upload
                      accept=".csv"
                      showUploadList={false}
                      beforeUpload={(file) => {
                        importRoster(file)
                        return false
                      }}
                    >
                      <Button icon={<UploadOutlined />}>导入</Button>
                    </Upload>
                    <Button icon={<DownloadOutlined />} onClick={exportRoster}>
                      导出
                    </Button>
                    <Button onClick={fetchRosterMatrix} loading={loadingRoster}>
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* 视图控制和日期选择 */}
                  <Row gutter={16} align="middle">
                    <Col>
                      <Radio.Group
                        value={rosterViewMode}
                        onChange={(e) => {
                          setRosterViewMode(e.target.value)
                          setRosterStartDate(e.target.value === 'week' ? dayjs().startOf('week') : dayjs().startOf('month'))
                        }}
                      >
                        <Radio.Button value="week">周视图</Radio.Button>
                        <Radio.Button value="month">月视图</Radio.Button>
                      </Radio.Group>
                    </Col>
                    <Col>
                      <Space>
                        <Button
                          onClick={() => {
                            const newDate = rosterViewMode === 'week' 
                              ? rosterStartDate.clone().subtract(1, 'week')
                              : rosterStartDate.clone().subtract(1, 'month')
                            setRosterStartDate(newDate)
                          }}
                        >
                          上一{rosterViewMode === 'week' ? '周' : '月'}
                        </Button>
                        <DatePicker
                          value={rosterStartDate}
                          onChange={(date) => {
                            if (date) {
                              setRosterStartDate(rosterViewMode === 'week' ? date.startOf('week') : date.startOf('month'))
                            }
                          }}
                          picker={rosterViewMode}
                        />
                        <Button
                          onClick={() => {
                            const newDate = rosterViewMode === 'week' 
                              ? rosterStartDate.clone().add(1, 'week')
                              : rosterStartDate.clone().add(1, 'month')
                            setRosterStartDate(newDate)
                          }}
                        >
                          下一{rosterViewMode === 'week' ? '周' : '月'}
                        </Button>
                        <Button onClick={() => setRosterStartDate(rosterViewMode === 'week' ? dayjs().startOf('week') : dayjs().startOf('month'))}>
                          今天
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  {/* 员工筛选 */}
                  <Row gutter={16}>
                    <Col span={8}>
                      <Input
                        placeholder="搜索员工姓名"
                        value={rosterUserFilter.search}
                        onChange={(e) => setRosterUserFilter({ ...rosterUserFilter, search: e.target.value })}
                        allowClear
                      />
                    </Col>
                    <Col span={8}>
                      <Select
                        placeholder="筛选部门/职位"
                        value={rosterUserFilter.department}
                        onChange={(value) => setRosterUserFilter({ ...rosterUserFilter, department: value })}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="司机">司机</Select.Option>
                        <Select.Option value="车队长">车队长</Select.Option>
                        <Select.Option value="总经理">总经理</Select.Option>
                      </Select>
                    </Col>
                    <Col span={8}>
                      <Select
                        placeholder="筛选角色"
                        value={rosterUserFilter.role}
                        onChange={(value) => setRosterUserFilter({ ...rosterUserFilter, role: value })}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="driver">司机</Select.Option>
                        <Select.Option value="fleet_manager">车队长</Select.Option>
                        <Select.Option value="general_manager">总经理</Select.Option>
                      </Select>
                    </Col>
                  </Row>

                  {/* 批量排班操作 */}
                  {(selectedUsersForBatch.length > 0 || selectedDatesForBatch.length > 0) && (
                    <Card size="small" style={{ background: '#f0f2f5' }}>
                      <Space>
                        <span>
                          已选择 {selectedUsersForBatch.length} 名员工，{selectedDatesForBatch.length} 个日期
                        </span>
                        <Select
                          placeholder="选择班次进行批量排班"
                          style={{ width: 200 }}
                          onChange={(shiftId) => {
                            if (shiftId !== undefined) {
                              handleBatchRoster(shiftId)
                            }
                          }}
                          allowClear
                        >
                          <Select.Option value={null}>无排班</Select.Option>
                          {shifts.map((s) => (
                            <Select.Option key={s.id} value={s.id}>
                              {s.name} ({s.start_time}-{s.end_time})
                            </Select.Option>
                          ))}
                        </Select>
                        <Button onClick={() => {
                          setSelectedUsersForBatch([])
                          setSelectedDatesForBatch([])
                        }}>
                          清除选择
                        </Button>
                      </Space>
                    </Card>
                  )}

                  {/* 矩阵表格 */}
                  <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', border: '1px solid #d9d9d9', background: '#fafafa', position: 'sticky', left: 0, zIndex: 10, minWidth: 120 }}>
                            <Checkbox
                              checked={rosterUsers.length > 0 && selectedUsersForBatch.length === rosterUsers.length}
                              indeterminate={selectedUsersForBatch.length > 0 && selectedUsersForBatch.length < rosterUsers.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsersForBatch(rosterUsers.map((u) => u.id))
                                } else {
                                  setSelectedUsersForBatch([])
                                }
                              }}
                            />
                            <span style={{ marginLeft: 8 }}>员工姓名</span>
                          </th>
                          {getDateList().map((date) => {
                            const d = dayjs(date)
                            const isSelected = selectedDatesForBatch.includes(date)
                            return (
                              <th
                                key={date}
                                style={{
                                  padding: '8px',
                                  border: '1px solid #d9d9d9',
                                  background: isSelected ? '#e6f7ff' : '#fafafa',
                                  minWidth: 100,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedDatesForBatch(selectedDatesForBatch.filter((d) => d !== date))
                                  } else {
                                    setSelectedDatesForBatch([...selectedDatesForBatch, date])
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDatesForBatch([...selectedDatesForBatch, date])
                                    } else {
                                      setSelectedDatesForBatch(selectedDatesForBatch.filter((d) => d !== date))
                                    }
                                  }}
                                />
                                <div>{d.format('MM-DD')}</div>
                                <div style={{ fontSize: '12px', color: '#999' }}>
                                  {['日', '一', '二', '三', '四', '五', '六'][d.day()]}
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {rosterUsers.map((user) => {
                          const isUserSelected = selectedUsersForBatch.includes(user.id)
                          return (
                            <tr key={user.id}>
                              <td
                                style={{
                                  padding: '8px',
                                  border: '1px solid #d9d9d9',
                                  background: isUserSelected ? '#e6f7ff' : '#fff',
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 5,
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  if (isUserSelected) {
                                    setSelectedUsersForBatch(selectedUsersForBatch.filter((id) => id !== user.id))
                                  } else {
                                    setSelectedUsersForBatch([...selectedUsersForBatch, user.id])
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={isUserSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUsersForBatch([...selectedUsersForBatch, user.id])
                                    } else {
                                      setSelectedUsersForBatch(selectedUsersForBatch.filter((id) => id !== user.id))
                                    }
                                  }}
                                />
                                <span style={{ marginLeft: 8 }}>
                                  {user.name || user.nickname || `用户${user.id}`}
                                </span>
                              </td>
                              {getDateList().map((date) => {
                                const shift = getShiftForUserDate(user.id, date)
                                const attendanceStatus = getAttendanceStatusForUserDate(user.id, date)
                                const isCellSelected = isUserSelected && selectedDatesForBatch.includes(date)
                                const isPast = isPastDate(date)
                                
                                // 根据考勤状态设置背景色（仅对往日排班）
                                let cellBackground = '#fff'
                                if (isCellSelected) {
                                  cellBackground = '#e6f7ff'
                                } else if (isPast && attendanceStatus) {
                                  if (attendanceStatus === 'normal') {
                                    cellBackground = '#f6ffed' // 绿色（正常出勤）
                                  } else if (attendanceStatus === 'absent' || attendanceStatus === 'late' || attendanceStatus === 'early') {
                                    cellBackground = '#fff1f0' // 红色（缺勤/迟到/早退）
                                  } else if (attendanceStatus === 'leave') {
                                    cellBackground = '#fffbe6' // 黄色（请假）
                                  }
                                }
                                
                                return (
                                  <td
                                    key={date}
                                    style={{
                                      padding: '8px',
                                      border: '1px solid #d9d9d9',
                                      background: cellBackground,
                                      cursor: 'pointer',
                                      textAlign: 'center',
                                      minWidth: 100,
                                    }}
                                  >
                                    <Tag 
                                      color={shift ? 'green' : 'default'} 
                                      style={{ cursor: 'pointer', width: '100%', display: 'block', textAlign: 'center' }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setRosterEditModal({
                                          open: true,
                                          userId: user.id,
                                          userName: user.name || user.nickname || `用户${user.id}`,
                                          date,
                                          shiftId: shift?.id || null,
                                        })
                                      }}
                                    >
                                      {shift ? shift.name : '-'}
                                    </Tag>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Space>
              </Card>
            ),
          },
          {
            key: 'fence',
            label: '电子围栏',
            children: (
              <Card
                title="电子围栏"
                extra={
                  canManageFences && (
                    <Button
                      type="primary"
                      onClick={() => {
                        setEditingFence(null)
                        fenceForm.resetFields()
                        fenceForm.setFieldsValue({ is_active: true, location_type: 'other' })
                        setFenceModalOpen(true)
                      }}
                    >
                      新建围栏
                    </Button>
                  )
                }
              >
                <Table
                  rowKey="id"
                  loading={loadingFences}
                  columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '经度', dataIndex: 'center_lng' },
                    { title: '纬度', dataIndex: 'center_lat' },
                    { title: '半径(米)', dataIndex: 'radius' },
                    {
                      title: '角色',
                      dataIndex: 'allowed_roles',
                      render: (roles: string[]) => roles?.join('、') || '-',
                    },
                    {
                      title: '启用',
                      dataIndex: 'is_active',
                      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
                    },
                    {
                      title: '可视化',
                      render: (_: any, record: GeoFence) => {
                        const url = `https://uri.amap.com/marker?position=${record.center_lng},${record.center_lat}&name=${encodeURIComponent(
                          record.name,
                        )}`
                        return (
                          <a href={url} target="_blank" rel="noreferrer">
                            查看地图
                          </a>
                        )
                      },
                    },
                    {
                      title: '操作',
                      render: (_: any, record: GeoFence) => (
                        canManageFences ? (
                          <Space>
                            <Button
                              type="link"
                              onClick={() => {
                                setEditingFence(record)
                                fenceForm.setFieldsValue({
                                  name: record.name,
                                  center_lng: Number(record.center_lng),
                                  center_lat: Number(record.center_lat),
                                  radius: record.radius,
                                  description: record.description,
                                  allowed_roles: record.allowed_roles,
                                  location_type: record.location_type,
                                  is_active: record.is_active,
                                })
                                setFenceModalOpen(true)
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              type="link"
                              danger
                              onClick={() =>
                                modal.confirm({
                                  title: '确认删除该围栏？',
                                  onOk: async () => {
                                    try {
                      await deleteFence(record.id, currentCompanyId || undefined)
                                      antdMessage.success('已删除')
                                      fetchFenceList()
                                    } catch (err: any) {
                                      antdMessage.error(err.message || '删除失败')
                                    }
                                  },
                                })
                              }
                            >
                              删除
                            </Button>
                          </Space>
                        ) : (
                          <span style={{ color: '#999' }}>无权限</span>
                        )
                      ),
                    },
                  ]}
                  dataSource={fenceList}
                  expandable={{
                    expandedRowRender: (record: GeoFence) => {
                      const url = `https://uri.amap.com/marker?position=${record.center_lng},${record.center_lat}&name=${encodeURIComponent(
                        record.name,
                      )}`
                      return (
                        <iframe
                          title={`map-${record.id}`}
                          src={url}
                          style={{ width: '100%', height: 320, border: '1px solid #f0f0f0' }}
                          loading="lazy"
                        />
                      )
                    },
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'makeup-quota',
            label: '补卡配额',
            children: (
              <Card
                title="补卡配额管理"
                extra={
                  <Space>
                    <Input.Search
                      placeholder="搜索员工姓名"
                      value={makeupQuotaSearch}
                      onChange={(e) => setMakeupQuotaSearch(e.target.value)}
                      onSearch={fetchMakeupQuotas}
                      style={{ width: 200 }}
                      allowClear
                    />
                    <Button onClick={fetchMakeupQuotas} loading={loadingMakeupQuotas}>
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Table
                  rowKey="user_id"
                  loading={loadingMakeupQuotas}
                  columns={[
                    { title: '员工ID', dataIndex: 'user_id', width: 100 },
                    { title: '员工姓名', dataIndex: 'user_name' },
                    { title: '职位', dataIndex: 'position_type' },
                    {
                      title: '每月配额',
                      dataIndex: 'monthly_makeup_quota',
                      render: (quota: number) => <Tag color="blue">{quota}次</Tag>,
                    },
                    {
                      title: '已使用',
                      dataIndex: 'used_makeup_count',
                      render: (used: number) => <Tag color="orange">{used}次</Tag>,
                    },
                    {
                      title: '剩余',
                      dataIndex: 'remaining',
                      render: (remaining: number) => (
                        <Tag color={remaining > 0 ? 'green' : 'red'}>{remaining}次</Tag>
                      ),
                    },
                    {
                      title: '上次重置日期',
                      dataIndex: 'last_reset_date',
                      render: (date: string | null) => date || '-',
                    },
                    {
                      title: '操作',
                      render: (_: any, record: MakeupQuota) => (
                        <Button
                          type="link"
                          onClick={() => {
                            setEditingQuota(record)
                            quotaForm.setFieldsValue({ monthly_makeup_quota: record.monthly_makeup_quota })
                            setQuotaModalOpen(true)
                          }}
                        >
                          编辑配额
                        </Button>
                      ),
                    },
                  ]}
                  dataSource={makeupQuotas}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editingShift ? '编辑班次' : '新建班次'}
        open={shiftModalOpen}
        onCancel={() => setShiftModalOpen(false)}
        onOk={async () => {
          try {
            const values = await shiftForm.validateFields()
            const payload = {
              ...values,
              roles: (values.roles || []).map((r: string) => ({ role_name: r })),
            }
            if (editingShift) {
              await updateShiftTemplate(editingShift.id, payload, currentCompanyId || undefined)
              antdMessage.success('班次已更新')
            } else {
              await createShiftTemplate(payload, currentCompanyId || undefined)
              antdMessage.success('班次已创建')
            }
            setShiftModalOpen(false)
            fetchShifts()
          } catch {}
        }}
      >
        <Form form={shiftForm} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="上班时间" name="start_time" rules={[{ required: true }]}>
            <Input placeholder="HH:MM" />
          </Form.Item>
          <Form.Item label="下班时间" name="end_time" rules={[{ required: true }]}>
            <Input placeholder="HH:MM" />
          </Form.Item>
          <Form.Item label="宽限(分钟)" name="grace_minutes" rules={[{ required: true }]}>
            <InputNumber min={0} max={120} className="w-full" />
          </Form.Item>
          <Form.Item label="角色(多选)" name="roles">
            <Select mode="tags" placeholder="输入角色名称后回车" />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Form.Item label="工作日班次" name="workday_flag" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingLeaveType ? '编辑请假/外勤类型' : '新建请假/外勤类型'}
        open={leaveTypeModalOpen}
        onCancel={() => setLeaveTypeModalOpen(false)}
        onOk={async () => {
          try {
            const values = await leaveTypeForm.validateFields()
            if (editingLeaveType) {
              await updateLeaveType(editingLeaveType.id, values, currentCompanyId || undefined)
              antdMessage.success('已更新')
            } else {
              await createLeaveType(values, currentCompanyId || undefined)
              antdMessage.success('已创建')
            }
            setLeaveTypeModalOpen(false)
            fetchLeaveTypes()
          } catch {}
        }}
      >
        <Form form={leaveTypeForm} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="外勤/出差" name="is_field_trip" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="需佐证" name="requires_proof" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingFence ? '编辑围栏' : '新建围栏'}
        open={fenceModalOpen}
        width={800}
        onCancel={() => {
          setFenceModalOpen(false)
          setEditingFence(null)
          fenceForm.resetFields()
        }}
        onOk={async () => {
          try {
            const values = await fenceForm.validateFields()
            if (editingFence) {
                              await updateFence(editingFence.id, values, currentCompanyId || undefined)
              antdMessage.success('围栏已更新')
            } else {
                              await createFence(values, currentCompanyId || undefined)
              antdMessage.success('围栏已创建')
            }
            setFenceModalOpen(false)
            fetchFenceList()
          } catch {}
        }}
      >
        <Form form={fenceForm} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="选择位置">
            <MapPicker
              lng={fenceForm.getFieldValue('center_lng')}
              lat={fenceForm.getFieldValue('center_lat')}
              onChange={(lng, lat, _address) => {
                fenceForm.setFieldsValue({
                  center_lng: lng,
                  center_lat: lat,
                })
              }}
              height={350}
            />
          </Form.Item>
          <Form.Item label="经度" name="center_lng" rules={[{ required: true, type: 'number' }]}>
            <InputNumber className="w-full" controls={false} precision={6} />
          </Form.Item>
          <Form.Item label="纬度" name="center_lat" rules={[{ required: true, type: 'number' }]}>
            <InputNumber className="w-full" controls={false} precision={6} />
          </Form.Item>
          <Form.Item label="半径(米)" name="radius" rules={[{ required: true, type: 'number' }]}>
            <InputNumber min={10} max={2000} className="w-full" />
          </Form.Item>
          <Form.Item label="角色(多选)" name="allowed_roles">
            <Select mode="tags" placeholder="输入角色后回车" />
          </Form.Item>
          <Form.Item label="位置类型" name="location_type">
            <Select
              options={[
                { label: '办公', value: 'office' },
                { label: '调度中心', value: 'dispatch_center' },
                { label: '场站/车场', value: 'site' },
                { label: '仓库', value: 'warehouse' },
                { label: '其他', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      {/* 补卡配额编辑Modal */}
      <Modal
        title={`编辑补卡配额 - ${editingQuota?.user_name || ''}`}
        open={quotaModalOpen}
        onCancel={() => {
          setQuotaModalOpen(false)
          setEditingQuota(null)
          quotaForm.resetFields()
        }}
        onOk={async () => {
          try {
            const values = await quotaForm.validateFields()
            await handleUpdateQuota(values)
          } catch {}
        }}
      >
        <Form form={quotaForm} layout="vertical">
          <Form.Item
            label="每月补卡配额"
            name="monthly_makeup_quota"
            rules={[{ required: true, message: '请输入每月补卡配额' }]}
            extra="设置该员工每月可以补卡的次数（0-100次）"
          >
            <InputNumber min={0} max={100} className="w-full" />
          </Form.Item>
          {editingQuota && (
            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div>当前已使用：{editingQuota.used_makeup_count}次</div>
              <div>当前剩余：{editingQuota.remaining}次</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                注意：修改配额不会影响已使用的次数，每月1日会自动重置使用次数
              </div>
            </div>
          )}
        </Form>
      </Modal>

      {/* 排班编辑Modal */}
      <Modal
        title={rosterEditModal ? `设置排班 - ${rosterEditModal.userName} - ${dayjs(rosterEditModal.date).format('MM-DD')}` : ''}
        open={rosterEditModal?.open || false}
        onCancel={() => setRosterEditModal(null)}
        footer={null}
        width={400}
      >
        {rosterEditModal && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Select
              placeholder="选择班次"
              style={{ width: '100%' }}
              value={rosterEditModal.shiftId}
              onChange={(value) => {
                if (rosterEditModal) {
                  setRosterEditModal({ ...rosterEditModal, shiftId: value })
                }
              }}
            >
              <Select.Option value={null}>无排班</Select.Option>
              {shifts.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name} ({s.start_time}-{s.end_time})
                </Select.Option>
              ))}
            </Select>
            <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
              <Button
                type="primary"
                onClick={async () => {
                  if (rosterEditModal) {
                    await updateCellRoster(rosterEditModal.userId, rosterEditModal.date, rosterEditModal.shiftId)
                    setRosterEditModal(null)
                  }
                }}
              >
                保存
              </Button>
              <Button
                onClick={async () => {
                  if (rosterEditModal) {
                    await updateCellRoster(rosterEditModal.userId, rosterEditModal.date, null)
                    setRosterEditModal(null)
                  }
                }}
              >
                清除排班
              </Button>
              <Button onClick={() => setRosterEditModal(null)}>取消</Button>
            </Space>
          </Space>
        )}
      </Modal>
    </Space>
  )
}

export default AttendanceConfigPage

