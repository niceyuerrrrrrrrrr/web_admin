import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Segmented,
} from 'antd'
import { UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons'
import ApprovalAnalytics from './ApprovalAnalytics'
import useCompanyStore from '../store/company'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  APPROVAL_TYPES,
  batchDeleteApprovals,
  fetchApprovalDetail,
  fetchApprovalHistory,
  fetchApprovalStats,
  fetchApprovalTimeline,
  fetchManagerStats,
  fetchPendingApprovals,
  fetchTrendStats,
  submitApprovalAction,
  type ApprovalCoreFields,
  type ApprovalDetailResponse,
  type ApprovalHistoryResponse,
  type ApprovalManagerStats,
  type ApprovalPendingResponse,
  type ApprovalStats,
  type ApprovalTimelineResponse,
  type ApprovalTrendStats,
  type BatchDeletePayload,
  type ManagerStatusStat,
  type ManagerTypeStat,
} from '../api/services/approval'

const { Title, Paragraph, Text } = Typography
const { RangePicker } = DatePicker

type ActionType = 'approve' | 'reject'

type HistoryFilters = {
  approvalType?: string
  status?: string
  beginDate?: string
  endDate?: string
}

const statusColorMap: Record<string, { label: string; color: string }> = {
  reviewing: { label: '审核中', color: 'blue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  submitted: { label: '已提交', color: 'default' },
  processing: { label: '处理中', color: 'gold' },
  resolved: { label: '已解决', color: 'cyan' },
  closed: { label: '已关闭', color: 'default' },
  revoked: { label: '已撤销', color: 'default' },
}

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]

const detailFieldPresets: Record<string, { key: string; label: string }[]> = {
  reimbursement: [
    { key: 'category', label: '费用类别' },
    { key: 'amount', label: '报销金额' },
    { key: 'user_name', label: '申请人' },
    { key: 'date', label: '报销日期' },
    { key: 'status', label: '状态' },
    { key: 'remark', label: '备注' },
  ],
  purchase: [
    { key: 'category', label: '采购类型' },
    { key: 'amount', label: '采购金额' },
    { key: 'supplier', label: '供应商' },
    { key: 'date', label: '申请日期' },
    { key: 'status', label: '状态' },
  ],
  leave: [
    { key: 'leave_type', label: '请假类型' },
    { key: 'days', label: '天数' },
    { key: 'start_date', label: '开始时间' },
    { key: 'end_date', label: '结束时间' },
    { key: 'reason', label: '请假原因' },
  ],
  material: [
    { key: 'material_name', label: '物品名称' },
    { key: 'quantity', label: '数量' },
    { key: 'request_date', label: '申请时间' },
    { key: 'purpose', label: '用途' },
  ],
  report: [
    { key: 'title', label: '故障标题' },
    { key: 'severity', label: '严重程度' },
    { key: 'submit_time', label: '上报时间' },
    { key: 'status', label: '状态' },
    { key: 'description', label: '详情' },
  ],
}

const getApprovalTypeLabel = (value?: string) =>
  APPROVAL_TYPES.find((item) => item.value === value)?.label

const ApprovalsPage = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()
  const [pendingForm] = Form.useForm()
  const [historyForm] = Form.useForm()
  const [actionForm] = Form.useForm()
  const [managerForm] = Form.useForm()

  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list')
  const { selectedCompanyId } = useCompanyStore() // 从全局状态读取
  const [pendingFilters, setPendingFilters] = useState<{ approvalType?: string }>({})
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    status: 'all',
  })
  const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 10 })
  const [selectedPendingKeys, setSelectedPendingKeys] = useState<React.Key[]>([])
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState<React.Key[]>([])
  const [activeTab, setActiveTab] = useState('pending')

  const [detailContext, setDetailContext] = useState<{ approvalType: string; id: number } | null>(
    null,
  )
  const [actionState, setActionState] = useState<{
    record?: ApprovalCoreFields
    action?: ActionType
  }>({})

  const [managerFilters, setManagerFilters] = useState<{
    approvalType: string
    beginDate: string
    endDate: string
    groupBy: 'day' | 'week' | 'month'
  }>({
    approvalType: 'all',
    beginDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    groupBy: 'day',
  })

  const [selectedTypeForDrill, setSelectedTypeForDrill] = useState<string | null>(null)

  useEffect(() => {
    managerForm.setFieldsValue({
      approvalType: managerFilters.approvalType,
      dateRange: [dayjs(managerFilters.beginDate), dayjs(managerFilters.endDate)],
      groupBy: managerFilters.groupBy,
    })
  }, [managerFilters, managerForm])

  const statsQuery = useQuery<ApprovalStats>({
    queryKey: ['approval', 'stats'],
    queryFn: fetchApprovalStats,
  })

  const pendingQuery = useQuery<ApprovalPendingResponse>({
    queryKey: ['approval', 'pending', pendingFilters, selectedCompanyId],
    queryFn: () =>
      fetchPendingApprovals({
        approvalType: pendingFilters.approvalType,
        companyId: selectedCompanyId ?? undefined,
      }),
  })

  const historyQuery = useQuery<ApprovalHistoryResponse>({
    queryKey: ['approval', 'history', historyFilters, historyPagination, selectedCompanyId],
    queryFn: () =>
      fetchApprovalHistory({
        approvalType: historyFilters.approvalType,
        status: historyFilters.status,
        beginDate: historyFilters.beginDate,
        endDate: historyFilters.endDate,
        companyId: selectedCompanyId ?? undefined,
        page: historyPagination.current,
        pageSize: historyPagination.pageSize,
      }),
  })

  const detailQuery = useQuery<ApprovalDetailResponse>({
    queryKey: ['approval', 'detail', detailContext?.approvalType, detailContext?.id],
    queryFn: () =>
      fetchApprovalDetail(detailContext!.approvalType, detailContext!.id),
    enabled: !!detailContext,
  })

  const timelineQuery = useQuery<ApprovalTimelineResponse>({
    queryKey: ['approval', 'timeline', detailContext?.approvalType, detailContext?.id],
    queryFn: () => fetchApprovalTimeline(detailContext!.approvalType, detailContext!.id),
    enabled: !!detailContext,
  })

  const managerQuery = useQuery<ApprovalManagerStats>({
    queryKey: ['approval', 'manager', managerFilters],
    queryFn: () =>
      fetchManagerStats({
        approvalType: managerFilters.approvalType !== 'all' ? managerFilters.approvalType : undefined,
        beginDate: managerFilters.beginDate,
        endDate: managerFilters.endDate,
      }),
  })

  const trendQuery = useQuery<ApprovalTrendStats>({
    queryKey: ['approval', 'trend', managerFilters],
    queryFn: () =>
      fetchTrendStats({
        approvalType: managerFilters.approvalType !== 'all' ? managerFilters.approvalType : undefined,
        beginDate: managerFilters.beginDate,
        endDate: managerFilters.endDate,
        groupBy: managerFilters.groupBy,
      }),
  })

  const approvalMutation = useMutation({
    mutationFn: ({ record, action, comment }: { record: ApprovalCoreFields; action: ActionType; comment?: string }) =>
      submitApprovalAction(record.approval_type, record.id, { action, comment }),
    onSuccess: (_, variables) => {
      message.success(variables.action === 'approve' ? '审批通过' : '已驳回')
      queryClient.invalidateQueries({ queryKey: ['approval', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'history'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'timeline'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'manager'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'trend'] })
      setActionState({})
      actionForm.resetFields()
    },
    onError: (error) => {
      message.error((error as Error).message || '操作失败')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (payload: BatchDeletePayload) => batchDeleteApprovals(payload),
    onSuccess: () => {
      message.success('批量删除成功')
      queryClient.invalidateQueries({ queryKey: ['approval', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['approval', 'history'] })
      setSelectedPendingKeys([])
      setSelectedHistoryKeys([])
    },
    onError: (error) => {
      message.error((error as Error).message || '批量删除失败')
    },
  })

  const openDetail = useCallback((record: ApprovalCoreFields) => {
    setDetailContext({ approvalType: record.approval_type, id: record.id })
  }, [])

  const openActionModal = useCallback((record: ApprovalCoreFields, action: ActionType) => {
    setActionState({ record, action })
    actionForm.resetFields()
  }, [actionForm])

  const handleSingleDelete = useCallback((record: ApprovalCoreFields) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除这条${record.type_name}审批记录吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const items = [{ approval_type: record.approval_type, id: record.id }]
        batchDeleteMutation.mutate({ items })
      },
    })
  }, [modal, batchDeleteMutation])

  const formatMetricValue = (record: ManagerTypeStat) => {
    if (record.metric_total == null) return '-'
    if (!record.metric_field) return record.metric_total.toFixed(2)
    const field = record.metric_field.toLowerCase()
    if (field.includes('amount') || field.includes('price')) {
      return `${record.metric_total.toFixed(2)} 元`
    }
    if (field.includes('day')) {
      return `${record.metric_total} 天`
    }
    if (field.includes('quantity') || field.includes('weight') || field.includes('count')) {
      return `${record.metric_total}`
    }
    return record.metric_total.toFixed(2)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const managerColumns: ColumnsType<ManagerTypeStat> = [
    {
      title: '审批类型',
      dataIndex: 'type_name',
      key: 'type_name',
      width: 160,
    },
    {
      title: '总数',
      dataIndex: 'total',
      key: 'total',
      width: 100,
    },
    {
      title: '状态统计',
      key: 'status',
      render: (_, record) => (
        <Space wrap size={4}>
          {record.status.map((item) => {
            const meta = statusColorMap[item.status] || { color: 'default', label: item.text }
            return (
              <Tag key={`${record.key}-${item.status}`} color={meta.color}>
                {item.text} {item.count}
              </Tag>
            )
          })}
        </Space>
      ),
    },
    {
      title: '金额/数量',
      key: 'metric_total',
      width: 160,
      render: (_, record) => formatMetricValue(record),
    },
  ]

  const statCards = useMemo(() => {
    if (!statsQuery.data) return []
    const { stats, total_pending } = statsQuery.data
    const cards = [
      {
        title: '待审批总数',
        value: total_pending,
      },
    ]
    Object.values(stats || {}).forEach((item) => {
      cards.push({
        title: item.type_name,
        value: item.pending_count,
      })
    })
    return cards
  }, [statsQuery.data])

  const timelineItems = useMemo(() => {
    if (!timelineQuery.data?.nodes) return []
    return timelineQuery.data.nodes.map((node) => {
      const meta = node.status ? statusColorMap[node.status] : undefined
      const color =
        node.status === 'approved'
          ? 'green'
          : node.status === 'rejected'
            ? 'red'
            : 'blue'
      return {
        color,
        children: (
          <div>
            <Space size="small">
              <Text strong>{node.node_name}</Text>
              <Tag color={meta?.color || 'default'}>
                {meta?.label || node.status || '待审批'}
              </Tag>
            </Space>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              审批人：{node.approver_name || node.approver_role || '未指定'}
            </Paragraph>
            {node.comment && (
              <Paragraph style={{ marginBottom: 4 }}>{node.comment}</Paragraph>
            )}
            <Text type="secondary">
              {node.approved_at
                ? dayjs(node.approved_at).format('YYYY-MM-DD HH:mm')
                : '等待审批'}
            </Text>
          </div>
        ),
      }
    })
  }, [timelineQuery.data])

  const managerChartData = useMemo(
    () => managerQuery.data?.overall.status ?? [],
    [managerQuery.data],
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const managerChartConfig = useMemo(
    () => ({
      data: managerChartData,
      xField: 'text',
      yField: 'count',
      columnWidthRatio: 0.5,
      colorField: 'status',
      color: (datum: ManagerStatusStat) =>
        statusColorMap[datum.status]?.color || '#1677ff',
    }),
    [managerChartData],
  )

  // 趋势图表数据处理
  const trendLineData = useMemo(() => {
    if (!trendQuery.data?.trend) return []
    const trend = trendQuery.data.trend
    const statusSet = new Set<string>()
    trend.forEach((point) => {
      Object.keys(point.statuses).forEach((status) => statusSet.add(status))
    })

    const result: Array<{ date: string; status: string; count: number; type?: string }> = []
    trend.forEach((point) => {
      statusSet.forEach((status) => {
        result.push({
          date: point.date,
          status,
          count: point.statuses[status] || 0,
          type: point.type,
        })
      })
    })
    return result
  }, [trendQuery.data])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trendLineConfig = useMemo(
    () => ({
      data: trendLineData,
      xField: 'date',
      yField: 'count',
      seriesField: 'status',
      point: {
        size: 4,
        shape: 'circle',
      },
      label: {
        style: {
          fill: '#aaa',
        },
      },
      color: (datum: { status: string }) =>
        statusColorMap[datum.status]?.color || '#1677ff',
      legend: {
        position: 'top' as const,
      },
      smooth: true,
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
    }),
    [trendLineData],
  )

  // 按类型拆分的饼图数据
  const typePieData = useMemo(() => {
    if (!managerQuery.data?.types) return []
    return managerQuery.data.types.map((type) => ({
      type: type.type_name,
      name: type.type_name,
      value: type.total,
      key: type.key,
    }))
  }, [managerQuery.data])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const typePieConfig = useMemo(
    () => ({
      data: typePieData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      label: {
        formatter: (data: any) => {
          if (!data) return ''
          const name = data.name || data.type || ''
          const value = data.value || 0
          return `${name}: ${value}条`
        },
      },
      interactions: [{ type: 'element-active' }],
      onReady: (plot: any) => {
        plot.on('element:click', (evt: any) => {
          const data = evt.data?.data
          if (data?.key) {
            setSelectedTypeForDrill(data.key)
            setManagerFilters((prev) => ({ ...prev, approvalType: data.key }))
          }
        })
      },
    }),
    [typePieData],
  )

  // 按类型拆分的趋势图表
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const typeTrendCharts = useMemo(() => {
    if (!trendQuery.data?.trend || selectedTypeForDrill) return []
    const trend = trendQuery.data.trend
    const typeGroups: Record<string, typeof trend> = {}
    trend.forEach((point) => {
      if (!typeGroups[point.type]) {
        typeGroups[point.type] = []
      }
      typeGroups[point.type].push(point)
    })

    return Object.entries(typeGroups).map(([type, points]) => {
      const statusSet = new Set<string>()
      points.forEach((point) => {
        Object.keys(point.statuses).forEach((status) => statusSet.add(status))
      })

      const lineData: Array<{ date: string; status: string; count: number }> = []
      points.forEach((point) => {
        statusSet.forEach((status) => {
          lineData.push({
            date: point.date,
            status,
            count: point.statuses[status] || 0,
          })
        })
      })

      return {
        type,
        typeName: points[0]?.type_name || type,
        config: {
          data: lineData,
          xField: 'date',
          yField: 'count',
          seriesField: 'status',
          point: { size: 3 },
          smooth: true,
          color: (datum: { status: string }) =>
            statusColorMap[datum.status]?.color || '#1677ff',
          legend: { position: 'top' as const },
        },
      }
    })
  }, [trendQuery.data, selectedTypeForDrill])

  // 选中类型的详细趋势
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedTypeTrend = useMemo(() => {
    if (!selectedTypeForDrill || !trendQuery.data?.trend) return null
    const trend = trendQuery.data.trend.filter((point) => point.type === selectedTypeForDrill)
    if (!trend.length) return null

    const statusSet = new Set<string>()
    trend.forEach((point) => {
      Object.keys(point.statuses).forEach((status) => statusSet.add(status))
    })

    const lineData: Array<{ date: string; status: string; count: number }> = []
    trend.forEach((point) => {
      statusSet.forEach((status) => {
        lineData.push({
          date: point.date,
          status,
          count: point.statuses[status] || 0,
        })
      })
    })

    return {
      typeName: trend[0]?.type_name || selectedTypeForDrill,
      config: {
        data: lineData,
        xField: 'date',
        yField: 'count',
        seriesField: 'status',
        point: { size: 4 },
        smooth: true,
        color: (datum: { status: string }) =>
          statusColorMap[datum.status]?.color || '#1677ff',
        legend: { position: 'top' as const },
      },
    }
  }, [selectedTypeForDrill, trendQuery.data])

  const pendingColumns: ColumnsType<ApprovalCoreFields> = useMemo(
    () => [
      {
        title: '审批类型',
        dataIndex: 'type_name',
        width: 140,
      },
      {
        title: '申请标题',
        dataIndex: 'title',
        ellipsis: true,
      },
      {
        title: '申请人',
        dataIndex: 'user_name',
        width: 120,
      },
      {
        title: '金额/数量',
        dataIndex: 'amount',
        width: 150,
        render: (_, record) => {
          if (typeof record.amount === 'number') return `${record.amount.toFixed(2)} 元`
          if (typeof record.days === 'number') return `${record.days} 天`
          if (typeof record.quantity === 'number') return `${record.quantity}`
          return '-'
        },
      },
      {
        title: '申请时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string | undefined) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: string) => {
          const meta = statusColorMap[value] || { label: value, color: 'default' }
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '操作',
        dataIndex: 'action',
        width: 220,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" onClick={() => openDetail(record)}>
              查看
            </Button>
            <Button type="link" onClick={() => openActionModal(record, 'approve')}>
              通过
            </Button>
            <Button type="link" danger onClick={() => openActionModal(record, 'reject')}>
              驳回
            </Button>
            <Button type="link" danger onClick={() => handleSingleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [openActionModal, openDetail, handleSingleDelete],
  )

  const historyColumns: ColumnsType<ApprovalCoreFields> = useMemo(
    () => [
      {
        title: '审批类型',
        dataIndex: 'type_name',
        width: 140,
      },
      {
        title: '申请标题',
        dataIndex: 'title',
        ellipsis: true,
      },
      {
        title: '申请人',
        dataIndex: 'user_name',
        width: 120,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: string) => {
          const meta = statusColorMap[value] || { label: value, color: 'default' }
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 180,
        render: (value: string | undefined) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 150,
        render: (_, record) => (
          <Space size="small">
            <Button type="link" onClick={() => openDetail(record)}>
              查看
            </Button>
            <Button type="link" danger onClick={() => handleSingleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [openDetail, handleSingleDelete],
  )

  const handlePendingFilterChange = (_: unknown, allValues: { approvalType?: string }) => {
    const normalized = allValues.approvalType && allValues.approvalType !== 'all' ? allValues.approvalType : undefined
    setPendingFilters({ approvalType: normalized })
  }

  const handleHistorySearch = (values: { approvalType?: string; status?: string; dateRange?: Dayjs[] }) => {
    setHistoryPagination((prev) => ({ ...prev, current: 1 }))
    setHistoryFilters({
      approvalType:
        values.approvalType && values.approvalType !== 'all' ? values.approvalType : undefined,
      status: values.status || 'all',
      beginDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleManagerSearch = (values: {
    approvalType: string
    dateRange?: Dayjs[]
    groupBy?: 'day' | 'week' | 'month'
  }) => {
    setManagerFilters((prev) => ({
      approvalType: values.approvalType,
      beginDate: values.dateRange?.[0]?.format('YYYY-MM-DD') ?? prev.beginDate,
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') ?? prev.endDate,
      groupBy: values.groupBy ?? prev.groupBy,
    }))
    if (values.approvalType === 'all') {
      setSelectedTypeForDrill(null)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleManagerReset = () => {
    setManagerFilters({
      approvalType: 'all',
      beginDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      groupBy: 'day',
    })
    setSelectedTypeForDrill(null)
  }

  const handleBatchDelete = (keys: React.Key[]) => {
    console.log('[批量删除] 函数被调用，keys:', keys)
    
    if (!keys.length) {
      console.log('[批量删除] keys为空，显示警告')
      message.warning('请先选择要删除的记录')
      return
    }

    console.log('[批量删除] 准备显示确认对话框')
    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条审批记录吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        console.log('[批量删除] 用户确认删除')
        const items = keys.map((key) => {
          const [approvalType, id] = String(key).split('-')
          return { approval_type: approvalType, id: Number(id) }
        })
        console.log('[批量删除] 准备调用API，items:', items)
        batchDeleteMutation.mutate({ items })
      },
    })
  }

  const detailFields = detailContext ? detailFieldPresets[detailContext.approvalType] : undefined
  const detailData = detailQuery.data?.detail ?? {}
  const timelineInstance = timelineQuery.data?.instance

  const renderDetailValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            审批管理中心
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            统一查看并处理报销、采购、请假、物品领用等审批任务。
          </Paragraph>
        </div>
        <Space>
          <Segmented
            options={[
              { label: '作业模式', value: 'list', icon: <UnorderedListOutlined /> },
              { label: '看板模式', value: 'dashboard', icon: <AppstoreOutlined /> },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as 'list' | 'dashboard')}
          />
          <Button
            type="primary"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['approval'] })
            }}
          >
            刷新数据
          </Button>
        </Space>
      </Flex>

      {viewMode === 'list' ? (
        <>
          <Card title="待审批中心" bordered={false}>
        <Row gutter={[16, 16]}>
          {statCards.map((card) => (
            <Col xs={24} sm={12} md={8} lg={6} key={card.title}>
              <Card>
                <Statistic title={card.title} value={card.value} loading={statsQuery.isLoading} />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: '待审批',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Form
                    form={pendingForm}
                    layout="inline"
                    initialValues={{ approvalType: 'all' }}
                    onValuesChange={handlePendingFilterChange}
                  >
                    <Form.Item name="approvalType" label="审批类型">
                      <Select
                        style={{ width: 200 }}
                        options={[{ value: 'all', label: '全部类型' }, ...APPROVAL_TYPES]}
                      />
                    </Form.Item>
                  </Form>

                  {selectedPendingKeys.length > 0 && (
                    <Alert
                      message={`已选择 ${selectedPendingKeys.length} 条记录`}
                      type="info"
                      showIcon
                      action={
                        <Space>
                          <Button size="small" onClick={() => setSelectedPendingKeys([])}>
                            取消选择
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            danger
                            loading={batchDeleteMutation.isPending}
                            onClick={() => handleBatchDelete(selectedPendingKeys)}
                          >
                            批量删除
                          </Button>
                        </Space>
                      }
                    />
                  )}

                  <Table
                    rowKey={(record) => `${record.approval_type}-${record.id}`}
                    columns={pendingColumns}
                    dataSource={pendingQuery.data?.records}
                    loading={pendingQuery.isLoading}
                    pagination={false}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: pendingQuery.isLoading ? <Empty description="加载中" /> : <Empty description="暂无待审批" /> }}
                    rowSelection={{
                      selectedRowKeys: selectedPendingKeys,
                      onChange: (keys) => setSelectedPendingKeys(keys),
                      preserveSelectedRowKeys: true,
                    }}
                  />
                </Space>
              ),
            },
            {
              key: 'history',
              label: '审批记录',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Form
                    form={historyForm}
                    layout="inline"
                    initialValues={{ approvalType: 'all', status: 'all' }}
                    onFinish={handleHistorySearch}
                  >
                    <Form.Item name="approvalType" label="审批类型">
                      <Select
                        style={{ width: 200 }}
                        options={[{ value: 'all', label: '全部类型' }, ...APPROVAL_TYPES]}
                      />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                      <Select style={{ width: 200 }} options={statusOptions} />
                    </Form.Item>
                    <Form.Item name="dateRange" label="申请日期">
                      <RangePicker allowClear />
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit">
                          查询
                        </Button>
                        <Button
                          onClick={() => {
                            historyForm.resetFields()
                            handleHistorySearch({ status: 'all' })
                          }}
                        >
                          重置
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>

                  {selectedHistoryKeys.length > 0 && (
                    <Alert
                      message={`已选择 ${selectedHistoryKeys.length} 条记录`}
                      type="info"
                      showIcon
                      action={
                        <Space>
                          <Button size="small" onClick={() => setSelectedHistoryKeys([])}>
                            取消选择
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            danger
                            loading={batchDeleteMutation.isPending}
                            onClick={() => handleBatchDelete(selectedHistoryKeys)}
                          >
                            批量删除
                          </Button>
                        </Space>
                      }
                    />
                  )}

                  <Table
                    rowKey={(record) => `${record.approval_type}-${record.id}`}
                    columns={historyColumns}
                    dataSource={historyQuery.data?.records}
                    loading={historyQuery.isLoading}
                    pagination={{
                      current: historyPagination.current,
                      pageSize: historyPagination.pageSize,
                      total: historyQuery.data?.total,
                      onChange: (page, pageSize) => setHistoryPagination({ current: page, pageSize }),
                      showSizeChanger: true,
                    }}
                    scroll={{ x: 900 }}
                    rowSelection={{
                      selectedRowKeys: selectedHistoryKeys,
                      onChange: (keys) => setSelectedHistoryKeys(keys),
                      preserveSelectedRowKeys: true,
                    }}
                  />
                </Space>
              ),
            },
          ]} />
          </Card>
        </>
      ) : (
        <ApprovalAnalytics />
      )}

      <Drawer
        title={
          detailContext
            ? `${getApprovalTypeLabel(detailContext.approvalType)} · #${detailContext.id}`
            : '审批详情'
        }
        width={560}
        open={!!detailContext}
        onClose={() => setDetailContext(null)}
      >
        {!detailContext ? (
          <Empty description="请选择审批记录" />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {detailQuery.isLoading ? (
              <Empty description="加载详情..." />
            ) : (
              <>
                {detailFields && detailFields.length > 0 && (
                  <Card size="small" title="关键信息" bordered={false}>
                    <Descriptions column={1} bordered size="small">
                      {detailFields.map((field) => (
                        <Descriptions.Item key={field.key} label={field.label}>
                          {renderDetailValue(detailData[field.key])}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  </Card>
                )}
                <Card size="small" title="全部字段" bordered={false}>
                  <Descriptions column={1} bordered size="small">
                    {Object.entries(detailData).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        {renderDetailValue(value)}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              </>
            )}
            <Card
              size="small"
              title={
                timelineInstance?.workflow_name
                  ? `审批流转 · ${timelineInstance.workflow_name}`
                  : '审批流转'
              }
              bordered={false}
            >
              {timelineQuery.isLoading ? (
                <Empty description="加载流程..." />
              ) : timelineQuery.error ? (
                <Alert
                  type="error"
                  message={(timelineQuery.error as Error).message || '加载流程失败'}
                />
              ) : timelineItems.length ? (
                <Timeline items={timelineItems} />
              ) : (
                <Alert type="info" message="当前审批尚未进入流程" />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={actionState.action === 'approve' ? '确认通过' : '确认驳回'}
        open={!!actionState.record}
        onCancel={() => setActionState({})}
        confirmLoading={approvalMutation.isPending}
        onOk={() => {
          const comment = actionForm.getFieldValue('comment')
          if (actionState.record && actionState.action) {
            approvalMutation.mutate({ record: actionState.record, action: actionState.action, comment })
          }
        }}
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item label="审批意见" name="comment">
            <Input.TextArea rows={4} placeholder="可选，填写审批说明" />
          </Form.Item>
          <Text type="secondary">
            将对 {actionState.record?.user_name} 的 {getApprovalTypeLabel(actionState.record?.approval_type)} 申请进行
            {actionState.action === 'approve' ? '通过' : '驳回'} 操作。
          </Text>
        </Form>
      </Modal>
    </Space>
  )
}

export default ApprovalsPage
