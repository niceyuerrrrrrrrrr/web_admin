import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Switch,
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
  DownloadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Line, Pie } from '@ant-design/charts'
import * as XLSX from 'xlsx'
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
  updateReimbursement,
  submitReimbursement,
  payReimbursement,
} from '../api/services/reimbursements'
import { fetchUsers } from '../api/services/users'
import { fetchFinAccounts } from '../api/services/finBase'
import type { ReimbursementRecord, ReimbursementStats } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ResizableHeaderCell from '../components/ResizableHeaderCell'
import { fixImageUrl } from '../utils/imageUrl'
import client from '../api/client'

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

  const isSuperAdmin = user?.role === 'super_admin'
  const isFinance = user?.positionType === '财务' || isSuperAdmin
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
    status: 'approved', // 默认只统计已通过的报销
    dateRange: [dayjs().subtract(29, 'day'), dayjs()],
  })
  const [selectedRecord, setSelectedRecord] = useState<ReimbursementRecord | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [pettySettleModalOpen, setPettySettleModalOpen] = useState(false)
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | null }>({ type: null })
  const [createForm] = Form.useForm()
  const [payForm] = Form.useForm()
  const [pettySettleForm] = Form.useForm()
  const [commentForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 列宽状态管理
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const handleResize = useCallback((key: string) => (_e: any, { size }: any) => {
    setColumnWidths(prev => ({ ...prev, [key]: size.width }))
  }, [])

  // 为列添加可调整大小的功能
  const addResizableToColumns = useCallback(<T,>(columns: ColumnsType<T>): ColumnsType<T> => {
    return columns.map((col: any) => {
      if (!col.width || col.fixed === 'right') return col
      const key = col.key || (typeof col.dataIndex === 'string' ? col.dataIndex : String(col.title || 'unknown'))
      return {
        ...col,
        width: columnWidths[key] || col.width,
        onHeaderCell: () => ({
          width: columnWidths[key] || col.width,
          onResize: handleResize(key),
        }),
      }
    }) as ColumnsType<T>
  }, [columnWidths, handleResize])

  const userPosition = (user as any)?.positionType || (user as any)?.position_type
  const canApprove = ['财务', '总经理'].includes(userPosition) || ['财务', '总经理'].includes((user as any)?.role)

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
        status: filters.status, // 添加状态筛选
        companyId: effectiveCompanyId,
      }),
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'all', effectiveCompanyId],
    queryFn: () => fetchUsers({ page: 1, size: 1000, company_id: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const accountsQuery = useQuery({
    queryKey: ['fin-accounts', effectiveCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: effectiveCompanyId, activeOnly: true }),
    enabled: isFinance,
  })

  // 获取备用金发放列表
  const grantsQuery = useQuery({
    queryKey: ['fin', 'petty-grants', 'available', effectiveCompanyId],
    queryFn: async () => {
      const params: any = {
        page: 1,
        page_size: 200,
        status: 'approved', // 只获取已审批的发放单
      }
      if (effectiveCompanyId) params.company_id = effectiveCompanyId

      const response = await client.get('/fin/petty-grants', { params })
      if (!response.data.success) {
        throw new Error(response.data.message || '获取失败')
      }
      return response.data.data
    },
    enabled: isFinance && pettySettleModalOpen,
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

  const updatePublicAccountMutation = useMutation({
    mutationFn: (params: { id: number; is_public_account: 'Y' | 'N' }) =>
      updateReimbursement(params.id, { is_public_account: params.is_public_account }),
    onSuccess: () => {
      message.success('更新成功')
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'detail', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  const payMutation = useMutation({
    mutationFn: (params: { id: number; account_id: number; pay_method?: string; cash_date?: string; remark?: string }) =>
      payReimbursement(params.id, {
        account_id: params.account_id,
        pay_method: params.pay_method,
        cash_date: params.cash_date,
        remark: params.remark,
      }),
    onSuccess: (data) => {
      message.success(data.message || '支付成功')
      payForm.resetFields()
      setPayModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'detail', selectedRecord?.id] })
    },
    onError: (error) => {
      message.error((error as Error).message || '支付失败')
    },
  })

  const pettySettleMutation = useMutation({
    mutationFn: async (params: { person_name: string; amount: number; settle_date: string; remark?: string; reimbursement_id: number; grant_id: number }) => {
      const createParams: any = {}
      if (effectiveCompanyId) createParams.company_id = effectiveCompanyId
      
      const response = await client.post('/fin/petty-settles', {
        person_type: 'employee',
        person_name: params.person_name,
        settle_amount_cents: Math.round(params.amount * 100),
        settle_date: params.settle_date,
        remark: params.remark || `报销单 #${params.reimbursement_id} 备用金核销`,
        reimbursement_id: params.reimbursement_id,
        grant_id: params.grant_id,
      }, { params: createParams })
      
      if (!response.data.success) {
        throw new Error(response.data.message || '创建备用金核销单失败')
      }
      return response.data.data
    },
    onSuccess: () => {
      message.success('备用金核销单已创建')
      pettySettleForm.resetFields()
      setPettySettleModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['reimbursements', 'detail', selectedRecord?.id] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-settles'] })
      queryClient.invalidateQueries({ queryKey: ['fin', 'petty-grants'] })
    },
    onError: (error: any) => {
      message.error(error.message || '创建备用金核销单失败')
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
        sorter: (a, b) => a.id - b.id,
      },
      {
        title: '报销人',
        dataIndex: 'applicant_name',
        width: 140,
        filters: Array.from(new Set(reimbursements.map(r => r.applicant_name).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({ text: name || '', value: name || '' })),
        onFilter: (value, record) => record.applicant_name === value,
      },
      {
        title: '金额（元）',
        dataIndex: 'amount',
        width: 120,
        sorter: (a, b) => a.amount - b.amount,
        render: (value: number) => <Text strong>¥ {value?.toFixed(2)}</Text>,
      },
      {
        title: '类别',
        dataIndex: 'category',
        width: 160,
        filters: Array.from(new Set(reimbursements.map(r => r.category).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(cat => ({ text: cat || '', value: cat || '' })),
        onFilter: (value, record) => record.category === value,
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
        sorter: (a, b) => (a.date || '').localeCompare(b.date || ''),
      },
      {
        title: '公户报销',
        dataIndex: 'is_public_account',
        width: 110,
        filters: [
          { text: '是', value: 'Y' },
          { text: '否', value: 'N' },
        ],
        onFilter: (value: any, record) => (record.is_public_account || 'N') === value,
        render: (_: any, record) => {
          const checked = (record.is_public_account || 'N') === 'Y'
          const canToggle = isSuperAdmin || canApprove
          if (!canToggle) {
            return checked ? <Tag color="success">是</Tag> : <Tag>否</Tag>
          }
          const loading = updatePublicAccountMutation.isPending && updatePublicAccountMutation.variables?.id === record.id
          return (
            <Switch
              checked={checked}
              disabled={!canToggle}
              loading={loading}
              onChange={(v) => {
                updatePublicAccountMutation.mutate({
                  id: record.id,
                  is_public_account: v ? 'Y' : 'N',
                })
              }}
            />
          )
        },
      },
      {
        title: '凭证',
        dataIndex: 'images',
        width: 180,
        render: (value: string[], record: ReimbursementRecord) => {
          const images = value || []
          const videos = record.video_urls || []
          const totalCount = images.length + videos.length
          
          if (totalCount === 0) return '-'
          
          // 最多显示2个缩略图
          const allMedia = [...images, ...videos]
          const shown = allMedia.slice(0, 2)
          const rest = totalCount - shown.length
          
          return (
            <Space size={6} wrap>
              {shown.map((url, idx) => {
                const isVideo = videos.includes(url)
                const fixedUrl = fixImageUrl(url) || ''
                
                if (isVideo) {
                  // 视频缩略图：显示视频的第一帧
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        position: 'relative',
                        width: 40, 
                        height: 40, 
                        borderRadius: 6,
                        overflow: 'hidden',
                        backgroundColor: '#000'
                      }}
                    >
                      <video 
                        src={fixedUrl} 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        fontSize: 16,
                        color: '#fff'
                      }}>
                        ▶
                      </div>
                    </div>
                  )
                } else {
                  // 图片缩略图
                  return (
                    <Image
                      key={idx}
                      src={fixedUrl}
                      width={40}
                      height={40}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                      preview={{
                        src: fixedUrl
                      }}
                    />
                  )
                }
              })}
              {rest > 0 && <Text type="secondary">+{rest}</Text>}
            </Space>
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
                    src={fixImageUrl(img) || ''}
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
        width: 120,
        filters: Array.from(new Set(reimbursements.map(r => r.current_approver).filter(Boolean)))
          .sort((a, b) => (a || '').localeCompare(b || '', 'zh-CN'))
          .map(name => ({ text: name || '', value: name || '' })),
        onFilter: (value, record) => record.current_approver === value,
        render: (value: string) => value || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        filters: [
          { text: '已提交', value: 'submitted' },
          { text: '审核中', value: 'reviewing' },
          { text: '已通过', value: 'approved' },
          { text: '已拒绝', value: 'rejected' },
        ],
        onFilter: (value, record) => record.status === value,
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
        title: '支付状态',
        dataIndex: 'pay_status',
        width: 110,
        filters: [
          { text: '未支付', value: 'unpaid' },
          { text: '已支付', value: 'paid' },
        ],
        onFilter: (value, record) => (record.pay_status || 'unpaid') === value,
        render: (value: string, record) => {
          if (record.status !== 'approved') return '-'
          const isPaid = value === 'paid'
          return (
            <Tag color={isPaid ? 'success' : 'warning'} icon={isPaid ? <CheckCircleOutlined /> : <DollarOutlined />}>
              {isPaid ? '已支付' : '未支付'}
            </Tag>
          )
        },
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right',
        render: (_, record) => {
          const buttons = [
            <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
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
          
          // 财务支付按钮 - 根据是否公户报销显示不同按钮
          if (isFinance && record.status === 'approved' && (record.pay_status || 'unpaid') === 'unpaid') {
            const isPublicAccount = (record.is_public_account || 'N') === 'Y'
            
            if (isPublicAccount) {
              // 公户报销 - 发起付款单
              buttons.push(
                <Button
                  key="pay"
                  type="link"
                  size="small"
                  icon={<DollarOutlined />}
                  onClick={() => {
                    setSelectedRecord(record)
                    setPayModalOpen(true)
                    payForm.setFieldsValue({
                      cash_date: dayjs(),
                      pay_method: 'bank_transfer',
                    })
                  }}
                >
                  支付
                </Button>
              )
            } else {
              // 备用金报销 - 发起备用金核销
              buttons.push(
                <Button
                  key="petty-settle"
                  type="link"
                  size="small"
                  icon={<DollarOutlined />}
                  onClick={() => {
                    setSelectedRecord(record)
                    setPettySettleModalOpen(true)
                    pettySettleForm.setFieldsValue({
                      person_name: record.applicant_name,
                      amount: record.amount,
                      settle_date: dayjs(),
                      remark: `报销单 #${record.id} 备用金核销`,
                    })
                  }}
                >
                  备用金核销
                </Button>
              )
            }
          }
          
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', justifyItems: 'start' }}>
              {buttons}
            </div>
          )
        },
      },
    ],
    [canApprove, isSuperAdmin, submitMutation, updatePublicAccountMutation, user, reimbursements],
  )

  const columnsResizable = useMemo(
    () => addResizableToColumns(columns),
    [columns, addResizableToColumns]
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

  // 导出报销列表
  const handleExport = () => {
    if (reimbursements.length === 0) {
      message.warning('暂无数据可导出')
      return
    }

    try {
      const exportData = reimbursements.map((record) => ({
        '编号': record.id,
        '报销人': record.applicant_name || '-',
        '金额（元）': record.amount?.toFixed(2) || '-',
        '类别': record.subcategory ? `${record.category} / ${record.subcategory}` : record.category,
        '项目/备注': record.project || record.remark || '-',
        '日期': record.date || '-',
        '公户报销': (record.is_public_account || 'N') === 'Y' ? '是' : '否',
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
      XLSX.utils.book_append_sheet(wb, ws, '报销列表')
      
      const fileName = `报销列表_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
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
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
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
                    className="resizable-table"
                    components={{
                      header: {
                        cell: ResizableHeaderCell,
                      },
                    }}
                    rowKey="id"
                    columns={columnsResizable}
                    dataSource={reimbursements}
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
                            const allKeys = reimbursements.map((record) => record.id)
                            setSelectedRowKeys(allKeys)
                            message.success(`已全选 ${allKeys.length} 条数据`)
                          },
                        },
                        {
                          key: 'select-current-page',
                          text: '选择当前页',
                          onSelect: () => {
                            const startIndex = (currentPage - 1) * pageSize
                            const endIndex = Math.min(startIndex + pageSize, reimbursements.length)
                            const pageKeys = reimbursements
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
                            const endIndex = Math.min(startIndex + pageSize, reimbursements.length)
                            const pageData = reimbursements.slice(startIndex, endIndex)
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
                        <Image key={img} src={fixImageUrl(img) || ''} width={120} height={120} style={{ objectFit: 'cover' }} />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </>
              )}

              {(() => {
                console.log('[Reimbursements] video_urls:', detailQuery.data.video_urls);
                console.log('[Reimbursements] video_urls type:', typeof detailQuery.data.video_urls);
                console.log('[Reimbursements] video_urls length:', detailQuery.data.video_urls?.length);
                
                if (!detailQuery.data.video_urls || detailQuery.data.video_urls.length === 0) {
                  return null;
                }
                
                return (
                  <>
                    <Divider />
                    <Text strong style={{ color: '#1890ff' }}>视频凭证 ({detailQuery.data.video_urls.length})：</Text>
                    <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
                      {detailQuery.data.video_urls
                        .map((u) => fixImageUrl(u) || '')
                        .filter(Boolean)
                        .map((src, idx) => {
                          console.log('[Reimbursements] Rendering video:', src);
                          return (
                            <div key={idx} style={{ width: '100%', border: '2px solid #1890ff', padding: 8, borderRadius: 8 }}>
                              <video 
                                src={src} 
                                controls 
                                preload="metadata"
                                style={{ 
                                  width: '100%', 
                                  maxHeight: 400,
                                  borderRadius: 8,
                                  backgroundColor: '#000'
                                }} 
                              />
                              <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>视频 {idx + 1}: {src}</div>
                            </div>
                          );
                        })}
                    </Space>
                  </>
                );
              })()}
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

      {/* 支付弹窗 */}
      <Modal
        title="报销支付"
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false)
          payForm.resetFields()
        }}
        onOk={() => payForm.submit()}
        confirmLoading={payMutation.isPending}
        width={500}
      >
        <Form
          form={payForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedRecord) return
            payMutation.mutate({
              id: selectedRecord.id,
              account_id: values.account_id,
              pay_method: values.pay_method,
              cash_date: values.cash_date?.format('YYYY-MM-DD'),
              remark: values.remark,
            })
          }}
        >
          <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="报销单号">{selectedRecord?.id}</Descriptions.Item>
            <Descriptions.Item label="报销人">{selectedRecord?.applicant_name}</Descriptions.Item>
            <Descriptions.Item label="金额">
              <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                ¥ {selectedRecord?.amount?.toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Form.Item
            name="account_id"
            label="支付账户"
            rules={[{ required: true, message: '请选择支付账户' }]}
          >
            <Select
              placeholder="请选择支付账户"
              loading={accountsQuery.isLoading}
              options={(accountsQuery.data?.records || []).map((account) => ({
                label: `${account.name} (余额: ¥${((account.balance_cents || 0) / 100).toFixed(2)})`,
                value: account.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="pay_method"
            label="支付方式"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Select
              placeholder="请选择支付方式"
              options={[
                { label: '银行转账', value: 'bank_transfer' },
                { label: '现金', value: 'cash' },
                { label: '支付宝', value: 'alipay' },
                { label: '微信', value: 'wechat' },
                { label: '其他', value: 'other' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="cash_date"
            label="支付日期"
            rules={[{ required: true, message: '请选择支付日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 备用金核销弹窗 */}
      <Modal
        title="备用金核销"
        open={pettySettleModalOpen}
        onCancel={() => {
          setPettySettleModalOpen(false)
          pettySettleForm.resetFields()
        }}
        onOk={() => pettySettleForm.submit()}
        confirmLoading={pettySettleMutation.isPending}
        width={500}
      >
        <Form
          form={pettySettleForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedRecord) return
            pettySettleMutation.mutate({
              person_name: values.person_name,
              amount: values.amount,
              settle_date: values.settle_date?.format('YYYY-MM-DD'),
              remark: values.remark,
              reimbursement_id: selectedRecord.id,
              grant_id: values.grant_id,
            })
          }}
        >
          <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="报销单号">{selectedRecord?.id}</Descriptions.Item>
            <Descriptions.Item label="报销人">{selectedRecord?.applicant_name}</Descriptions.Item>
            <Descriptions.Item label="金额">
              <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                ¥ {selectedRecord?.amount?.toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Alert
            type="info"
            message="备用金核销说明"
            description="此报销单使用备用金支付，将创建备用金核销单进行处理。核销单创建后需要提交审批。"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="grant_id"
            label="关联备用金发放单"
            rules={[{ required: true, message: '请选择备用金发放单' }]}
          >
            <Select
              placeholder="请选择备用金发放单"
              loading={grantsQuery.isLoading}
              onChange={(value) => {
                const grants = grantsQuery.data?.records || []
                const grant = grants.find((g: any) => g.id === value)
                if (grant) {
                  pettySettleForm.setFieldsValue({
                    person_name: grant.person_name,
                    amount: ((grant.remaining_amount_cents || 0) / 100),
                  })
                }
              }}
            >
              {(grantsQuery.data?.records || []).map((grant: any) => (
                <Select.Option key={grant.id} value={grant.id}>
                  {grant.code} - {grant.person_name} (余额: ¥{((grant.remaining_amount_cents || 0) / 100).toFixed(2)})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="person_name"
            label="核销人"
            rules={[{ required: true, message: '请输入核销人姓名' }]}
          >
            <Input placeholder="请输入核销人姓名" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="核销金额（元）"
            rules={[{ required: true, message: '请输入核销金额' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
            />
          </Form.Item>

          <Form.Item
            name="settle_date"
            label="核销日期"
            rules={[{ required: true, message: '请选择核销日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ReimbursementsPage
