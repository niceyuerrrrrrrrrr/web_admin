import { useEffect, useMemo, useState } from 'react'
import {
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
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { Column, Line, Pie } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  AuditOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  NotificationOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { NoticeDetail, NoticeRecord, NoticeStats, NoticeStatus } from '../api/types'
import {
  createNotice,
  deleteNotice,
  fetchNoticeDetail,
  fetchNoticeRoles,
  fetchNoticeStats,
  fetchNotices,
  markNoticeRead,
  updateNotice,
} from '../api/services/notice'

const { RangePicker } = DatePicker

const statusColorMap: Record<NoticeStatus, string> = {
  draft: 'default',
  published: 'success',
  archived: 'purple',
}

const NoticesPage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{
    status?: NoticeStatus
    notice_type?: string
    is_urgent?: boolean
    page: number
    page_size: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    status: 'published',
    page: 1,
    page_size: 10,
  })
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<NoticeDetail | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const rolesQuery = useQuery({
    queryKey: ['notice', 'roles'],
    queryFn: fetchNoticeRoles,
  })

  const listQuery = useQuery({
    queryKey: ['notice', 'list', filters],
    queryFn: () =>
      fetchNotices({
        status: filters.status,
        notice_type: filters.notice_type,
        is_urgent: filters.is_urgent,
        page: filters.page,
        page_size: filters.page_size,
      }),
  })

  const statsQuery = useQuery({
    queryKey: ['notice', 'stats', filters.dateRange],
    queryFn: () =>
      fetchNoticeStats({
        begin_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['notice', 'detail', detailId],
    queryFn: () => fetchNoticeDetail(detailId as number),
    enabled: !!detailId,
  })

  useEffect(() => {
    if (detailId) {
      markNoticeRead(detailId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['notice', 'list'] })
      })
    }
  }, [detailId, queryClient])

  const createMutation = useMutation({
    mutationFn: createNotice,
    onSuccess: () => {
      message.success('公告创建成功')
      setCreateModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['notice', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['notice', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => updateNotice(id, payload),
    onSuccess: () => {
      message.success('公告已更新')
      setEditingNotice(null)
      queryClient.invalidateQueries({ queryKey: ['notice', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['notice', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      message.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['notice', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['notice', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const rolesOptions =
    rolesQuery.data?.roles.map((role) => ({
      value: role,
      label: role,
    })) || []

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const payload = {
      title: values.title,
      content: values.content,
      notice_type: values.notice_type,
      target_roles: values.target_roles,
      is_urgent: values.is_urgent || false,
    }
    if (editingNotice) {
      updateMutation.mutate({ id: editingNotice.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (record: NoticeRecord) => {
    modal.confirm({
      title: '确认删除此公告？',
      onOk: () => deleteMutation.mutate(record.id),
    })
  }

  const handleEdit = async (id: number) => {
    try {
      const detail = await fetchNoticeDetail(id)
      setEditingNotice(detail)
      form.setFieldsValue({
        title: detail.title,
        content: detail.content,
        notice_type: detail.notice_type,
        target_roles: detail.target_roles ? detail.target_roles.split(',').filter(Boolean) : [],
        is_urgent: detail.is_urgent,
      })
      setCreateModalOpen(true)
    } catch (error) {
      message.error((error as Error).message || '获取公告详情失败')
    }
  }

  const columns: ColumnsType<NoticeRecord> = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (text, record) => (
        <Space>
          {record.is_urgent && <Tag color="red">紧急</Tag>}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'notice_type',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: NoticeStatus) => <Tag color={statusColorMap[value]}>{value}</Tag>,
    },
    {
      title: '阅读数',
      dataIndex: 'read_count',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
    },
    {
      title: '操作',
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(record.id)}>
            查看
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.id)}
          >
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const stats = statsQuery.data as NoticeStats | undefined
  const typeData = stats?.by_type.map((item) => ({ type: item.notice_type, value: item.count })) || []
  const statusData = stats?.by_status.map((item) => ({ status: item.status, value: item.count })) || []
  const recentData = stats?.recent
    ?.map((item) => ({
      date: item.date,
      count: item.count,
    }))
    .reverse()
    .slice(-10)

  const pieConfig = {
    data: typeData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
  }

  const statusConfig = {
    data: statusData,
    xField: 'status',
    yField: 'value',
    columnWidthRatio: 0.5,
  }

  const lineConfig = {
    data: recentData || [],
    xField: 'date',
    yField: 'count',
    smooth: true,
  }

  const selectedDetail = detailQuery.data

  const statsCards = useMemo(
    () => [
      { title: '公告总数', value: stats?.summary.total ?? 0, icon: <NotificationOutlined /> },
      { title: '已发布', value: stats?.summary.published ?? 0, icon: <CheckCircleOutlined />, color: '#52c41a' },
      { title: '草稿', value: stats?.summary.draft ?? 0, icon: <EditOutlined />, color: '#faad14' },
      { title: '紧急公告', value: stats?.summary.urgent ?? 0, icon: <AuditOutlined />, color: '#ff4d4f' },
    ],
    [stats],
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <div>
          <h2 style={{ marginBottom: 0 }}>通知公告管理</h2>
          <p style={{ marginBottom: 0, color: '#666' }}>发布、推送并统计企业公告的阅读情况</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['notice', 'list'] })}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingNotice(null)
              form.resetFields()
              setCreateModalOpen(true)
            }}
          >
            新建公告
          </Button>
        </Space>
      </Flex>

      <Tabs
        items={[
          {
            key: 'list',
            label: '公告列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex gap={16} wrap>
                  <Select
                    allowClear
                    placeholder="筛选状态"
                    style={{ width: 180 }}
                    value={filters.status}
                    onChange={(value) => setFilters((prev) => ({ ...prev, status: value as NoticeStatus | undefined, page: 1 }))}
                    options={[
                      { value: 'draft', label: '草稿' },
                      { value: 'published', label: '已发布' },
                      { value: 'archived', label: '已归档' },
                    ]}
                  />
                  <Select
                    allowClear
                    placeholder="通知类型"
                    style={{ width: 180 }}
                    value={filters.notice_type}
                    onChange={(value) => setFilters((prev) => ({ ...prev, notice_type: value || undefined, page: 1 }))}
                    options={[
                      { value: 'normal', label: '普通' },
                      { value: 'urgent', label: '紧急' },
                      { value: 'announcement', label: '公告' },
                    ]}
                  />
                  <Select
                    allowClear
                    placeholder="是否紧急"
                    style={{ width: 150 }}
                    value={filters.is_urgent}
                    onChange={(value) => setFilters((prev) => ({ ...prev, is_urgent: value, page: 1 }))}
                    options={[
                      { value: true, label: '紧急' },
                      { value: false, label: '普通' },
                    ]}
                  />
                  <RangePicker
                    value={filters.dateRange}
                    onChange={(value) => {
                      const normalized =
                        value && value[0] && value[1] ? ([value[0], value[1]] as [dayjs.Dayjs, dayjs.Dayjs]) : undefined
                      setFilters((prev) => ({ ...prev, dateRange: normalized, page: 1 }))
                    }}
                  />
                </Flex>
                <Table
                  rowKey="id"
                  loading={listQuery.isLoading}
                  columns={columns}
                  dataSource={listQuery.data?.records || []}
                  pagination={{
                    current: filters.page,
                    pageSize: filters.page_size,
                    total: listQuery.data?.total,
                    onChange: (page, pageSize) => setFilters((prev) => ({ ...prev, page, page_size: pageSize || prev.page_size })),
                  }}
                />
              </Space>
            ),
          },
          {
            key: 'stats',
            label: '公告统计',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                  {statsCards.map((card) => (
                    <Col span={6} key={card.title}>
                      <Card>
                        <Statistic title={card.title} value={card.value} prefix={card.icon} />
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按类型分布">
                      <Pie {...pieConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="按状态分布">
                      <Column {...statusConfig} />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="最近发布趋势">
                      <Line {...lineConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="阅读 Top 公告">
                      <List
                        dataSource={stats?.top_notices || []}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  {item.is_urgent && <Tag color="red">紧急</Tag>}
                                  <span>{item.title}</span>
                                </Space>
                              }
                              description={`${item.notice_type} · 阅读 ${item.read_count}`}
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        width={720}
        title="公告详情"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detailQuery.isLoading ? (
          <p>加载中...</p>
        ) : selectedDetail ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="标题" span={2}>
                {selectedDetail.title}
              </Descriptions.Item>
              <Descriptions.Item label="类型">{selectedDetail.notice_type}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedDetail.status]}>{selectedDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标角色" span={2}>
                {selectedDetail.target_roles || '全部'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedDetail.created_at}</Descriptions.Item>
              <Descriptions.Item label="阅读数">{selectedDetail.read_count || 0}</Descriptions.Item>
            </Descriptions>
            <Card title="正文">
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedDetail.content}</div>
            </Card>
          </Space>
        ) : (
          <p>暂无数据</p>
        )}
      </Drawer>

      <Modal
        title={editingNotice ? '编辑公告' : '新建公告'}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          setEditingNotice(null)
        }}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="公告内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item label="公告类型" name="notice_type" initialValue="normal">
            <Select
              options={[
                { value: 'normal', label: '普通' },
                { value: 'urgent', label: '紧急通知' },
                { value: 'announcement', label: '公告' },
              ]}
            />
          </Form.Item>
          <Form.Item label="目标角色" name="target_roles">
            <Select mode="multiple" allowClear placeholder="不选即为全部" options={rolesOptions} />
          </Form.Item>
          <Form.Item label="是否标记为紧急" name="is_urgent" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="紧急" unCheckedChildren="普通" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default NoticesPage

