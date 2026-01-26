import { useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { Column, Pie } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import type { LeaveCommentRecord, LeaveRecord, LeaveStats, LeaveStatus } from '../api/types'
import {
  addLeaveComment,
  approveLeave,
  createLeave,
  deleteLeave,
  fetchLeaveComments,
  fetchLeaveDetail,
  fetchLeaveHistory,
  fetchLeaveStats,
  fetchLeaves,
  revokeLeave,
  submitLeave,
  uploadLeaveImage,
} from '../api/services/leave'
import { fetchUsers } from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { RangePicker } = DatePicker
const { Title, Text, Paragraph } = Typography

const statusColorMap: Record<LeaveStatus, string> = {
  submitted: 'default',
  reviewing: 'processing',
  approved: 'success',
  rejected: 'error',
}

const LeavePage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [filters, setFilters] = useState<{
    status?: LeaveStatus
    user_id?: number
    page: number
    page_size: number
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    status: undefined,
    user_id: undefined,
    page: 1,
    page_size: 10,
  })
  const [detailId, setDetailId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [commentValue, setCommentValue] = useState('')
  const [commentImages, setCommentImages] = useState<string[]>([])
  const [createForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const handleDateRangeChange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null, resetPage = true) => {
    const normalized =
      value && value[0] && value[1] ? ([value[0], value[1]] as [dayjs.Dayjs, dayjs.Dayjs]) : undefined
    setFilters((prev) => ({
      ...prev,
      dateRange: normalized,
      ...(resetPage ? { page: 1 } : {}),
    }))
  }

  const leavesQuery = useQuery({
    queryKey: ['leave', 'list', filters, effectiveCompanyId],
    queryFn: () =>
      fetchLeaves({
        status: filters.status,
        user_id: filters.user_id,
        page: filters.page,
        page_size: filters.page_size,
        begin_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const statsQuery = useQuery({
    queryKey: ['leave', 'stats', filters.dateRange],
    queryFn: () =>
      fetchLeaveStats({
        begin_date: filters.dateRange ? filters.dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: filters.dateRange ? filters.dateRange[1].format('YYYY-MM-DD') : undefined,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['leave', 'detail', detailId],
    queryFn: () => fetchLeaveDetail(detailId as number),
    enabled: !!detailId,
  })

  const historyQuery = useQuery({
    queryKey: ['leave', 'history', detailId],
    queryFn: () => fetchLeaveHistory(detailId as number),
    enabled: !!detailId,
  })

  const commentsQuery = useQuery({
    queryKey: ['leave', 'comments', detailId],
    queryFn: () => fetchLeaveComments(detailId as number),
    enabled: !!detailId,
  })

  const usersQuery = useQuery({
    queryKey: ['leave', 'users', effectiveCompanyId],
    queryFn: () => fetchUsers({ size: 200, company_id: effectiveCompanyId }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const createMutation = useMutation({
    mutationFn: createLeave,
    onSuccess: () => {
      message.success('请假申请已创建')
      setCreateOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLeave,
    onSuccess: () => {
      message.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const submitMutation = useMutation({
    mutationFn: submitLeave,
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '提交失败'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) => approveLeave(id, action),
    onSuccess: () => {
      message.success('操作成功')
      queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'history'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeLeave,
    onSuccess: () => {
      message.success('已撤销')
      queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['leave', 'history'] })
    },
    onError: (error) => message.error((error as Error).message || '撤销失败'),
  })

  const commentMutation = useMutation({
    mutationFn: (payload: { id: number; content?: string; images?: string[] }) =>
      addLeaveComment(payload.id, { content: payload.content, images: payload.images }),
    onSuccess: () => {
      setCommentValue('')
      setCommentImages([])
      queryClient.invalidateQueries({ queryKey: ['leave', 'comments'] })
      message.success('评论成功')
    },
    onError: (error) => message.error((error as Error).message || '评论失败'),
  })

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    createMutation.mutate({
      user_id: values.user_id,
      leave_type: values.leave_type,
      start_date: values.range[0].format('YYYY-MM-DD'),
      end_date: values.range[1].format('YYYY-MM-DD'),
      days: values.days,
      reason: values.reason,
      images: values.images || [],
    })
  }

  const handleUpload = async (file: File, field: 'images' | 'comment') => {
    try {
      const res = await uploadLeaveImage(file)
      if (field === 'images') {
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

  const handleApproveAction = (record: LeaveRecord, action: 'approve' | 'reject') => {
    modal.confirm({
      title: action === 'approve' ? '确认通过该请假吗？' : '确认拒绝该请假吗？',
      onOk: () => approveMutation.mutate({ id: record.id, action }),
    })
  }

  const handleDelete = (record: LeaveRecord) => {
    modal.confirm({
      title: '确认删除该申请？',
      onOk: () => deleteMutation.mutate(record.id),
    })
  }

  const handleSubmitApproval = (record: LeaveRecord) => {
    submitMutation.mutate(record.id)
  }

  const handleRevoke = (record: LeaveRecord) => {
    modal.confirm({
      title: '确认撤销该申请？',
      onOk: () => revokeMutation.mutate(record.id),
    })
  }

  // 导出请假列表
  const handleExport = () => {
    const records = leavesQuery.data?.records || []
    if (records.length === 0) {
      message.warning('暂无数据可导出')
      return
    }

    try {
      const exportData = records.map((record) => ({
        '申请人': record.applicant_name || '-',
        '请假类型': record.leave_type || '-',
        '开始日期': record.start_date || '-',
        '结束日期': record.end_date || '-',
        '天数': record.days || '-',
        '最新评论': record.latest_comment || '-',
        '评论人': (record as any).comment_user || '-',
        '当前审批人': record.current_approver || '-',
        '状态': record.status === 'submitted' ? '已提交' : 
                record.status === 'reviewing' ? '审批中' : 
                record.status === 'approved' ? '已通过' : 
                record.status === 'rejected' ? '已驳回' : record.status,
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '请假列表')
      
      const fileName = `请假列表_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }

  const columns: ColumnsType<LeaveRecord> = [
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 120,
      filters: Array.from(new Set((leavesQuery.data?.records || []).map(r => r.applicant_name).filter(Boolean)))
        .sort()
        .map(val => ({ text: val as string, value: val as string })),
      onFilter: (value, record) => record.applicant_name === value,
      render: (text: string) => text || '-',
    },
    {
      title: '请假类型',
      dataIndex: 'leave_type',
      width: 120,
      filters: Array.from(new Set((leavesQuery.data?.records || []).map(r => r.leave_type).filter(Boolean)))
        .sort()
        .map(val => ({ text: val, value: val })),
      onFilter: (value, record) => record.leave_type === value,
    },
    {
      title: '起止时间',
      width: 220,
      render: (_, record) => `${record.start_date} ~ ${record.end_date}`,
    },
    {
      title: '天数',
      dataIndex: 'days',
      sorter: (a, b) => (a.days || 0) - (b.days || 0),
      width: 90,
    },
    {
      title: '凭证',
      dataIndex: 'images',
      width: 180,
      render: (value: string[]) => {
        if (!value || value.length === 0) return '-'
        const shown = value.slice(0, 2)
        const rest = value.length - shown.length
        return (
          <Image.PreviewGroup>
            <Space size={6} wrap>
              {shown.map((img, idx) => (
                <Image
                  key={idx}
                  src={img}
                  width={40}
                  height={40}
                  style={{ objectFit: 'cover', borderRadius: 6 }}
                />
              ))}
              {rest > 0 && <Text type="secondary">+{rest}</Text>}
            </Space>
          </Image.PreviewGroup>
        )
      },
    },
    {
      title: '最新评论',
      dataIndex: 'latest_comment',
      width: 200,
      ellipsis: true,
      render: (value: string, record: any) => {
        if (!value) return '-'
        return (
          <div>
            <Text ellipsis={{ tooltip: value }} style={{ display: 'block', marginBottom: 4 }}>
              {value}
            </Text>
            {record.comment_user && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.comment_user}
              </Text>
            )}
          </div>
        )
      },
    },
    {
      title: '评论图片',
      dataIndex: 'comment_images',
      width: 150,
      render: (value: string[]) => {
        if (!value || value.length === 0) return '-'
        const shown = value.slice(0, 2)
        const rest = value.length - shown.length
        return (
          <Image.PreviewGroup>
            <Space size={6} wrap>
              {shown.map((img, idx) => (
                <Image
                  key={idx}
                  src={img}
                  width={40}
                  height={40}
                  style={{ objectFit: 'cover', borderRadius: 6 }}
                />
              ))}
              {rest > 0 && <Text type="secondary">+{rest}</Text>}
            </Space>
          </Image.PreviewGroup>
        )
      },
    },
    {
      title: '当前审批人',
      dataIndex: 'current_approver',
      filters: Array.from(new Set((leavesQuery.data?.records || []).map(r => r.current_approver).filter(Boolean)))
        .sort()
        .map(val => ({ text: val as string, value: val as string })),
      onFilter: (value, record) => record.current_approver === value,
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      filters: [
        { text: '已提交', value: 'submitted' },
        { text: '审批中', value: 'reviewing' },
        { text: '已通过', value: 'approved' },
        { text: '已驳回', value: 'rejected' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (value: LeaveStatus) => {
        const statusMap: Record<LeaveStatus, string> = {
          submitted: '已提交',
          reviewing: '审批中',
          approved: '已通过',
          rejected: '已驳回',
        }
        return <Tag color={statusColorMap[value]}>{statusMap[value] || value}</Tag>
      },
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => {
        const buttons = [
          <Button key="detail" icon={<FileSearchOutlined />} size="small" onClick={() => setDetailId(record.id)}>
            详情
          </Button>,
        ]
        
        if (record.status === 'submitted') {
          buttons.push(
            <Button key="submit" type="primary" size="small" onClick={() => handleSubmitApproval(record)}>
              提交审批
            </Button>
          )
        }
        
        if (record.can_approve && record.status === 'reviewing') {
          buttons.push(
            <Button
              key="approve"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApproveAction(record, 'approve')}
            >
              通过
            </Button>,
            <Button
              key="reject"
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleApproveAction(record, 'reject')}
            >
              拒绝
            </Button>
          )
        }
        
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', justifyItems: 'start' }}>
            {buttons}
          </div>
        )
      },
    },
  ]

  const stats = statsQuery.data as LeaveStats | undefined
  const typeData =
    stats?.by_type.map((item) => ({
      type: item.leave_type,
      count: item.count,
      days: item.days,
    })) || []
  const statusData =
    stats?.by_status.map((item) => ({
      status: item.status,
      count: item.count,
    })) || []

  const pieConfig = {
    data: typeData,
    angleField: 'count',
    colorField: 'type',
    radius: 0.8,
    label: {
      content: (data: any) => {
        const item = data.data || data
        return `${item.type}: ${item.count || item.value}`
      },
    },
  }

  const columnConfig = {
    data: statusData,
    xField: 'status',
    yField: 'count',
    columnWidthRatio: 0.6,
  }

  const userOptions =
    (usersQuery.data?.items || [])
      .sort((a, b) => {
        const nameA = (a.name || a.nickname || '用户').toLowerCase()
        const nameB = (b.name || b.nickname || '用户').toLowerCase()
        return nameA.localeCompare(nameB, 'zh-CN')
      })
      .map((item) => ({
        value: item.id,
        label: `${item.name || item.nickname || '用户'}(${item.id})`,
      })) || []

  const selectedDetail = detailQuery.data
  const historyRecords = historyQuery.data?.records || []
  const comments = commentsQuery.data?.comments || []

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            请假管理
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            管理请假申请、审批流程以及可视化统计
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['leave', 'list'] })}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建请假
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看请假数据" showIcon />
      )}

      <Tabs
        items={[
          {
            key: 'list',
            label: '请假列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex gap={16} wrap>
                  <Select
                    placeholder="按状态筛选"
                    allowClear
                    style={{ width: 180 }}
                    value={filters.status}
                    options={[
                      { value: 'submitted', label: '已提交' },
                      { value: 'reviewing', label: '审批中' },
                      { value: 'approved', label: '已通过' },
                      { value: 'rejected', label: '已驳回' },
                    ]}
                    onChange={(value) => setFilters((prev) => ({ ...prev, status: value as LeaveStatus | undefined, page: 1 }))}
                  />
                  <Select
                    showSearch
                    allowClear
                    placeholder="选择员工"
                    style={{ width: 220 }}
                    options={userOptions}
                    onChange={(value) => setFilters((prev) => ({ ...prev, user_id: value, page: 1 }))}
                    value={filters.user_id}
                  />
                  <RangePicker value={filters.dateRange} onChange={(value) => handleDateRangeChange(value, true)} />
                </Flex>
                {selectedRowKeys.length > 0 && (
                  <Alert
                    message={`已选择 ${selectedRowKeys.length} 条记录`}
                    type="info"
                    showIcon
                    action={
                      <Button size="small" onClick={() => setSelectedRowKeys([])}>
                        清空选择
                      </Button>
                    }
                  />
                )}
                <Table
                  rowKey="id"
                  loading={leavesQuery.isLoading}
                  columns={columns}
                  dataSource={leavesQuery.data?.records || []}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                    columnWidth: 48,
                    selections: [
                      {
                        key: 'select-all-data',
                        text: '全选所有数据',
                        onSelect: () => {
                          const allKeys = (leavesQuery.data?.records || []).map((record) => record.id)
                          setSelectedRowKeys(allKeys)
                          message.success(`已全选 ${allKeys.length} 条数据`)
                        },
                      },
                      {
                        key: 'select-current-page',
                        text: '选择当前页',
                        onSelect: () => {
                          const records = leavesQuery.data?.records || []
                          const startIndex = (filters.page - 1) * filters.page_size
                          const endIndex = Math.min(startIndex + filters.page_size, records.length)
                          const pageKeys = records
                            .slice(startIndex, endIndex)
                            .map((record) => record.id)
                          setSelectedRowKeys(pageKeys)
                          message.success(`已选中当前页 ${pageKeys.length} 条数据`)
                        },
                      },
                      {
                        key: 'invert-selection',
                        text: '反选当前页',
                        onSelect: () => {
                          const records = leavesQuery.data?.records || []
                          const startIndex = (filters.page - 1) * filters.page_size
                          const endIndex = Math.min(startIndex + filters.page_size, records.length)
                          const pageData = records.slice(startIndex, endIndex)
                          const pageKeys = pageData.map((record) => record.id)
                          
                          const newSelectedKeys = [...selectedRowKeys]
                          pageKeys.forEach(key => {
                            const index = newSelectedKeys.indexOf(key)
                            if (index > -1) {
                              newSelectedKeys.splice(index, 1)
                            } else {
                              newSelectedKeys.push(key)
                            }
                          })
                          setSelectedRowKeys(newSelectedKeys)
                          message.success('已反选当前页')
                        },
                      },
                      {
                        key: 'clear-all',
                        text: '清空所有选择',
                        onSelect: () => {
                          setSelectedRowKeys([])
                          message.success('已清空所有选择')
                        },
                      },
                    ],
                  }}
                  pagination={{
                    current: filters.page,
                    pageSize: filters.page_size,
                    total: leavesQuery.data?.total,
                    showTotal: (total) => `共 ${total} 条`,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onChange: (page, pageSize) => setFilters((prev) => ({ ...prev, page, page_size: pageSize || prev.page_size })),
                  }}
                  scroll={{ x: 1400 }}
                />
              </Space>
            ),
          },
          {
            key: 'stats',
            label: '请假统计',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex gap={16} wrap>
                  <RangePicker value={filters.dateRange} onChange={(value) => handleDateRangeChange(value, false)} />
                </Flex>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="总请假次数"
                        value={stats?.summary?.total_requests ?? 0}
                        prefix={<CalendarOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="累计天数"
                        value={stats?.summary?.total_days ?? 0}
                        suffix="天"
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按类型统计">
                      <Pie {...pieConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="按状态统计">
                      <Column {...columnConfig} />
                    </Card>
                  </Col>
                </Row>
                <Card title="请假天数 Top 10">
                  <List
                    dataSource={stats?.top_users || []}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar>{item.user_name?.charAt(0) || '用'}</Avatar>}
                          title={item.user_name}
                          description={`共 ${item.count} 次 / ${item.days} 天`}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        width={640}
        title="请假详情"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        destroyOnClose
      >
        {detailQuery.isLoading || !selectedDetail ? (
          <p>加载中...</p>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="申请人">{selectedDetail.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedDetail.leave_type}</Descriptions.Item>
              <Descriptions.Item label="日期">{`${selectedDetail.start_date} ~ ${selectedDetail.end_date}`}</Descriptions.Item>
              <Descriptions.Item label="天数">{selectedDetail.days}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={statusColorMap[selectedDetail.status]}>{selectedDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="事由" span={2}>
                {selectedDetail.reason || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card title="审批记录" size="small">
              <List
                dataSource={historyRecords}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.approver_name} ${item.action === 'approve' ? '通过' : item.action === 'reject' ? '拒绝' : ''}`}
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
                renderItem={(item: LeaveCommentRecord) => (
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
                          <Space wrap>
                            {item.images?.map((img) => (
                              <Avatar shape="square" key={img} src={img} size={64} />
                            ))}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={3}
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  placeholder="添加评论..."
                />
                <Upload
                  beforeUpload={(file) => handleUpload(file, 'comment')}
                  listType="picture-card"
                  showUploadList={false}
                >
                  <Button icon={<CloudUploadOutlined />}>上传图片</Button>
                </Upload>
                <Space>
                  {commentImages.map((img) => (
                    <Avatar shape="square" key={img} src={img} size={48} />
                  ))}
                </Space>
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
        title="新建请假申请"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
        width={640}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="申请人" name="user_id" rules={[{ required: true, message: '请选择申请人' }]}>
            <Select
              showSearch
              placeholder="请选择员工"
              options={userOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="请假类型" name="leave_type" rules={[{ required: true }]}>
            <Select
              placeholder="选择类型"
              options={[
                { value: '年假', label: '年假' },
                { value: '事假', label: '事假' },
                { value: '病假', label: '病假' },
                { value: '调休', label: '调休' },
              ]}
            />
          </Form.Item>
          <Form.Item label="请假日期" name="range" rules={[{ required: true, message: '请选择请假日期' }]}>
            <RangePicker className="w-full" />
          </Form.Item>
          <Form.Item label="请假天数" name="days" rules={[{ required: true, message: '请输入请假天数' }]}>
            <InputNumber min={0.5} step={0.5} className="w-full" />
          </Form.Item>
          <Form.Item label="原因" name="reason">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="凭证图片" name="images">
            <Upload
              listType="picture"
              beforeUpload={(file) => handleUpload(file, 'images')}
              multiple
              showUploadList={false}
            >
              <Button icon={<CloudUploadOutlined />}>上传图片</Button>
            </Upload>
            <Space wrap style={{ marginTop: 8 }}>
              {(createForm.getFieldValue('images') || []).map((img: string) => (
                <Avatar shape="square" key={img} src={img} size={64} />
              ))}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default LeavePage

