import { useState } from 'react'
import {
  App as AntdApp,
  Avatar,
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
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd'
import { Column, Pie } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  BugOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FireOutlined,
  FileSearchOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ReportCommentRecord, ReportRecord, ReportStats, ReportStatus } from '../api/types'
import {
  addReportComment,
  approveReport,
  closeReport,
  createReport,
  deleteReport,
  fetchReportComments,
  fetchReportDetail,
  fetchReportHistory,
  fetchReportStats,
  fetchReports,
  resolveReport,
  revokeReport,
  submitReport,
  uploadReportImage,
} from '../api/services/report'
import { fetchUsers } from '../api/services/users'

const { RangePicker } = DatePicker

const statusColors: Record<ReportStatus, string> = {
  draft: 'default',
  submitted: 'default',
  reviewing: 'processing',
  processing: 'warning',
  resolved: 'success',
  rejected: 'error',
  closed: 'purple',
}

const ReportsPage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{
    status?: ReportStatus
    user_id?: number
    keyword?: string
    page: number
    page_size: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    page: 1,
    page_size: 10,
  })
  const [detailId, setDetailId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [commentValue, setCommentValue] = useState('')
  const [commentImages, setCommentImages] = useState<string[]>([])
  const [createForm] = Form.useForm()

  const handleDateRangeChange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null, resetPage = true) => {
    const normalized =
      value && value[0] && value[1] ? ([value[0], value[1]] as [dayjs.Dayjs, dayjs.Dayjs]) : undefined
    setFilters((prev) => ({
      ...prev,
      dateRange: normalized,
      ...(resetPage ? { page: 1 } : {}),
    }))
  }

  const reportsQuery = useQuery({
    queryKey: ['reports', filters],
    queryFn: () =>
      fetchReports({
        status: filters.status,
        user_id: filters.user_id,
        keyword: filters.keyword,
        page: filters.page,
        page_size: filters.page_size,
        begin_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      }),
  })

  const statsQuery = useQuery({
    queryKey: ['reports', 'stats', filters.dateRange],
    queryFn: () =>
      fetchReportStats({
        begin_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['reports', 'detail', detailId],
    queryFn: () => fetchReportDetail(detailId as number),
    enabled: !!detailId,
  })

  const historyQuery = useQuery({
    queryKey: ['reports', 'history', detailId],
    queryFn: () => fetchReportHistory(detailId as number),
    enabled: !!detailId,
  })

  const commentsQuery = useQuery({
    queryKey: ['reports', 'comments', detailId],
    queryFn: () => fetchReportComments(detailId as number),
    enabled: !!detailId,
  })

  const usersQuery = useQuery({
    queryKey: ['reports', 'users'],
    queryFn: () => fetchUsers({ size: 200 }),
  })

  const createMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      message.success('故障报告已创建')
      setCreateOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteReport,
    onSuccess: () => {
      message.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const submitMutation = useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '提交失败'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) => approveReport(id, action),
    onSuccess: () => {
      message.success('操作成功')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'history'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const resolveMutation = useMutation({
    mutationFn: resolveReport,
    onSuccess: () => {
      message.success('已标记为已解决')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const closeMutation = useMutation({
    mutationFn: closeReport,
    onSuccess: () => {
      message.success('已关闭')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeReport,
    onSuccess: () => {
      message.success('已撤销')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'history'] })
    },
    onError: (error) => message.error((error as Error).message || '撤销失败'),
  })

  const commentMutation = useMutation({
    mutationFn: ({ id, content, images }: { id: number; content?: string; images?: string[] }) =>
      addReportComment(id, { content, images }),
    onSuccess: () => {
      setCommentValue('')
      setCommentImages([])
      queryClient.invalidateQueries({ queryKey: ['reports', 'comments'] })
      message.success('评论成功')
    },
    onError: (error) => message.error((error as Error).message || '评论失败'),
  })

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    createMutation.mutate({
      type: values.type,
      title: values.title,
      description: values.description,
      location: values.location,
      priority: values.priority,
      images: values.images || [],
    })
  }

  const handleUpload = async (file: File, target: 'form' | 'comment') => {
    try {
      const res = await uploadReportImage(file)
      if (target === 'form') {
        const list = createForm.getFieldValue('images') || []
        createForm.setFieldsValue({ images: [...list, res.url] })
      } else {
        setCommentImages((prev) => [...prev, res.url])
      }
      message.success('上传成功')
    } catch (error) {
      message.error((error as Error).message || '上传失败')
    }
    return Upload.LIST_IGNORE
  }

  const handleApproveAction = (record: ReportRecord, action: 'approve' | 'reject') => {
    modal.confirm({
      title: action === 'approve' ? '确认通过该报告？' : '确认拒绝该报告？',
      onOk: () => approveMutation.mutate({ id: record.id, action }),
    })
  }

  const handleDelete = (record: ReportRecord) => {
    modal.confirm({
      title: '确认删除该报告？',
      onOk: () => deleteMutation.mutate(record.id),
    })
  }

  const handleSubmit = (record: ReportRecord) => {
    submitMutation.mutate(record.id)
  }

  const handleResolve = (record: ReportRecord) => {
    resolveMutation.mutate(record.id)
  }

  const handleClose = (record: ReportRecord) => {
    closeMutation.mutate(record.id)
  }

  const handleRevoke = (record: ReportRecord) => {
    modal.confirm({
      title: '确认撤销该报告？',
      onOk: () => revokeMutation.mutate(record.id),
    })
  }

  const columns: ColumnsType<ReportRecord> = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (text, record) => (
        <Space>
          <Tag color={record.priority === 'urgent' ? 'red' : record.priority === 'high' ? 'orange' : 'blue'}>
            {record.priority}
          </Tag>
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
    },
    {
      title: '位置',
      dataIndex: 'location',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: ReportStatus) => <Tag color={statusColors[value]}>{value}</Tag>,
    },
    {
      title: '当前审批人',
      dataIndex: 'approver_name',
    },
    {
      title: '提交时间',
      dataIndex: 'submit_time',
    },
    {
      title: '操作',
      width: 320,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<FileSearchOutlined />} onClick={() => setDetailId(record.id)}>
            详情
          </Button>
          {['draft', 'rejected'].includes(record.status) && (
            <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          )}
          {record.status === 'submitted' && (
            <Button size="small" type="primary" onClick={() => handleSubmit(record)}>
              提交审批
            </Button>
          )}
          {record.status === 'reviewing' && (
            <>
              <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleApproveAction(record, 'approve')}>
                通过
              </Button>
              <Button size="small" danger icon={<StopOutlined />} onClick={() => handleApproveAction(record, 'reject')}>
                拒绝
              </Button>
            </>
          )}
          {record.status === 'processing' && (
            <Button size="small" type="dashed" icon={<BugOutlined />} onClick={() => handleResolve(record)}>
              已解决
            </Button>
          )}
          {record.status === 'resolved' && (
            <Button size="small" icon={<CloseCircleOutlined />} onClick={() => handleClose(record)}>
              关闭
            </Button>
          )}
          {record.status in (['submitted', 'reviewing'] as ReportStatus[]) && (
            <Button size="small" onClick={() => handleRevoke(record)}>
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const userOptions =
    usersQuery.data?.items.map((item) => ({
      value: item.id,
      label: `${item.name || item.nickname || '用户'}(${item.id})`,
    })) || []

  const stats = statsQuery.data as ReportStats | undefined
  const typeData = stats?.by_type || []
  const statusData = stats?.by_status || []
  const priorityData = stats?.by_priority || []

  const pieConfig = {
    data: typeData.map((item) => ({ type: item.type, value: item.count })),
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: { type: 'outer', content: '{name} {percentage}' },
  }

  const statusConfig = {
    data: statusData.map((item) => ({ status: item.status, value: item.count })),
    xField: 'status',
    yField: 'value',
    columnWidthRatio: 0.6,
  }

  const priorityConfig = {
    data: priorityData.map((item) => ({ priority: item.priority, value: item.count })),
    xField: 'priority',
    yField: 'value',
    columnWidthRatio: 0.6,
  }

  const selectedDetail = detailQuery.data
  const historyRecords = historyQuery.data?.records || []
  const comments = commentsQuery.data?.comments || []

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <div>
          <h2 style={{ marginBottom: 0 }}>故障上报管理</h2>
          <p style={{ marginBottom: 0, color: '#666' }}>集中处理故障上报、审批与统计分析</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateOpen(true)}>
            新建故障
          </Button>
        </Space>
      </Flex>

      <Tabs
        items={[
          {
            key: 'list',
            label: '故障列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex gap={16} wrap>
                  <Select
                    placeholder="按状态筛选"
                    allowClear
                    style={{ width: 200 }}
                    options={[
                      { value: 'draft', label: '草稿' },
                      { value: 'submitted', label: '已提交' },
                      { value: 'reviewing', label: '审批中' },
                      { value: 'processing', label: '处理中' },
                      { value: 'resolved', label: '已解决' },
                      { value: 'rejected', label: '已拒绝' },
                      { value: 'closed', label: '已关闭' },
                    ]}
                    value={filters.status}
                    onChange={(value) => setFilters((prev) => ({ ...prev, status: value as ReportStatus | undefined, page: 1 }))}
                  />
                  <Select
                    placeholder="按员工筛选"
                    showSearch
                    allowClear
                    style={{ width: 220 }}
                    options={userOptions}
                    value={filters.user_id}
                    onChange={(value) => setFilters((prev) => ({ ...prev, user_id: value, page: 1 }))}
                    optionFilterProp="label"
                  />
                  <Input
                    placeholder="关键字"
                    style={{ width: 200 }}
                    value={filters.keyword}
                    onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value, page: 1 }))}
                  />
                  <RangePicker value={filters.dateRange} onChange={(value) => handleDateRangeChange(value, true)} />
                </Flex>
                <Table
                  rowKey="id"
                  loading={reportsQuery.isLoading}
                  columns={columns}
                  dataSource={reportsQuery.data?.records || []}
                  pagination={{
                    current: filters.page,
                    pageSize: filters.page_size,
                    total: reportsQuery.data?.total,
                    onChange: (page, pageSize) => setFilters((prev) => ({ ...prev, page, page_size: pageSize || prev.page_size })),
                  }}
                />
              </Space>
            ),
          },
          {
            key: 'stats',
            label: '故障统计',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex gap={16} wrap>
                  <RangePicker value={filters.dateRange} onChange={(value) => handleDateRangeChange(value, false)} />
                </Flex>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card>
                      <Statistic title="故障总数" value={stats?.summary.total ?? 0} prefix={<FireOutlined />} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title="处理中" value={stats?.summary.processing ?? 0} prefix={<PauseCircleOutlined />} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title="已解决" value={stats?.summary.resolved ?? 0} prefix={<CheckCircleOutlined />} />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按类型">
                      <Pie {...pieConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="按状态">
                      <Column {...statusConfig} />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按优先级">
                      <Column {...priorityConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="待处理 TOP">
                      <List
                        dataSource={stats?.pending_list || []}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Tag color="red">{item.priority}</Tag>
                                  <span>{item.title}</span>
                                </Space>
                              }
                              description={`${item.applicant_name || ''} · ${item.created_at || ''}`}
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
        title="故障详情"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detailQuery.isLoading || !selectedDetail ? (
          <p>加载中...</p>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="标题" span={2}>
                {selectedDetail.title}
              </Descriptions.Item>
              <Descriptions.Item label="类型">{selectedDetail.type}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={selectedDetail.priority === 'urgent' ? 'red' : 'blue'}>{selectedDetail.priority}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="位置">{selectedDetail.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[selectedDetail.status]}>{selectedDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="说明" span={2}>
                {selectedDetail.description || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Flex gap={12} wrap>
              {selectedDetail.images?.map((img) => (
                <Avatar shape="square" key={img} src={img} size={80} />
              ))}
            </Flex>
            <Flex gap={8} wrap>
              {selectedDetail.status === 'submitted' && (
                <Button type="primary" onClick={() => handleSubmit(selectedDetail)}>
                  提交审批
                </Button>
              )}
              {selectedDetail.status === 'reviewing' && (
                <>
                  <Button onClick={() => handleApproveAction(selectedDetail, 'approve')}>通过</Button>
                  <Button danger onClick={() => handleApproveAction(selectedDetail, 'reject')}>
                    拒绝
                  </Button>
                </>
              )}
              {selectedDetail.status === 'processing' && (
                <Button onClick={() => handleResolve(selectedDetail)}>标记已解决</Button>
              )}
              {selectedDetail.status === 'resolved' && (
                <Button onClick={() => handleClose(selectedDetail)}>关闭报告</Button>
              )}
              {['submitted', 'reviewing'].includes(selectedDetail.status) && (
                <Button onClick={() => handleRevoke(selectedDetail)}>撤销</Button>
              )}
            </Flex>
            <Card title="审批记录" size="small">
              <List
                dataSource={historyRecords}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.approver_name} - ${item.action}`}
                      description={
                        <Space direction="vertical">
                          <span>{item.comment}</span>
                          <span style={{ color: '#999' }}>{item.created_at}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
            <Card title="评论" size="small">
              <List
                dataSource={comments}
                locale={{ emptyText: '暂无评论' }}
                renderItem={(item: ReportCommentRecord) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <strong>{item.user_name}</strong>
                          <span style={{ color: '#999' }}>{item.created_at}</span>
                        </Space>
                      }
                      description={
                        <Space direction="vertical">
                          <span>{item.content}</span>
                          <Flex gap={8} wrap>
                            {item.images?.map((img) => (
                              <Avatar key={img} src={img} shape="square" size={48} />
                            ))}
                          </Flex>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={3}
                  placeholder="添加评论..."
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                />
                <Upload beforeUpload={(file) => handleUpload(file, 'comment')} listType="picture-card" showUploadList={false}>
                  <Button icon={<CloudUploadOutlined />}>上传图片</Button>
                </Upload>
                <Flex gap={8}>
                  {commentImages.map((img) => (
                    <Avatar key={img} src={img} shape="square" size={48} />
                  ))}
                </Flex>
                <Button
                  type="primary"
                  loading={commentMutation.isPending}
                  onClick={() => {
                    if (!detailId) return
                    commentMutation.mutate({ id: detailId, content: commentValue, images: commentImages })
                  }}
                >
                  发布评论
                </Button>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="新建故障报告"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
        width={640}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="故障类型" name="type" rules={[{ required: true }]}>
            <Select
              placeholder="选择类型"
              options={[
                { value: '车辆故障', label: '车辆故障' },
                { value: '设备故障', label: '设备故障' },
                { value: '系统故障', label: '系统故障' },
                { value: '其他', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input placeholder="简要描述故障" />
          </Form.Item>
          <Form.Item label="位置" name="location">
            <Input placeholder="例如：车牌/仓库/线路" />
          </Form.Item>
          <Form.Item label="优先级" name="priority" initialValue="medium">
            <Select
              options={[
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
                { value: 'urgent', label: '紧急' },
              ]}
            />
          </Form.Item>
          <Form.Item label="详细描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="相关图片" name="images">
            <Upload beforeUpload={(file) => handleUpload(file, 'form')} listType="picture-card" showUploadList={false} multiple>
              <Button icon={<CloudUploadOutlined />}>上传图片</Button>
            </Upload>
            <Flex gap={8} wrap>
              {(createForm.getFieldValue('images') || []).map((img: string) => (
                <Avatar key={img} src={img} shape="square" size={64} />
              ))}
            </Flex>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ReportsPage
