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
} from 'antd'
import dayjs from 'dayjs'
import {
  listShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  getAttendancePolicy,
  updateAttendancePolicy,
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  listRosters,
  setRosters,
  type ShiftTemplate,
  type AttendancePolicy,
  type LeaveTypeDict,
  type RosterItemPayload,
} from '../api/services/attendanceConfig'

const { RangePicker } = DatePicker

const AttendanceConfigPage = () => {
  const { message: antdMessage, modal } = AntdApp.useApp()

  const [loadingShifts, setLoadingShifts] = useState(false)
  const [shifts, setShifts] = useState<ShiftTemplate[]>([])
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null)
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDict[]>([])
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false)
  const [rosterForm] = Form.useForm()
  const [rosterData, setRosterData] = useState<any[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftTemplate | null>(null)
  const [shiftForm] = Form.useForm()

  const [leaveTypeModalOpen, setLeaveTypeModalOpen] = useState(false)
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveTypeDict | null>(null)
  const [leaveTypeForm] = Form.useForm()

  const fetchShifts = async () => {
    setLoadingShifts(true)
    try {
      const data = await listShiftTemplates()
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
      const data = await getAttendancePolicy()
      setPolicy(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取策略失败')
    } finally {
      setLoadingPolicy(false)
    }
  }

  const fetchLeaveTypes = async () => {
    setLoadingLeaveTypes(true)
    try {
      const data = await listLeaveTypes()
      setLeaveTypes(data)
    } catch (err: any) {
      antdMessage.error(err.message || '获取请假类型失败')
    } finally {
      setLoadingLeaveTypes(false)
    }
  }

  const fetchRoster = async () => {
    try {
      const values = rosterForm.getFieldsValue()
      if (!values.dateRange || values.dateRange.length !== 2) {
        antdMessage.warning('请选择排班日期范围')
        return
      }
      setLoadingRoster(true)
      const start = values.dateRange[0].format('YYYY-MM-DD')
      const end = values.dateRange[1].format('YYYY-MM-DD')
      const data = await listRosters({ start_date: start, end_date: end })
      setRosterData(data || [])
    } catch (err: any) {
      antdMessage.error(err.message || '获取排班失败')
    } finally {
      setLoadingRoster(false)
    }
  }

  useEffect(() => {
    fetchShifts()
    fetchPolicy()
    fetchLeaveTypes()
  }, [])

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
                      await deleteShiftTemplate(record.id)
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
                      await deleteLeaveType(record.id)
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
                        await updateAttendancePolicy(values)
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
                title="排班管理（按日期范围查询/设置）"
                extra={
                  <Button onClick={fetchRoster} loading={loadingRoster}>
                    刷新
                  </Button>
                }
              >
                <Form form={rosterForm} layout="inline" initialValues={{ dateRange: [dayjs(), dayjs().add(7, 'day')], status: 'normal' }}>
                  <Form.Item label="日期范围" name="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}>
                    <RangePicker />
                  </Form.Item>
                  <Form.Item label="用户ID列表(逗号)" name="userIds">
                    <Input placeholder="例如: 1,2,3" />
                  </Form.Item>
                  <Form.Item label="班次" name="shift_id">
                    <Select
                      allowClear
                      style={{ width: 200 }}
                      options={shifts.map((s) => ({ label: `${s.name} (${s.start_time}-${s.end_time})`, value: s.id }))}
                    />
                  </Form.Item>
                  <Form.Item label="状态" name="status">
                    <Select
                      style={{ width: 140 }}
                      options={[
                        { label: '正常', value: 'normal' },
                        { label: '请假/外勤', value: 'leave' },
                        { label: '休息', value: 'off' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button type="primary" onClick={fetchRoster} loading={loadingRoster}>
                        查询
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const values = await rosterForm.validateFields()
                            const userIds =
                              values.userIds
                                ?.split(',')
                                .map((id: string) => parseInt(id.trim(), 10))
                                .filter((x: number) => !isNaN(x)) || []
                            if (!userIds.length) {
                              antdMessage.warning('请填写用户ID列表')
                              return
                            }
                            if (!values.dateRange || values.dateRange.length !== 2) {
                              antdMessage.warning('请选择日期范围')
                              return
                            }
                            const [start, end] = values.dateRange
                            const days: string[] = []
                            let cur = start.clone()
                            while (cur.isBefore(end) || cur.isSame(end, 'day')) {
                              days.push(cur.format('YYYY-MM-DD'))
                              cur = cur.add(1, 'day')
                            }
                            const items: RosterItemPayload[] = []
                            userIds.forEach((uid: number) => {
                              days.forEach((d) => {
                                items.push({
                                  user_id: uid,
                                  work_date: d,
                                  shift_id: values.shift_id,
                                  status: values.status || 'normal',
                                })
                              })
                            })
                            await setRosters(items)
                            antdMessage.success('排班已保存')
                            fetchRoster()
                          } catch {}
                        }}
                        loading={loadingRoster}
                      >
                        批量排班
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
                <Divider />
                <Table
                  rowKey="id"
                  loading={loadingRoster}
                  columns={[
                    { title: '用户ID', dataIndex: 'user_id' },
                    { title: '日期', dataIndex: 'work_date' },
                    { title: '班次ID', dataIndex: 'shift_id' },
                    { title: '状态', dataIndex: 'status' },
                  ]}
                  dataSource={rosterData}
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
              await updateShiftTemplate(editingShift.id, payload)
              antdMessage.success('班次已更新')
            } else {
              await createShiftTemplate(payload)
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
              await updateLeaveType(editingLeaveType.id, values)
              antdMessage.success('已更新')
            } else {
              await createLeaveType(values)
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
    </Space>
  )
}

const formPolicy = Form.useFormInstance?.() // placeholder to satisfy TS, real instance below

export default AttendanceConfigPage

