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
  type ShiftTemplate,
  type AttendancePolicy,
  type LeaveTypeDict,
  type RosterItemPayload,
  type GeoFence,
} from '../api/services/attendanceConfig'
import { fetchUsers, type User } from '../api/services/users'
import useCompanyStore from '../store/company'

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
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [fenceList, setFenceList] = useState<GeoFence[]>([])
  const [loadingFences, setLoadingFences] = useState(false)
  const [fenceModalOpen, setFenceModalOpen] = useState(false)
  const [editingFence, setEditingFence] = useState<GeoFence | null>(null)
  const [fenceForm] = Form.useForm()
  const currentCompanyId = useCompanyStore((s) => s.currentCompany?.id)

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
      const data = await listRosters({ start_date: start, end_date: end }, currentCompanyId || undefined)
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
    fetchFenceList()
    fetchUserOptions()
  }, [currentCompanyId])

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
                  <Form.Item label="用户" name="userIds">
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      filterOption={false}
                      onSearch={(val) => fetchUserOptions(val)}
                      placeholder="选择或搜索用户"
                      notFoundContent={loadingUsers ? '加载中...' : '无数据'}
                      options={userOptions}
                      style={{ minWidth: 260 }}
                    />
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
                            const userIds = (values.userIds as number[]) || []
                            if (!userIds.length) {
                              antdMessage.warning('请选择用户')
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
                            await setRosters(items, currentCompanyId || undefined)
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
          {
            key: 'fence',
            label: '电子围栏',
            children: (
              <Card
                title="电子围栏"
                extra={
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
                        <Space>
                          <Button
                            type="link"
                            onClick={() => {
                              setEditingFence(record)
                              fenceForm.setFieldsValue({
                                name: record.name,
                                center_lng: record.center_lng,
                                center_lat: record.center_lat,
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
        onCancel={() => setFenceModalOpen(false)}
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
          <Form.Item label="经度" name="center_lng" rules={[{ required: true, type: 'number' }]}>
            <InputNumber className="w-full" controls={false} />
          </Form.Item>
          <Form.Item label="纬度" name="center_lat" rules={[{ required: true, type: 'number' }]}>
            <InputNumber className="w-full" controls={false} />
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
    </Space>
  )
}

export default AttendanceConfigPage

