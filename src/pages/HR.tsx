import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Image,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SafetyOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { HRFormRecord, HRFormStatus, HRFormType, ProbationEmployee } from '../api/types'
import {
  activateEmployeeAccount,
  assignHRApprover,
  approveHRForm,
  createOffboardingForm,
  createOnboardingForm,
  exportOffboardingForms,
  fetchHRFormDetail,
  fetchHRForms,
  fetchHRPdfPreview,
  fetchProbationEmployees,
  initiateHRSignature,
  generateHRPdf,
  regularizeEmployee,
  updateHRDraft,
  importEmployees,
  downloadImportTemplate,
  setProbationPeriod,
  fetchStatusLogs,
} from '../api/services/hr'
import { fetchUsers, type User } from '../api/services/users'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import CompanySelector from '../components/CompanySelector'

const statusColors: Record<HRFormStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'blue',
}

const statusLabels: Record<HRFormStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
}

const formTypeLabels: Record<HRFormType, string> = {
  onboarding: '入职申请',
  offboarding: '离职申请',
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })

const HRPage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding' | 'probation' | 'overview'>('overview')
  const [filters, setFilters] = useState<{ form_type?: HRFormType; status?: HRFormStatus; page: number; page_size: number; company_id?: number }>(
    {
      form_type: undefined,
      status: undefined,
      page: 1,
      page_size: 10,
      company_id: effectiveCompanyId,
    },
  )
  const [selectedFormId, setSelectedFormId] = useState<string>()
  const [createModalType, setCreateModalType] = useState<HRFormType | null>(null)
  const [regularizeInfo, setRegularizeInfo] = useState<{ open: boolean; formId?: string; name?: string }>({
    open: false,
  })
  const [onboardingForm] = Form.useForm()
  const [offboardingForm] = Form.useForm()
  const [regularizeForm] = Form.useForm()
  const [signatureForm] = Form.useForm()
  const [approverForm] = Form.useForm()
  const [selectedOffboardingKeys, setSelectedOffboardingKeys] = useState<React.Key[]>([])
  const [previewModal, setPreviewModal] = useState<{ open: boolean; images: string[]; title?: string }>({
    open: false,
    images: [],
  })
  const [signatureModal, setSignatureModal] = useState<{ open: boolean; formId?: string; name?: string }>({ open: false })
  const [approverModal, setApproverModal] = useState<{ open: boolean; formId?: string }>({ open: false })
  const [importModal, setImportModal] = useState<{ open: boolean }>({ open: false })
  const [importForm] = Form.useForm()
  const [probationPeriodModal, setProbationPeriodModal] = useState<{ open: boolean; formId?: string; name?: string }>({
    open: false,
  })
  const [probationPeriodForm] = Form.useForm()
  const [statusLogModal, setStatusLogModal] = useState<{ open: boolean; formId?: string }>({ open: false })

  useEffect(() => {
    if (activeTab !== 'offboarding') {
      setSelectedOffboardingKeys([])
    }
  }, [activeTab])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, company_id: effectiveCompanyId, page: 1 }))
  }, [effectiveCompanyId])

  const formsQuery = useQuery({
    queryKey: ['hr', 'forms', filters],
    queryFn: () => {
      console.log('[HR] Fetching forms with filters:', filters)
      return fetchHRForms(filters)
    },
  })
  
  // 调试日志
  useEffect(() => {
    console.log('[HR] Current filters:', filters)
    console.log('[HR] Effective company ID:', effectiveCompanyId)
    console.log('[HR] Selected company ID:', selectedCompanyId)
    console.log('[HR] Forms query data:', formsQuery.data)
  }, [filters, effectiveCompanyId, selectedCompanyId, formsQuery.data])

  const detailQuery = useQuery({
    queryKey: ['hr', 'detail', selectedFormId],
    queryFn: () => fetchHRFormDetail(selectedFormId as string),
    enabled: !!selectedFormId,
  })

  const probationQuery = useQuery({
    queryKey: ['hr', 'probation'],
    queryFn: fetchProbationEmployees,
    enabled: activeTab === 'probation',
  })

  const usersQuery = useQuery({
    queryKey: ['hr', 'approver-options'],
    queryFn: () => fetchUsers({ size: 200 }),
  })

  const createOnboardingMutation = useMutation({
    mutationFn: createOnboardingForm,
    onSuccess: () => {
      message.success('入职申请已提交')
      setCreateModalType(null)
      onboardingForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const createOffboardingMutation = useMutation({
    mutationFn: createOffboardingForm,
    onSuccess: () => {
      message.success('离职申请已提交')
      setCreateModalType(null)
      offboardingForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const approveMutation = useMutation({
    mutationFn: (payload: { formId: string; approved: boolean }) =>
      approveHRForm(payload.formId, { approved: payload.approved }),
    onSuccess: () => {
      message.success('审批完成')
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '审批失败'),
  })

  const regularizeMutation = useMutation({
    mutationFn: (payload: { formId: string; regularized_date: string; regular_salary?: number; comment?: string }) =>
      regularizeEmployee(payload.formId, {
        regularized_date: payload.regularized_date,
        regular_salary: payload.regular_salary,
        comment: payload.comment,
      }),
    onSuccess: () => {
      message.success('已提交转正信息')
      setRegularizeInfo({ open: false })
      regularizeForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['hr', 'probation'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const generatePdfMutation = useMutation({
    mutationFn: generateHRPdf,
    onSuccess: () => {
      message.success('PDF生成成功')
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '生成失败'),
  })

  const activateAccountMutation = useMutation({
    mutationFn: activateEmployeeAccount,
    onSuccess: () => {
      message.success('账号已激活')
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const assignApproverMutation = useMutation({
    mutationFn: ({ formId, approverId }: { formId: string; approverId: number }) => assignHRApprover(formId, approverId),
    onSuccess: () => {
      message.success('审批人已更新')
      setApproverModal({ open: false })
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '设置失败'),
  })

  const signatureMutation = useMutation({
    mutationFn: ({ formId, data }: { formId: string; data: { provider: string; signer_email: string; redirect_url?: string } }) =>
      initiateHRSignature(formId, data),
    onSuccess: (data) => {
      message.success('电子签任务已创建，即将打开签署页面')
      setSignatureModal({ open: false })
      signatureForm.resetFields()
      if (data.sign_url) {
        window.open(data.sign_url, '_blank', 'noopener,noreferrer')
      }
    },
    onError: (error) => message.error((error as Error).message || '发起失败'),
  })

  const pdfPreviewMutation = useMutation({
    mutationFn: ({ formId, title }: { formId: string; title: string }) =>
      fetchHRPdfPreview(formId, { allPages: true }).then((data) => ({ data, title })),
    onSuccess: ({ data, title }) => {
      setPreviewModal({
        open: true,
        images: data.images || (data.image_url ? [data.image_url] : []),
        title,
      })
    },
    onError: (error) => message.error((error as Error).message || '预览失败'),
  })

  const exportOffboardingMutation = useMutation({
    mutationFn: exportOffboardingForms,
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `offboarding-${dayjs().format('YYYYMMDDHHmmss')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    },
    onError: (error) => message.error((error as Error).message || '导出失败'),
  })

  const importEmployeesMutation = useMutation({
    mutationFn: ({ file, defaultPassword, skipExisting }: { file: File; defaultPassword: string; skipExisting: boolean }) =>
      importEmployees(file, defaultPassword, skipExisting),
    onSuccess: (data) => {
      const { success_count, skip_count, error_count, errors } = data
      let messageText = `导入完成：成功 ${success_count} 个`
      if (skip_count > 0) messageText += `，跳过 ${skip_count} 个`
      if (error_count > 0) messageText += `，失败 ${error_count} 个`
      message.success(messageText)
      if (errors.length > 0) {
        Modal.warning({
          title: '导入错误详情',
          width: 600,
          content: (
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {errors.map((err, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  {err}
                </div>
              ))}
            </div>
          ),
        })
      }
      setImportModal({ open: false })
      importForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'probation'] })
    },
    onError: (error) => message.error((error as Error).message || '导入失败'),
  })

  const downloadTemplateMutation = useMutation({
    mutationFn: downloadImportTemplate,
    onSuccess: () => message.success('模板下载成功'),
    onError: (error) => message.error((error as Error).message || '下载失败'),
  })

  const setProbationPeriodMutation = useMutation({
    mutationFn: ({ formId, probationPeriod, comment }: { formId: string; probationPeriod: number; comment?: string }) =>
      setProbationPeriod(formId, probationPeriod, comment),
    onSuccess: () => {
      message.success('试用期时长设置成功')
      setProbationPeriodModal({ open: false })
      probationPeriodForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['hr', 'probation'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
    },
    onError: (error) => message.error((error as Error).message || '设置失败'),
  })

  const statusLogsQuery = useQuery({
    queryKey: ['hr', 'status-logs', statusLogModal.formId],
    queryFn: () => fetchStatusLogs({ form_id: statusLogModal.formId, limit: 50 }),
    enabled: statusLogModal.open && !!statusLogModal.formId,
  })

  const submitDraftMutation = useMutation({
    mutationFn: ({ formId, formType }: { formId: string; formType: HRFormType }) =>
      updateHRDraft(formId, { form_type: formType, payload: {}, submit: true }),
    onSuccess: () => {
      message.success('草稿已提交')
      queryClient.invalidateQueries({ queryKey: ['hr', 'forms'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'detail'] })
    },
    onError: (error) => message.error((error as Error).message || '提交失败'),
  })

  const currentForms = formsQuery.data?.forms || []
  const stats = useMemo(() => {
    const total = currentForms.length
    const approved = currentForms.filter((item) => item.status === 'approved').length
    const pending = currentForms.filter((item) => item.status === 'submitted').length
    return { total, approved, pending }
  }, [currentForms])

  const approverOptions = useMemo(
    () =>
      (usersQuery.data?.items || []).map((user: User) => ({
        value: user.id,
        label: `${user.name || user.nickname || '用户'} (${user.id})`,
      })),
    [usersQuery.data],
  )

  const handleCreateOnboarding = async (saveAsDraft = false) => {
    const values = saveAsDraft ? onboardingForm.getFieldsValue(true) : await onboardingForm.validateFields()
    createOnboardingMutation.mutate({
      ...values,
      hire_date: values.hire_date ? dayjs(values.hire_date).format('YYYY-MM-DD') : undefined,
      save_as_draft: saveAsDraft,
    })
  }

  const handleCreateOffboarding = async (saveAsDraft = false) => {
    const values = saveAsDraft ? offboardingForm.getFieldsValue(true) : await offboardingForm.validateFields()
    createOffboardingMutation.mutate({
      ...values,
      leave_date: values.leave_date ? dayjs(values.leave_date).format('YYYY-MM-DD') : undefined,
      save_as_draft: saveAsDraft,
    })
  }

  const handleApprove = (formId: string, approved: boolean) => {
    modal.confirm({
      title: approved ? '确认通过此申请？' : '确认驳回此申请？',
      onOk: () => approveMutation.mutate({ formId, approved }),
    })
  }

  const handleRegularize = async () => {
    const values = await regularizeForm.validateFields()
    if (!regularizeInfo.formId) return
    regularizeMutation.mutate({
      formId: regularizeInfo.formId,
      regularized_date: values.regularized_date.format('YYYY-MM-DD'),
      regular_salary: values.regular_salary,
      comment: values.comment,
    })
  }

  const handleSubmitSignature = async () => {
    if (!signatureModal.formId) return
    const values = await signatureForm.validateFields()
    signatureMutation.mutate({
      formId: signatureModal.formId,
      data: values,
    })
  }

  const handleSubmitApprover = async () => {
    if (!approverModal.formId) return
    const values = await approverForm.validateFields()
    assignApproverMutation.mutate({ formId: approverModal.formId, approverId: values.approver_id })
  }

  const handlePreviewPdf = (record: HRFormRecord) => {
    setPreviewModal({ open: true, images: [], title: record.name })
    pdfPreviewMutation.mutate({ formId: record.form_id, title: record.name })
  }

  const handleExportOffboarding = () => {
    if (!selectedOffboardingKeys.length) {
      message.warning('请先选择要导出的记录')
      return
    }
    exportOffboardingMutation.mutate(selectedOffboardingKeys as string[])
  }

  const handleOpenSignature = (record: HRFormRecord) => {
    setSignatureModal({ open: true, formId: record.form_id, name: record.name })
    signatureForm.resetFields()
  }

  const handleOpenApprover = (record: HRFormRecord) => {
    setApproverModal({ open: true, formId: record.form_id })
    approverForm.resetFields()
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '申请类型',
      dataIndex: 'form_type',
      render: (value: HRFormType) => formTypeLabels[value],
    },
    {
      title: '手机号',
      dataIndex: 'phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: HRFormStatus) => <Tag color={statusColors[value]}>{statusLabels[value]}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
    },
    {
      title: '操作',
      render: (_: unknown, record: HRFormRecord) => {
        const previewLoading =
          pdfPreviewMutation.isPending && pdfPreviewMutation.variables?.formId === record.form_id
        const submitDraftLoading =
          submitDraftMutation.isPending && submitDraftMutation.variables?.formId === record.form_id
        return (
          <Space wrap>
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => setSelectedFormId(record.form_id)}>
              详情
            </Button>
            <Button size="small" icon={<EyeOutlined />} loading={previewLoading} onClick={() => handlePreviewPdf(record)}>
              预览
            </Button>
            <Button size="small" icon={<SafetyOutlined />} onClick={() => handleOpenSignature(record)}>
              电子签
            </Button>
            <Button size="small" onClick={() => handleOpenApprover(record)}>
              审批人
            </Button>
            {record.status === 'submitted' && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.form_id, true)}
                >
                  通过
                </Button>
                <Button size="small" danger icon={<StopOutlined />} onClick={() => handleApprove(record.form_id, false)}>
                  驳回
                </Button>
              </>
            )}
            {record.status === 'draft' && (
              <Button
                size="small"
                type="dashed"
                loading={submitDraftLoading}
                onClick={() => submitDraftMutation.mutate({ formId: record.form_id, formType: record.form_type })}
              >
                提交草稿
              </Button>
            )}
            {!record.pdf_url && (
              <Button size="small" icon={<FilePdfOutlined />} onClick={() => generatePdfMutation.mutate(record.form_id)}>
                生成PDF
              </Button>
            )}
            <Button type="link" size="small" onClick={() => handleViewStatusLogs(record.form_id)}>
              日志
            </Button>
          </Space>
        )
      },
    },
  ]

  const handleSetProbationPeriod = (record: ProbationEmployee) => {
    setProbationPeriodModal({ open: true, formId: record.form_id, name: record.name })
    probationPeriodForm.setFieldsValue({ probation_period: record.probation_period || 0 })
  }

  const handleViewStatusLogs = (formId: string) => {
    setStatusLogModal({ open: true, formId })
  }

  const probationColumns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '岗位', dataIndex: 'position' },
    { title: '部门', dataIndex: 'department' },
    { title: '入职日期', dataIndex: 'hire_date' },
    { title: '试用期(月)', dataIndex: 'probation_period' },
    { title: '到期日期', dataIndex: 'probation_end_date' },
    { title: '提醒', dataIndex: 'status_text', render: (text: string) => <Tag color="gold">{text}</Tag> },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, record: ProbationEmployee) => (
        <Space>
          {!record.probation_period && (
            <Button type="link" size="small" onClick={() => handleSetProbationPeriod(record)}>
              设置试用期
            </Button>
          )}
          <Button
            type="primary"
            size="small"
            onClick={() => setRegularizeInfo({ open: true, formId: record.form_id, name: record.name })}
          >
            办理转正
          </Button>
          <Button size="small" onClick={() => activateAccountMutation.mutate(record.user_id)}>
            激活账号
          </Button>
          <Button type="link" size="small" onClick={() => handleViewStatusLogs(record.form_id)}>
            查看日志
          </Button>
        </Space>
      ),
    },
  ]

  const activeForms = currentForms.filter((item) => {
    if (activeTab === 'onboarding') return item.form_type === 'onboarding'
    if (activeTab === 'offboarding') return item.form_type === 'offboarding'
    return true
  })

  const renderOverview = () => (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic title="本期申请总数" value={stats.total} prefix={<TeamOutlined />} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="待审批" value={stats.pending} valueStyle={{ color: '#faad14' }} />
        </Card>
      </Col>
    </Row>
  )

  const tabItems = [
    {
      key: 'overview',
      label: '员工档案概览',
      children: renderOverview(),
    },
    {
      key: 'onboarding',
      label: '入职管理',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center">
            <Space>
              <Select
                allowClear
                placeholder="筛选状态"
                style={{ width: 160 }}
                options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                value={filters.status}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value as HRFormStatus | undefined,
                    page: 1,
                    form_type: 'onboarding',
                  }))
                }
              />
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalType('onboarding')}>
              新建入职
            </Button>
          </Flex>
          <Table
            rowKey="form_id"
            loading={formsQuery.isLoading}
            columns={columns}
            dataSource={activeForms}
            pagination={{
              current: filters.page,
              pageSize: filters.page_size,
              total: formsQuery.data?.total,
              onChange: (page, pageSize) =>
                setFilters((prev) => ({ ...prev, page, page_size: pageSize ?? prev.page_size })),
            }}
          />
        </Space>
      ),
    },
    {
      key: 'offboarding',
      label: '离职管理',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center">
            <Space>
              <Select
                allowClear
                placeholder="筛选状态"
                style={{ width: 160 }}
                options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                value={filters.status}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value as HRFormStatus | undefined,
                    page: 1,
                    form_type: 'offboarding',
                  }))
                }
              />
            </Space>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                disabled={!selectedOffboardingKeys.length}
                loading={exportOffboardingMutation.isPending}
                onClick={handleExportOffboarding}
              >
                批量导出
              </Button>
              <Button onClick={() => setCreateModalType('offboarding')} icon={<PlusOutlined />}>
                新建离职
              </Button>
            </Space>
          </Flex>
          <Table
            rowKey="form_id"
            loading={formsQuery.isLoading}
            columns={columns}
            dataSource={activeForms}
            rowSelection={{
              selectedRowKeys: selectedOffboardingKeys,
              onChange: (keys) => setSelectedOffboardingKeys(keys),
            }}
            pagination={{
              current: filters.page,
              pageSize: filters.page_size,
              total: formsQuery.data?.total,
              onChange: (page, pageSize) =>
                setFilters((prev) => ({ ...prev, page, page_size: pageSize ?? prev.page_size })),
            }}
          />
        </Space>
      ),
    },
    {
      key: 'probation',
      label: '试用期跟进',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <AlertCards employees={probationQuery.data?.employees || []} />
          <Table
            rowKey="form_id"
            loading={probationQuery.isLoading}
            columns={probationColumns}
            dataSource={probationQuery.data?.employees || []}
            pagination={false}
          />
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <div>
          <h2 style={{ marginBottom: 4 }}>人事管理中心</h2>
          <span style={{ color: '#666' }}>覆盖员工档案、入离职流程、试用期跟进与电子签名</span>
        </div>
        {isSuperAdmin && (
          <CompanySelector
            value={selectedCompanyId}
            onChange={(id) => setSelectedCompanyId(id)}
          />
        )}
      </Flex>
      {showCompanyWarning && (
        <Alert
          message="请先选择公司"
          description="超级管理员需要先选择公司才能查看人事数据"
          type="warning"
          showIcon
          closable
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as typeof activeTab)
          const nextFormType = key === 'onboarding' || key === 'offboarding' ? (key as HRFormType) : undefined
          setFilters((prev) => ({
            ...prev,
            form_type: nextFormType,
            page: 1,
          }))
        }}
        items={tabItems}
      />

      <Drawer
        width={560}
        title="表单详情"
        open={!!selectedFormId}
        onClose={() => setSelectedFormId(undefined)}
        destroyOnClose
      >
        {detailQuery.isLoading ? (
          <Spin tip="加载中..." />
        ) : detailQuery.isError ? (
          <Alert type="error" message="加载失败" description={(detailQuery.error as Error)?.message || '未知错误'} />
        ) : detailQuery.data ? (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="姓名">{detailQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detailQuery.data.phone}</Descriptions.Item>
              <Descriptions.Item label="部门">{detailQuery.data.department}</Descriptions.Item>
              <Descriptions.Item label="岗位">{detailQuery.data.position}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[detailQuery.data.status]}>{statusLabels[detailQuery.data.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="类型">{formTypeLabels[detailQuery.data.form_type]}</Descriptions.Item>
              <Descriptions.Item label="入职日期">{detailQuery.data.hire_date}</Descriptions.Item>
              <Descriptions.Item label="离职日期">{detailQuery.data.leave_date}</Descriptions.Item>
              <Descriptions.Item label="住址" span={2}>
                {detailQuery.data.address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="紧急联系人">{detailQuery.data.emergency_contact}</Descriptions.Item>
              <Descriptions.Item label="紧急联系人电话">{detailQuery.data.emergency_phone}</Descriptions.Item>
              {detailQuery.data.attachments?.custom_approvers && (
                <Descriptions.Item label="自定义审批链" span={2}>
                  {(detailQuery.data.attachments.custom_approvers as number[]).join('，')}
                </Descriptions.Item>
              )}
            </Descriptions>
            {detailQuery.data.attachments?.signature_task && (
              <Alert
                type="info"
                showIcon
                message={`电子签状态：${detailQuery.data.attachments.signature_task.status || '未知'}`}
                description={
                  detailQuery.data.attachments.signature_task.file_url ? (
                    <a href={detailQuery.data.attachments.signature_task.file_url} target="_blank" rel="noreferrer">
                      查看签署文件
                    </a>
                  ) : (
                    '尚未回传签署文件'
                  )
                }
              />
            )}
            {detailQuery.data.pdf_url && (
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => window.open(detailQuery.data?.pdf_url as string, '_blank')}
                block
              >
                查看PDF
              </Button>
            )}
            <Space wrap>
              <Button icon={<EyeOutlined />} onClick={() => handlePreviewPdf(detailQuery.data)}>
                PDF 预览
              </Button>
              <Button icon={<SafetyOutlined />} onClick={() => handleOpenSignature(detailQuery.data)}>
                发起电子签
              </Button>
              <Button onClick={() => handleOpenApprover(detailQuery.data)}>指定审批人</Button>
            </Space>
            {detailQuery.data.status === 'draft' && (
              <Button
                type="primary"
                loading={submitDraftMutation.isPending}
                onClick={() =>
                  submitDraftMutation.mutate({ formId: detailQuery.data!.form_id, formType: detailQuery.data!.form_type })
                }
              >
                提交草稿
              </Button>
            )}
          </Space>
        ) : (
          <p>暂无数据</p>
        )}
      </Drawer>

      <Modal
        title="新建入职申请"
        open={createModalType === 'onboarding'}
        onCancel={() => setCreateModalType(null)}
        footer={null}
        width={720}
      >
        <Form form={onboardingForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
                <Input placeholder="张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
                <Input placeholder="138****0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="职位" name="position" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="部门" name="department" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="入职日期" name="hire_date" rules={[{ required: true }]}>
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="试用期（月）" name="probation_period">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮箱" name="email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="薪资" name="salary">
                <InputNumber min={0} prefix="¥" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="居住地址" name="address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="指定审批人" name="approver_ids">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择审批人"
              options={approverOptions}
              loading={usersQuery.isLoading}
            />
          </Form.Item>
          <Form.Item label="电子签服务" name="signature_provider">
            <Input placeholder="如：上上签、契约锁" />
          </Form.Item>
          <Form.Item label="电子签关联ID" name="signature_reference">
            <Input placeholder="用于回调匹配的业务ID" />
          </Form.Item>
          <Form.Item label="签字图片" name="signature_image" rules={[{ required: true, message: '请上传签字图片' }]}>
            <Upload
              maxCount={1}
              beforeUpload={async (file) => {
                const base64 = await fileToBase64(file)
                onboardingForm.setFieldValue('signature_image', base64)
                message.success('签名上传成功')
                return Upload.LIST_IGNORE
              }}
            >
              <Button icon={<CloudUploadOutlined />}>上传签名</Button>
            </Upload>
          </Form.Item>
        </Form>
        <Flex justify="flex-end" gap={8}>
          <Space>
            <Button onClick={() => setCreateModalType(null)}>取消</Button>
            <Button onClick={() => handleCreateOnboarding(true)} loading={createOnboardingMutation.isPending}>
              保存草稿
            </Button>
            <Button type="primary" onClick={() => handleCreateOnboarding(false)} loading={createOnboardingMutation.isPending}>
              提交
            </Button>
          </Space>
        </Flex>
      </Modal>

      <Modal
        title="新建离职申请"
        open={createModalType === 'offboarding'}
        onCancel={() => setCreateModalType(null)}
        footer={null}
        width={640}
      >
        <Form form={offboardingForm} layout="vertical">
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="离职日期" name="leave_date" rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="离职原因" name="leave_reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="交接状态" name="handover_status">
            <Select
              options={[
                { value: 'todo', label: '待交接' },
                { value: 'doing', label: '交接中' },
                { value: 'done', label: '已完成' },
              ]}
            />
          </Form.Item>
          <Form.Item label="签字图片" name="signature_image">
            <Upload
              maxCount={1}
              beforeUpload={async (file) => {
                const base64 = await fileToBase64(file)
                offboardingForm.setFieldValue('signature_image', base64)
                message.success('签名上传成功')
                return Upload.LIST_IGNORE
              }}
            >
              <Button icon={<CloudUploadOutlined />}>上传签名</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="指定审批人" name="approver_ids">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择审批人"
              options={approverOptions}
              loading={usersQuery.isLoading}
            />
          </Form.Item>
          <Form.Item label="电子签服务" name="signature_provider">
            <Input />
          </Form.Item>
          <Form.Item label="电子签关联ID" name="signature_reference">
            <Input />
          </Form.Item>
        </Form>
        <Flex justify="flex-end" gap={8}>
          <Space>
            <Button onClick={() => setCreateModalType(null)}>取消</Button>
            <Button onClick={() => handleCreateOffboarding(true)} loading={createOffboardingMutation.isPending}>
              保存草稿
            </Button>
            <Button type="primary" onClick={() => handleCreateOffboarding(false)} loading={createOffboardingMutation.isPending}>
              提交
            </Button>
          </Space>
        </Flex>
      </Modal>

      <Modal
        title={`办理转正 - ${regularizeInfo.name || ''}`}
        open={regularizeInfo.open}
        onCancel={() => setRegularizeInfo({ open: false })}
        onOk={handleRegularize}
        confirmLoading={regularizeMutation.isPending}
      >
        <Form form={regularizeForm} layout="vertical">
          <Form.Item label="转正日期" name="regularized_date" rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="转正薪资" name="regular_salary">
            <InputNumber min={0} className="w-full" prefix="¥" />
          </Form.Item>
          <Form.Item label="备注" name="comment">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`PDF 预览 - ${previewModal.title || ''}`}
        open={previewModal.open}
        onCancel={() => setPreviewModal({ open: false, images: [] })}
        footer={null}
        width={800}
      >
        {pdfPreviewMutation.isPending ? (
          <Spin style={{ width: '100%' }} />
        ) : previewModal.images.length ? (
          <Image.PreviewGroup>
            <Flex vertical gap={12}>
              {previewModal.images.map((src, index) => (
                <Image key={src} src={src} alt={`page-${index + 1}`} width="100%" />
              ))}
            </Flex>
          </Image.PreviewGroup>
        ) : (
          <Empty description="暂无预览" />
        )}
      </Modal>

      <Modal
        title={`发起电子签 - ${signatureModal.name || ''}`}
        open={signatureModal.open}
        onCancel={() => setSignatureModal({ open: false })}
        onOk={handleSubmitSignature}
        confirmLoading={signatureMutation.isPending}
      >
        <Form form={signatureForm} layout="vertical">
          <Form.Item label="签署服务商" name="provider" rules={[{ required: true, message: '请输入服务商' }]}>
            <Input placeholder="如：上上签、契约锁" />
          </Form.Item>
          <Form.Item label="签署人邮箱" name="signer_email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item label="签署完成回跳地址" name="redirect_url">
            <Input placeholder="https://example.com/callback" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="指定审批人"
        open={approverModal.open}
        onCancel={() => setApproverModal({ open: false })}
        onOk={handleSubmitApprover}
        confirmLoading={assignApproverMutation.isPending}
      >
        <Form form={approverForm} layout="vertical">
          <Form.Item label="审批人" name="approver_id" rules={[{ required: true, message: '请选择审批人' }]}>
            <Select
              placeholder="请选择"
              options={approverOptions}
              loading={usersQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入员工"
        open={importModal.open}
        onCancel={() => setImportModal({ open: false })}
        footer={null}
        width={600}
      >
        <Alert
          message="使用说明"
          description={
            <div>
              <p>1. 点击"下载模板"按钮下载Excel模板</p>
              <p>2. 按照模板格式填写员工数据（必填：姓名、手机号、职位、部门、入职日期）</p>
              <p>3. 上传填写好的Excel文件</p>
              <p>4. 系统会自动创建账号和入职申请记录</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={importForm}
          layout="vertical"
          onFinish={(values) => {
            if (!values.file) {
              message.warning('请选择Excel文件')
              return
            }
            importEmployeesMutation.mutate({
              file: values.file,
              defaultPassword: values.default_password || '123456',
              skipExisting: values.skip_existing !== false,
            })
          }}
        >
          <Form.Item
            label="Excel文件"
            name="file"
            rules={[{ required: true, message: '请选择Excel文件' }]}
            valuePropName="file"
            getValueFromEvent={(e) => e.file}
          >
            <Upload
              maxCount={1}
              accept=".xlsx,.xls"
              beforeUpload={(file) => {
                importForm.setFieldValue('file', file)
                return false
              }}
            >
              <Button icon={<CloudUploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="默认密码" name="default_password" initialValue="123456">
            <Input placeholder="新员工的默认登录密码" />
          </Form.Item>
          <Form.Item name="skip_existing" valuePropName="checked" initialValue={true}>
            <Checkbox>跳过已存在的员工（根据手机号判断）</Checkbox>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setImportModal({ open: false })}>取消</Button>
              <Button type="primary" htmlType="submit" loading={importEmployeesMutation.isPending}>
                开始导入
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置试用期时长"
        open={probationPeriodModal.open}
        onCancel={() => setProbationPeriodModal({ open: false })}
        footer={null}
        width={500}
      >
        <Form
          form={probationPeriodForm}
          layout="vertical"
          onFinish={(values) => {
            if (!probationPeriodModal.formId) return
            setProbationPeriodMutation.mutate({
              formId: probationPeriodModal.formId,
              probationPeriod: values.probation_period,
              comment: values.comment,
            })
          }}
        >
          <Alert
            message={`为员工 ${probationPeriodModal.name} 设置试用期时长`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            label="试用期时长（月）"
            name="probation_period"
            rules={[{ required: true, message: '请输入试用期时长' }, { type: 'number', min: 1, max: 12 }]}
          >
            <InputNumber min={1} max={12} className="w-full" placeholder="1-12个月，0表示直接转正" />
          </Form.Item>
          <Form.Item label="备注" name="comment">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setProbationPeriodModal({ open: false })}>取消</Button>
              <Button type="primary" htmlType="submit" loading={setProbationPeriodMutation.isPending}>
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="状态变更日志"
        open={statusLogModal.open}
        onCancel={() => setStatusLogModal({ open: false })}
        footer={<Button onClick={() => setStatusLogModal({ open: false })}>关闭</Button>}
        width={800}
      >
        <Table
          rowKey="id"
          loading={statusLogsQuery.isLoading}
          columns={[
            { title: '变更类型', dataIndex: 'change_type', width: 120 },
            { title: '旧状态', dataIndex: 'old_status', width: 120 },
            { title: '新状态', dataIndex: 'new_status', width: 120 },
            { title: '操作人', dataIndex: 'changed_by', width: 100 },
            { title: '备注', dataIndex: 'comment', ellipsis: true },
            { title: '变更时间', dataIndex: 'created_at', width: 180 },
          ]}
          dataSource={statusLogsQuery.data?.logs || []}
          pagination={false}
        />
      </Modal>
    </Space>
  )
}

const AlertCards = ({ employees }: { employees: ProbationEmployee[] }) => {
  const total = employees.length
  const expiring = employees.filter((item) => (item.days_until_end ?? 0) <= 7).length
  const overdue = employees.filter((item) => (item.days_until_end ?? 0) < 0).length
  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic title="试用期人数" value={total} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="一周内到期" value={expiring} valueStyle={{ color: '#faad14' }} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="已超期" value={overdue} valueStyle={{ color: '#ff4d4f' }} />
        </Card>
      </Col>
    </Row>
  )
}

export default HRPage

