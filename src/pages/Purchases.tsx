import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
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
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CommentOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import {
  PURCHASE_STATUS_OPTIONS,
  addComment,
  approvePurchase,
  createPurchase,
  fetchApprovalFlow,
  fetchApprovalHistory,
  fetchComments,
  fetchPurchaseDetail,
  fetchPurchases,
  submitPurchase,
} from '../api/services/purchases'
import { fetchUsers } from '../api/services/users'
import type { PurchaseRecord } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

const categoryOptions = [
  '办公用品',
  '设备采购',
  '原材料',
  '车辆配件',
  '维修服务',
  '其他',
].map((item) => ({ label: item, value: item }))

const PurchasesPage = () => {
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
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs]
  }>({
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })
  const [selectedRecord, setSelectedRecord] = useState<PurchaseRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | null }>({ type: null })
  const [createForm] = Form.useForm()
  const [commentForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

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
    queryKey: ['purchases', filters, effectiveCompanyId],
    queryFn: () =>
      fetchPurchases({
        status: filters.status,
        keyword: filters.keyword,
        userId: filters.applicantId,
        beginDate: filters.dateRange ? filters.dateRange[0]?.format('YYYY-MM-DD') : undefined,
        endDate: filters.dateRange ? filters.dateRange[1]?.format('YYYY-MM-DD') : undefined,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'for-purchases', effectiveCompanyId],
    queryFn: () => fetchUsers({ size: 200, company_id: effectiveCompanyId }),
    enabled: isSuperAdmin ? !!effectiveCompanyId : true,
  })

  const detailQuery = useQuery({
    queryKey: ['purchases', 'detail', selectedRecord?.id],
    queryFn: () => fetchPurchaseDetail(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalFlowQuery = useQuery({
    queryKey: ['purchases', 'approval-flow', selectedRecord?.id],
    queryFn: () => fetchApprovalFlow(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const approvalHistoryQuery = useQuery({
    queryKey: ['purchases', 'history', selectedRecord?.id],
    queryFn: () => fetchApprovalHistory(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const commentsQuery = useQuery({
    queryKey: ['purchases', 'comments', selectedRecord?.id],
    queryFn: () => fetchComments(selectedRecord!.id),
    enabled: !!selectedRecord && detailDrawerOpen,
  })

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      message.success('采购申请创建成功')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '创建失败')
    },
  })

  const submitMutation = useMutation({
    mutationFn: submitPurchase,
    onSuccess: () => {
      message.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '提交失败')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (params: { id: number; action: 'approve' | 'reject'; comment?: string }) =>
      approvePurchase(params.id, { action: params.action, comment: params.comment }),
    onSuccess: () => {
      message.success('审批处理成功')
      setActionModal({ type: null })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['purchases', 'detail', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['purchases', 'approval-flow', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['purchases', 'history', selectedRecord?.id] })
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
      queryClient.invalidateQueries({ queryKey: ['purchases', 'comments', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '评论失败')
    },
  })

  const records = listQuery.data?.records || []

  const handleFilters = (values: any) => {
    const nextFilters = { ...filters }
    nextFilters.status = values.status
    nextFilters.keyword = values.keyword
    nextFilters.applicantId = values.applicantId
    nextFilters.dateRange = values.dateRange
    setFilters(nextFilters)
  }

  const handleReset = () => {
    setFilters({
      dateRange: [dayjs().subtract(29, 'day'), dayjs()],
    })
  }

  const openDetail = (record: PurchaseRecord) => {
    setSelectedRecord(record)
    setDetailDrawerOpen(true)
  }

  const columns: ColumnsType<PurchaseRecord> = useMemo(
    () => [
      {
        title: '编号',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '申请人',
        dataIndex: 'applicant_name',
        filters: Array.from(new Set(records.map(r => r.applicant_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({ text: name || '', value: name || '' })),
        onFilter: (value, record) => record.applicant_name === value,
        width: 140,
      },
      {
        title: '金额（元）',
        dataIndex: 'amount',
        sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
        width: 120,
        render: (value: number) => <Text strong>¥ {value?.toFixed(2)}</Text>,
      },
      {
        title: '类别',
        dataIndex: 'category',
        filters: Array.from(new Set(records.map(r => r.category).filter(Boolean)))
          .sort()
          .map(val => ({ text: val, value: val })),
        onFilter: (value, record) => record.category === value,
        width: 120,
      },
      {
        title: '供应商',
        dataIndex: 'supplier',
        filters: Array.from(new Set(records.map(r => r.supplier).filter(Boolean)))
          .sort()
          .map(val => ({ text: val as string, value: val as string })),
        onFilter: (value, record) => record.supplier === value,
        width: 150,
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
        sorter: (a, b) => (a.date || '').localeCompare(b.date || ''),
        width: 120,
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
        filters: Array.from(new Set(records.map(r => r.current_approver).filter(Boolean)))
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
        width: 200,
        fixed: 'right',
        render: (_, record) => {
          const buttons = [
            <Button key="detail" type="link" size="small" icon={<FileSearchOutlined />} onClick={() => openDetail(record)}>
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
    [submitMutation, user, records],
  )

  const handleCreate = () => {
    createForm.validateFields().then((values) => {
      createMutation.mutate({
        user_id: values.user_id,
        amount: values.amount,
        category: values.category,
        supplier: values.supplier,
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

  // 导出采购列表
  const handleExport = () => {
    if (records.length === 0) {
      message.warning('暂无数据可导出')
      return
    }

    try {
      const exportData = records.map((record) => ({
        '编号': record.id,
        '申请人': record.applicant_name || '-',
        '金额（元）': record.amount?.toFixed(2) || '-',
        '类别': record.category || '-',
        '供应商': record.supplier || '-',
        '项目/备注': record.project || record.remark || '-',
        '日期': record.date || '-',
        '最新评论': record.latest_comment || '-',
        '评论人': (record as any).comment_user || '-',
        '当前审批人': record.current_approver || '-',
        '状态': record.status === 'submitted' ? '已提交' : 
                record.status === 'reviewing' ? '审核中' : 
                record.status === 'approved' ? '已通过' : 
                record.status === 'rejected' ? '已拒绝' : record.status,
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '采购列表')
      
      const fileName = `采购列表_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            采购管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            处理公司采购申请、审批流程及记录查询。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['purchases'] })}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建采购
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看采购数据" showIcon />
      )}

      <Card>
        <Form
          layout="inline"
          initialValues={{
            status: filters.status,
            keyword: filters.keyword,
            applicantId: filters.applicantId,
            dateRange: filters.dateRange,
          }}
          onFinish={handleFilters}
          onReset={handleReset}
        >
          <Form.Item name="keyword" label="关键字">
            <Input placeholder="供应商/备注/项目" allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear placeholder="请选择状态" options={PURCHASE_STATUS_OPTIONS} style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="applicantId" label="申请人">
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
        {selectedRowKeys.length > 0 && (
          <Alert
            message={`已选择 ${selectedRowKeys.length} 条记录`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                清空选择
              </Button>
            }
          />
        )}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={records}
          loading={listQuery.isLoading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            columnWidth: 48,
            selections: [
              {
                key: 'select-all-data',
                text: '全选所有数据',
                onSelect: () => {
                  const allKeys = records.map((record) => record.id)
                  setSelectedRowKeys(allKeys)
                  message.success(`已全选 ${allKeys.length} 条数据`)
                },
              },
              {
                key: 'select-current-page',
                text: '选择当前页',
                onSelect: () => {
                  const startIndex = (currentPage - 1) * pageSize
                  const endIndex = Math.min(startIndex + pageSize, records.length)
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
                  const startIndex = (currentPage - 1) * pageSize
                  const endIndex = Math.min(startIndex + pageSize, records.length)
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
            current: currentPage,
            pageSize: pageSize,
            total: listQuery.data?.total || 0,
            showTotal: (total) => `共 ${total} 条`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Drawer
        width={720}
        title={`采购详情 #${selectedRecord?.id || ''}`}
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
                <Descriptions.Item label="金额">¥ {detailQuery.data.amount.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="类别">{detailQuery.data.category}</Descriptions.Item>
                <Descriptions.Item label="日期">{detailQuery.data.date}</Descriptions.Item>
                <Descriptions.Item label="供应商">{detailQuery.data.supplier || '-'}</Descriptions.Item>
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

      <Modal title="新建采购申请" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="user_id" label="申请人" rules={[{ required: true, message: '请选择申请人' }]}>
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
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={categoryOptions} placeholder="选择类别" />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="供应商名称" />
          </Form.Item>
          <Form.Item name="project" label="项目">
            <Input placeholder="关联项目" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="采购原因/补充说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!actionModal.type}
        title={actionModal.type === 'approve' ? '通过申请' : '拒绝申请'}
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

export default PurchasesPage
