import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
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
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CommentOutlined,
  DollarOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Line, Pie } from '@ant-design/charts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  REIMBURSEMENT_STATUS_OPTIONS,
  addComment,
  approveReimbursement,
  createReimbursement,
  fetchApprovalFlow,
  fetchApprovalHistory,
  fetchComments,
  fetchReimbursementDetail,
  fetchReimbursementStats,
  fetchReimbursements,
  submitReimbursement,
} from '../api/services/reimbursements'
import { fetchUsers } from '../api/services/users'
import type { ReimbursementRecord, ReimbursementStats } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

const categoryOptions = [
  '办公室支出',
  '加油费',
  '打车费',
  '过路费',
  '违章',
  '餐费',
  '充电费',
  '维修',
  '保养',
  '其他',
].map((item) => ({ label: item, value: item }))

const subcategoryOptions: Record<string, string[]> = {
  '维修': ['换胎', '换气管', '焊车', '补胎', '其他维修'],
  '保养': ['加柴暖', '加水', '打黄油'],
}

const ReimbursementsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [filters, setFilters] = useState<{
    status?: string
    keyword?: string
    applicantId?: number
    category?: string
    subcategory?: string
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })
  const [selectedRecord, setSelectedRecord] = useState<ReimbursementRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | null }>({ type: null })
  const [createForm] = Form.useForm()
  const [commentForm] = Form.useForm()

  const canApprove = ['财务', '总经理'].includes((user as any)?.position_type || (user as any)?.role)

  useEffect(() => {
    if (createModalOpen) {
      createForm.setFieldsValue({
        user_id: (user as any)?.id,
        date: dayjs(),
      })
    }
  }, [createModalOpen, createForm, user])

  const listQuery = useQuery({
    queryKey: ['reimbursements', filters, effectiveCompanyId],
    queryFn: () =>
      fetchReimbursements({
        status: filters.status,
        keyword: filters.keyword,
        userId: filters.applicantId,
        beginDate: filters.dateRange ? filters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: filters.dateRange ? filters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        subcategory: filters.subcategory,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const statsQuery = useQuery({
    queryKey: ['reimbursements', 'stats', filters, effectiveCompanyId],
    queryFn: () =>
      fetchReimbursementStats({
        beginDate: filters.dateRange ? filters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: filters.dateRange ? filters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        userId: filters.applicantId,
        companyId: effectiveCompanyId,
      }),
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'for-reimbursements'],
    queryFn: () => fetchUsers({ size: 200 }),
  })

  const detailQuery = useQuery({
    queryKey: ['reimbursements', 'detail', selectedRecord?.id],
    queryFn: () => fetchReimbursementDetail(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalFlowQuery = useQuery({
    queryKey: ['reimbursements', 'approval-flow', selectedRecord?.id],
    queryFn: () => fetchApprovalFlow(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalHistoryQuery = useQuery({
    queryKey: ['reimbursements', 'history', selectedRecord?.id],
    queryFn: () => fetchApprovalHistory(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const commentsQuery = useQuery({
    queryKey: ['reimbursements', 'comments', selectedRecord?.id],
    queryFn: () => fetchComments(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createReimbursement,
    onSuccess: () => {
      message.success('报销单创建成功')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'stats'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const submitMutation = useMutation({
    mutationFn: submitReimbursement,
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '提交失败')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (params: { id: number; action: 'approve' | 'reject'; comment?: string }) =>
      approveReimbursement(params.id, { action: params.action, comment: params.comment }),
    onSuccess: () => {
      message.success('审批处理成功')
      setActionModal({ type: null })
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'detail', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'approval-flow', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'history', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'stats'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '审批失败')
    },
  })

  const commentMutation = useMutation({
    mutationFn: (params: { id: number; content?: string }) => addComment(params.id, { content: params.content }),
    onSuccess: () => {
      message.success('评论成功')
      commentForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'comments', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '评论失败')
    },
  })

  const reimbursements = listQuery.data?.records || []
  const stats = statsQuery.data as ReimbursementStats | undefined

  const handleFilters = (values: any) => {
    const nextFilters = { ...filters }
    nextFilters.status = values.status
    nextFilters.keyword = values.keyword
    nextFilters.category = values.category
    nextFilters.subcategory = values.subcategory
    nextFilters.applicantId = values.applicantId
    nextFilters.dateRange = values.dateRange
    setFilters(nextFilters)
  }

  const handleReset = () => {
    setFilters({
      dateRange: [dayjs().subtract(29, 'day'), dayjs()],
    })
  }

  const openDetail = (record: ReimbursementRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const columns: ColumnsType<ReimbursementRecord> = useMemo(
    () => [
      {
        title: '编号',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '报销人',
        dataIndex: 'applicant_name',
        width: 140,
      },
      {
        title: '金额（元）',
        dataIndex: 'amount',
        width: 120,
        render: (value: number) => <Text strong>¥ {value?.toFixed(2)}</Text>,
      },
      {
        title: '类别',
        dataIndex: 'category',
        width: 160,
        render: (_: any, record) =>
          record.subcategory ? `${record.category} / ${record.subcategory}` : record.category,
      },
      {
        title: '项目/备注',
        dataIndex: 'project',
        ellipsis: true,
        render: (value, record) => value || record.remark || '-',
      },
      {
        title: '日期',
        dataIndex: 'date',
        width: 120,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (value: string) => {
          const map: Record<string, { color: string; label: string }> = {
            submitted: { color: 'default', label: '已提交' },
            reviewing: { color: 'processing', label: '审核中' },
            approved: { color: 'success', label: '已通过' },
            rejected: { color: 'error', label: '已拒绝' },
          }
          const item = map[value] || map.submitted
          return <Tag color={item.color}>{item.label}</Tag>
        },
      },
      {
        title: '操作',
        width: 220,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
            {record.status === 'submitted' && record.user_id === (user as any)?.id && (
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(record.id)}
              >
                提交审批
              </Button>
            )}
            {record.status === 'reviewing' && canApprove && (
              <>
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setActionModal({ type: 'approve' })}
                >
                  通过
                </Button>
                <Button
                  type="link"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setActionModal({ type: 'reject' })}
                >
                  拒绝
                </Button>
              </>
            )}
          </Space>
        ),
      },
    ],
    [canApprove, submitMutation, user],
  )

  const summaryCards = useMemo(() => {
    if (!stats) return []
    return [
      {
        title: '总报销金额',
        value: stats.total_amount,
        prefix: <DollarOutlined />,
        formatter: (value: number) => `¥ ${value.toFixed(2)}`,
      },
      {
        title: '报销单数量',
        value: stats.total_count,
        prefix: <FileSearchOutlined />,
      },
      {
        title: '平均金额',
        value: stats.average_amount,
        prefix: <DollarOutlined />,
        formatter: (value: number) => `¥ ${value.toFixed(2)}`,
      },
      {
        title: '待审核金额',
        value: stats.status_summary.reviewing.amount,
        prefix: <ReloadOutlined />,
        formatter: (value: number) => `¥ ${value.toFixed(2)}`,
      },
    ]
  }, [stats])

  const categoryChartData = (stats?.category_stats || []).map((item) => ({
    type: item.category,
    value: item.amount,
  }))

  const trendChartData = (stats?.daily_trend || []).map((item) => ({
    date: item.date,
    amount: item.amount,
  }))

  const handleCreate = () => {
    createForm.validateFields().then((values) => {
      createMutation.mutate({
        user_id: values.user_id,
        amount: values.amount,
        category: values.category,
        subcategory: values.subcategory,
        merchant: values.merchant,
        date: values.date.format('YYYY-MM-DD'),
        remark: values.remark,
        project: values.project,
        images: [],
      })
    })
  }

  const handleAction = (values: { comment?: string }) => {
    if (!selectedRecord || !actionModal.type) return
    approveMutation.mutate({
      id: selectedRecord.id,
      action: actionModal.type,
      comment: values.comment,
    })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            报销管理中心
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            查看报销申请、执行审批、统计分析及规则配置。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['reimbursements'] })}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建报销
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看报销数据" showIcon />
      )}

      <Tabs
        items={[
          {
            key: 'list',
            label: '报销列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {statsQuery.error && (
                  <Alert type="error" showIcon message={(statsQuery.error as Error).message || '统计数据加载失败'} />
                )}

                {statsQuery.isLoading ? null : (
                  <Row gutter={16}>
                    {summaryCards.map((card) => (
                      <Col xs={24} sm={12} md={6} key={card.title}>
                        <Card>
                          <Statistic
                            title={card.title}
                            value={card.value}
                            prefix={card.prefix}
                            valueRender={(valueNode) =>
                              typeof card.value === 'number' && card.formatter
                                ? card.formatter(card.value)
                                : valueNode
                            }
                          />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                <Card>
                  <Form
                    layout="inline"
                    initialValues={{
                      status: filters.status,
                      keyword: filters.keyword,
                      applicantId: filters.applicantId,
                      category: filters.category,
                      subcategory: filters.subcategory,
                      dateRange: filters.dateRange,
                    }}
                    onFinish={handleFilters}
                    onReset={handleReset}
                  >
                    <Form.Item name="keyword" label="关键字">
                      <Input placeholder="商户/备注/项目" allowClear style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                      <Select allowClear placeholder="请选择状态" options={REIMBURSEMENT_STATUS_OPTIONS} style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name="category" label="类别">
                      <Select allowClear placeholder="请选择类别" style={{ width: 150 }} options={categoryOptions} />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, next) => prev.category !== next.category}>
                      {({ getFieldValue }) => {
                        const category = getFieldValue('category') as string
                        const options = category ? subcategoryOptions[category] || [] : []
                        if (!['维修', '保养'].includes(category) || options.length === 0) {
                          return null
                        }
                        return (
                          <Form.Item name="subcategory" label="二级类别">
                            <Select
                              allowClear
                              placeholder="请选择二级类别"
                              style={{ width: 160 }}
                              options={options.map((item) => ({ label: item, value: item }))}
                            />
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                    <Form.Item name="applicantId" label="报销人">
                      <Select
                        allowClear
                        showSearch
                        placeholder="选择报销人"
                        options={(usersQuery.data?.items || []).map((item) => ({
                          value: item.id,
                          label: `${item.name || item.nickname || '用户'} (${item.phone || item.id})`,
                        }))}
                        style={{ width: 220 }}
                        filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
                      />
                    </Form.Item>
                    <Form.Item name="dateRange" label="日期范围">
                      <RangePicker allowEmpty style={{ width: 280 }} />
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
                </Card>

                <Card>
                  {listQuery.error && (
                    <Alert type="error" showIcon message={(listQuery.error as Error).message || '数据加载失败'} style={{ marginBottom: 16 }} />
                  )}
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={reimbursements}
                    loading={listQuery.isLoading}
                    pagination={{
                      total: listQuery.data?.total || 0,
                      pageSize: 20,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    scroll={{ x: 1200 }}
                  />
                </Card>

                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按类别统计">
                      {categoryChartData.length > 0 ? (
                        <Pie
                          data={categoryChartData}
                          angleField="value"
                          colorField="type"
                          radius={0.8}
                          innerRadius={0.5}
                          label={{ 
                            position: 'outside',
                            text: (data: any) => {
                              const item = data.data || data
                              if (!item || !item.type) return ''
                              const total = categoryChartData.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
                              const percent = total > 0 ? ((item.value / total) * 100) : 0
                              // 只显示占比大于5%的标签，避免重叠
                              if (percent < 5) return ''
                              return `${item.type}: ${percent.toFixed(0)}%`
                            },
                            style: { 
                              fontWeight: 'bold',
                              fontSize: 12,
                            },
                            connector: true,
                            autoRotate: false,
                            layout: [
                              { type: 'limit-in-plot' },
                              { type: 'adjust-color' },
                              { type: 'pie-outer' },
                              { type: 'hide-overlap' }
                            ]
                          }}
                          legend={{ 
                            position: 'bottom',
                            itemName: {
                              formatter: (text: string) => {
                                const item = categoryChartData.find((d: any) => d.type === text)
                                if (!item) return text
                                const total = categoryChartData.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
                                const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
                                return `${text} (${percent}%)`
                              }
                            }
                          }}
                        />
                      ) : (
                        <Alert type="info" message="暂无分类数据" showIcon />
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="金额趋势">
                      {trendChartData.length > 0 ? (
                        <Line 
                          data={trendChartData} 
                          xField="date" 
                          yField="amount" 
                          smooth 
                          point={{ size: 4 }}
                          xAxis={{
                            label: {
                              autoRotate: true,
                              autoHide: true,
                            }
                          }}
                          label={{
                            text: (d: any) => `¥${d.amount}`,
                            style: { fontWeight: 'bold' }
                          }}
                        />
                      ) : (
                        <Alert type="info" message="暂无趋势数据" showIcon />
                      )}
                    </Card>
                  </Col>
                </Row>
              </Space>
            ),
          },
          {
            key: 'rules',
            label: '报销规则配置',
            children: (
              <Card>
                <Paragraph>
                  可以在此配置报销类别、单笔限额、审批流程等规则。当前版本提供占位表单（保存到本地状态，可根据需求接入后端配置）。
                </Paragraph>
                <Form
                  labelCol={{ span: 4 }}
                  wrapperCol={{ span: 12 }}
                  initialValues={{ limit: 1000, needInvoice: true }}
                  onFinish={() => message.success('规则保存成功（示例）')}
                >
                  <Form.Item label="单笔金额上限" name="limit" rules={[{ required: true }]}>
                    <InputNumber min={100} max={100000} addonAfter="元" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item label="允许类别" name="allowedCategories">
                    <Select mode="multiple" options={categoryOptions} allowClear />
                  </Form.Item>
                  <Form.Item label="需要发票" name="needInvoice" valuePropName="checked">
                    <Select
                      options={[
                        { label: '需要', value: true },
                        { label: '不需要', value: false },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item wrapperCol={{ offset: 4 }}>
                    <Button type="primary" htmlType="submit">
                      保存规则
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
        ]}
      />

      <Drawer
        width={720}
        title={`报销详情 #${selectedRecord?.id || ''}`}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false)
          setSelectedRecord(null)
          setActionModal({ type: null })
        }}
      >
        {detailQuery.isLoading && <Alert type="info" message="加载中..." showIcon />}
        {detailQuery.data && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Descriptions column={2}>
                <Descriptions.Item label="报销人">{detailQuery.data.applicant_name || detailQuery.data.user_name}</Descriptions.Item>
                <Descriptions.Item label="金额">¥ {detailQuery.data.amount.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="类别">
                  {detailQuery.data.subcategory
                    ? `${detailQuery.data.category} / ${detailQuery.data.subcategory}`
                    : detailQuery.data.category}
                </Descriptions.Item>
                <Descriptions.Item label="日期">{detailQuery.data.date}</Descriptions.Item>
                <Descriptions.Item label="商户">{detailQuery.data.merchant || '-'}</Descriptions.Item>
                <Descriptions.Item label="项目">{detailQuery.data.project || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag>{detailQuery.data.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {detailQuery.data.created_at ? dayjs(detailQuery.data.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </Descriptions>
              <Divider />
              <Text strong>备注：</Text>
              <Paragraph>{detailQuery.data.remark || '无'}</Paragraph>
              {detailQuery.data.images && detailQuery.data.images.length > 0 && (
                <>
                  <Divider />
                  <Text strong>凭证：</Text>
                  <Image.PreviewGroup>
                    <Space wrap size="middle" style={{ marginTop: 12 }}>
                      {detailQuery.data.images.map((img) => (
                        <Image key={img} src={img} width={120} height={120} style={{ objectFit: 'cover' }} />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </>
              )}
            </Card>

            <Card title="审批流程">
              {approvalFlowQuery.isLoading ? (
                <Alert type="info" message="加载审批流程..." showIcon />
              ) : approvalFlowQuery.data?.approval_flow?.length ? (
                <Timeline
                  items={approvalFlowQuery.data.approval_flow.map((node) => ({
                    color:
                      node.status === 'approved'
                        ? 'green'
                        : node.status === 'rejected'
                          ? 'red'
                          : node.status === 'pending'
                            ? 'blue'
                            : 'gray',
                    children: (
                      <div>
                        <strong>{node.approver_name}</strong> · {node.role}
                        <div>{node.status_text}</div>
                        {node.comment && <div>备注：{node.comment}</div>}
                        {node.approval_time && <div>时间：{node.approval_time}</div>}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Alert type="info" message="暂无审批流程" showIcon />
              )}
            </Card>

            <Card title="审批历史">
              {approvalHistoryQuery.isLoading ? (
                <Alert type="info" message="加载中..." showIcon />
              ) : approvalHistoryQuery.data?.records?.length ? (
                <Timeline
                  items={approvalHistoryQuery.data.records.map((item) => ({
                    color: item.action === 'approve' ? 'green' : item.action === 'reject' ? 'red' : 'blue',
                    children: (
                      <div>
                        <strong>{item.approver_name}</strong> - {item.action}
                        {item.comment && <div>备注：{item.comment}</div>}
                        <div>{item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : ''}</div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Alert type="info" message="暂无历史记录" showIcon />
              )}
            </Card>

            <Card title="评论">
              {commentsQuery.data?.comments?.length ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {commentsQuery.data.comments.map((comment) => (
                    <Card key={comment.id} type="inner" title={comment.user_name} extra={comment.created_at}>
                      <Paragraph>{comment.content}</Paragraph>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Alert type="info" message="暂无评论" showIcon />
              )}
              <Divider />
              <Form form={commentForm} layout="vertical" onFinish={(values) => commentMutation.mutate({ id: selectedRecord!.id, content: values.content })}>
                <Form.Item name="content" label="添加评论">
                  <Input.TextArea rows={3} placeholder="输入评论内容" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={commentMutation.isPending} icon={<CommentOutlined />}>
                  评论
                </Button>
              </Form>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal title="新建报销" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="user_id" label="报销人" rules={[{ required: true, message: '请选择报销人' }]}>
            <Select
              showSearch
              placeholder="选择报销人"
              options={(usersQuery.data?.items || []).map((item) => ({
                value: item.id,
                label: `${item.name || item.nickname || '用户'} (${item.phone || item.id})`,
              }))}
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={categoryOptions} placeholder="选择类别" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.category !== next.category}>
            {({ getFieldValue }) => {
              const category = getFieldValue('category') as string
              const options = category ? subcategoryOptions[category] || [] : []
              if (!['维修', '保养'].includes(category) || options.length === 0) {
                return null
              }
              return (
                <Form.Item name="subcategory" label="二级类别">
                  <Select
                    allowClear
                    placeholder="选择二级类别"
                    options={options.map((item) => ({ label: item, value: item }))}
                  />
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="merchant" label="商户">
            <Input placeholder="商户名称" />
          </Form.Item>
          <Form.Item name="project" label="项目">
            <Input placeholder="关联项目" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="补充说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!actionModal.type}
        title={actionModal.type === 'approve' ? '通过报销' : '拒绝报销'}
        onCancel={() => setActionModal({ type: null })}
        onOk={() => {
          const form = document.getElementById('action-comment-form') as HTMLFormElement
          form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }}
        confirmLoading={approveMutation.isPending}
      >
        <Form id="action-comment-form" layout="vertical" onFinish={handleAction}>
          <Form.Item name="comment" label="审批意见">
            <Input.TextArea rows={3} placeholder="可选，填写审批说明" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ReimbursementsPage

