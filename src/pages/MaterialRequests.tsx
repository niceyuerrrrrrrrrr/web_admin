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
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CommentOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  MATERIAL_REQUEST_STATUS_OPTIONS,
  addMaterialComment,
  approveMaterialRequest,
  createMaterialRequest,
  fetchMaterialApprovalFlow,
  fetchMaterialApprovalHistory,
  fetchMaterialComments,
  fetchMaterialRequestDetail,
  fetchMaterialRequests,
  submitMaterialRequest,
} from '../api/services/materialRequests'
import { fetchWarehouses } from '../api/services/inventory'
import { fetchUsers } from '../api/services/users'
import type { MaterialRequestRecord } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

const MaterialRequestsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [filters, setFilters] = useState<{ status?: string; keyword?: string; userId?: number; dateRange?: [dayjs.Dayjs, dayjs.Dayjs] }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })
  const [selectedRecord, setSelectedRecord] = useState<MaterialRequestRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | null }>({ type: null })
  const [createForm] = Form.useForm()
  const [commentForm] = Form.useForm()

  const canApprove = ['财务', '总经理', '仓库管理员'].includes((user as any)?.position_type || (user as any)?.role)

  const usersQuery = useQuery({
    queryKey: ['users', 'material', effectiveCompanyId],
    queryFn: () => fetchUsers({ size: 200, company_id: effectiveCompanyId }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouses', effectiveCompanyId],
    queryFn: () => fetchWarehouses({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const listQuery = useQuery({
    queryKey: ['materials', filters, effectiveCompanyId],
    queryFn: () =>
      fetchMaterialRequests({
        status: filters.status,
        keyword: filters.keyword,
        userId: filters.userId,
        beginDate: filters.dateRange ? filters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: filters.dateRange ? filters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const detailQuery = useQuery({
    queryKey: ['materials', 'detail', selectedRecord?.id],
    queryFn: () => fetchMaterialRequestDetail(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalFlowQuery = useQuery({
    queryKey: ['materials', 'approval-flow', selectedRecord?.id],
    queryFn: () => fetchMaterialApprovalFlow(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalHistoryQuery = useQuery({
    queryKey: ['materials', 'history', selectedRecord?.id],
    queryFn: () => fetchMaterialApprovalHistory(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const commentsQuery = useQuery({
    queryKey: ['materials', 'comments', selectedRecord?.id],
    queryFn: () => fetchMaterialComments(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createMaterialRequest,
    onSuccess: () => {
      message.success('领用申请创建成功')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['materials'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const submitMutation = useMutation({
    mutationFn: submitMaterialRequest,
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['materials'] })
    },
    onError: (error) => message.error((error as Error).message || '提交失败'),
  })

  const approveMutation = useMutation({
    mutationFn: (params: { id: number; action: 'approve' | 'reject'; comment?: string }) =>
      approveMaterialRequest(params.id, { action: params.action, comment: params.comment }),
    onSuccess: () => {
      message.success('审批处理成功')
      setActionModal({ type: null })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['materials', 'detail', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['materials', 'approval-flow', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['materials', 'history', selectedRecord?.id] })
    },
    onError: (error) => message.error((error as Error).message || '审批失败'),
  })

  const commentMutation = useMutation({
    mutationFn: (params: { id: number; content?: string }) => addMaterialComment(params.id, { content: params.content }),
    onSuccess: () => {
      message.success('评论成功')
      commentForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['materials', 'comments', selectedRecord?.id] })
    },
    onError: (error) => message.error((error as Error).message || '评论失败'),
  })

  const handleFilters = (values: any) => {
    setFilters({
      status: values.status,
      keyword: values.keyword,
      userId: values.userId,
      dateRange: values.dateRange,
    })
  }

  const handleReset = () => {
    setFilters({ dateRange: [dayjs().subtract(29, 'day'), dayjs()] })
  }

  const openDetail = (record: MaterialRequestRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const listColumns: ColumnsType<MaterialRequestRecord> = useMemo(
    () => [
      { title: '编号', dataIndex: 'id', width: 80 },
      {
        title: '申请人',
        dataIndex: 'applicant_name',
        filters: Array.from(new Set((listQuery.data?.records || []).map(r => r.applicant_name).filter(Boolean)))
          .sort()
          .map(val => ({ text: val as string, value: val as string })),
        onFilter: (value, record) => record.applicant_name === value,
        width: 140,
      },
      {
        title: '物品名称',
        dataIndex: 'material_name',
        filters: Array.from(new Set((listQuery.data?.records || []).map(r => r.material_name).filter(Boolean)))
          .sort()
          .map(val => ({ text: val as string, value: val as string })),
        onFilter: (value, record) => record.material_name === value,
        width: 180,
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0),
        width: 140,
        render: (_, record) => (
          <>
            {record.quantity} {record.unit}
          </>
        ),
      },
      {
        title: '用途',
        dataIndex: 'purpose',
        filters: Array.from(new Set((listQuery.data?.records || []).map(r => r.purpose).filter(Boolean)))
          .sort()
          .map(val => ({ text: val as string, value: val as string })),
        onFilter: (value, record) => record.purpose === value,
        ellipsis: true,
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
        filters: Array.from(new Set((listQuery.data?.records || []).map(r => r.current_approver).filter(Boolean)))
          .sort()
          .map(val => ({ text: val as string, value: val as string })),
        onFilter: (value, record) => record.current_approver === value,
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        filters: [
          { text: '已提交', value: 'submitted' },
          { text: '审核中', value: 'reviewing' },
          { text: '已通过', value: 'approved' },
          { text: '已拒绝', value: 'rejected' },
        ],
        onFilter: (value, record) => record.status === value,
        width: 130,
        render: (value) => {
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
        width: 200,
        fixed: 'right',
        render: (_, record) => {
          const buttons = [
            <Button key="detail" type="link" size="small" onClick={() => openDetail(record)}>
              详情
            </Button>,
          ]
          
          if (record.status === 'submitted' && record.user_id === (user as any)?.id) {
            buttons.push(
              <Button
                key="submit"
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(record.id)}
              >
                提交审批
              </Button>
            )
          }
          
          if (record.can_approve && record.status === 'reviewing') {
            buttons.push(
              <Button
                key="approve"
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => setActionModal({ type: 'approve' })}
              >
                通过
              </Button>,
              <Button
                key="reject"
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setActionModal({ type: 'reject' })}
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
    ],
    [canApprove, submitMutation, user, listQuery.data?.records],
  )

  useEffect(() => {
    if (createModalOpen) {
      createForm.setFieldsValue({
        user_id: (user as any)?.id,
        request_date: dayjs(),
        unit: '件',
      })
    }
  }, [createModalOpen, createForm, user])

  const handleCreate = () => {
    createForm.validateFields().then((values) => {
      createMutation.mutate({
        user_id: values.user_id,
        material_name: values.material_name,
        material_code: values.material_code,
        quantity: values.quantity,
        unit: values.unit,
        purpose: values.purpose,
        request_date: values.request_date.format('YYYY-MM-DD'),
        warehouse_id: values.warehouse_id,
        images: [],
      })
    })
  }

  const handleAction = (values: { comment?: string }) => {
    if (!selectedRecord || !actionModal.type) return
    approveMutation.mutate({ id: selectedRecord.id, action: actionModal.type, comment: values.comment })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            物品领用管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理领用申请、审批流程，并与库存系统联动。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['materials'] })}>
            刷新
          </Button>
          <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建领用
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看物品领用数据" showIcon />
      )}

      <Tabs
        items={[
          {
            key: 'list',
            label: '领用列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <Form
                    layout="inline"
                    initialValues={{
                      status: filters.status,
                      keyword: filters.keyword,
                      userId: filters.userId,
                      dateRange: filters.dateRange,
                    }}
                    onFinish={handleFilters}
                    onReset={handleReset}
                  >
                    <Form.Item name="keyword" label="关键词">
                      <Input placeholder="物品/用途" allowClear style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                      <Select allowClear placeholder="选择状态" options={MATERIAL_REQUEST_STATUS_OPTIONS} style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name="userId" label="申请人">
                      <Select
                        allowClear
                        showSearch
                        placeholder="选择申请人"
                        options={(usersQuery.data?.items || [])
                          .sort((a, b) => {
                            const nameA = (a.name || a.nickname || '用户').toLowerCase()
                            const nameB = (b.name || b.nickname || '用户').toLowerCase()
                            return nameA.localeCompare(nameB, 'zh-CN')
                          })
                          .map((item) => ({
                            value: item.id,
                            label: `${item.name || item.nickname || '用户'} (${item.phone || item.id})`,
                          }))}
                        style={{ width: 220 }}
                        filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
                      />
                    </Form.Item>
                    <Form.Item name="dateRange" label="日期范围">
                      <RangePicker allowClear style={{ width: 260 }} />
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
                  <Table
                    rowKey="id"
                    columns={listColumns}
                    dataSource={listQuery.data?.records || []}
                    loading={listQuery.isLoading}
                    pagination={{
                      total: listQuery.data?.total || 0,
                      pageSize: 20,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    scroll={{ x: 1100 }}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        width={720}
        title={`领用详情 #${selectedRecord?.id || ''}`}
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
                <Descriptions.Item label="申请人">{detailQuery.data.applicant_name || detailQuery.data.user_name}</Descriptions.Item>
                <Descriptions.Item label="物品">{detailQuery.data.material_name}</Descriptions.Item>
                <Descriptions.Item label="数量">
                  {detailQuery.data.quantity} {detailQuery.data.unit}
                </Descriptions.Item>
                <Descriptions.Item label="申请日期">{detailQuery.data.request_date}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag>{detailQuery.data.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="仓库">
                  {detailQuery.data.warehouse_id
                    ? warehousesQuery.data?.records?.find((w) => w.id === detailQuery.data?.warehouse_id)?.name || '未知'
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
              <Divider />
              <Text strong>用途：</Text>
              <Paragraph>{detailQuery.data.purpose || '无'}</Paragraph>
              {detailQuery.data.images && detailQuery.data.images.length > 0 && (
                <>
                  <Divider />
                  <Text strong>附件：</Text>
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

            <Row gutter={16}>
              <Col span={12}>
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
              </Col>
              <Col span={12}>
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
                    <Alert type="info" message="暂无记录" showIcon />
                  )}
                </Card>
              </Col>
            </Row>

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

      <Modal
        title="新建领用申请"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="user_id" label="申请人" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择申请人"
              options={(usersQuery.data?.items || [])
                .sort((a, b) => {
                  const nameA = (a.name || a.nickname || '用户').toLowerCase()
                  const nameB = (b.name || b.nickname || '用户').toLowerCase()
                  return nameA.localeCompare(nameB, 'zh-CN')
                })
                .map((item) => ({
                  value: item.id,
                  label: `${item.name || item.nickname || '用户'} (${item.phone || item.id})`,
                }))}
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="material_name" label="物品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="material_code" label="物品编码">
            <Input />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true }]} initialValue="件">
            <Input />
          </Form.Item>
          <Form.Item name="warehouse_id" label="目标仓库">
            <Select allowClear placeholder="选择仓库" options={(warehousesQuery.data?.records || []).map((w) => ({ value: w.id, label: w.name }))} />
          </Form.Item>
          <Form.Item name="request_date" label="申请日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purpose" label="用途">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionModal.type === 'approve' ? '通过领用申请' : '拒绝领用申请'}
        open={!!actionModal.type}
        onCancel={() => setActionModal({ type: null })}
        onOk={() => {
          const form = document.getElementById('material-action-form') as HTMLFormElement
          form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }}
        confirmLoading={approveMutation.isPending}
      >
        <Form id="material-action-form" layout="vertical" onFinish={handleAction}>
          <Form.Item name="comment" label="审批意见">
            <Input.TextArea rows={3} placeholder="可填写审批说明" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default MaterialRequestsPage

