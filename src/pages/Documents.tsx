import { useMemo, useState } from 'react'
import {
  Alert,
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
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { DocumentRecord, DocumentStats } from '../api/types'
import * as XLSX from 'xlsx'
import {
  createDocument,
  deleteDocument,
  fetchDocumentStats,
  fetchDocuments,
  updateDocument,
  uploadDocumentAsset,
} from '../api/services/documents'
import dayjs from 'dayjs'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const categoryOptions = [
  { value: 'driver_personal', label: '司机个人证件' },
  { value: 'driver_vehicle', label: '司机车辆证件' },
  { value: 'manager_personal', label: '管理员个人证件' },
  { value: 'manager_fleet_driver', label: '车队-司机证件' },
  { value: 'manager_fleet_vehicle', label: '车队-车辆证件' },
  { value: 'company_documents', label: '公司证件' },
]

const expireOptions = [
  { value: 'soon', label: '即将到期(30天内)' },
  { value: 'expired', label: '已过期' },
  { value: '30days', label: '30天内到期' },
]

// 不同证件类别对应的证件类型选项
const docTypeOptions: Record<string, Array<{ value: string; label: string }>> = {
  driver_personal: [
    { value: '身份证', label: '身份证' },
    { value: '驾驶证', label: '驾驶证' },
    { value: '从业资格证', label: '从业资格证' },
  ],
  driver_vehicle: [
    { value: '行驶证', label: '行驶证' },
    { value: '营运证', label: '营运证' },
    { value: '保险单', label: '保险单' },
  ],
  manager_personal: [
    { value: '身份证', label: '身份证' },
    { value: '驾驶证', label: '驾驶证' },
  ],
  manager_fleet_driver: [
    { value: '身份证', label: '身份证' },
    { value: '驾驶证', label: '驾驶证' },
    { value: '从业资格证', label: '从业资格证' },
  ],
  manager_fleet_vehicle: [
    { value: '行驶证', label: '行驶证' },
    { value: '营运证', label: '营运证' },
    { value: '保险单', label: '保险单' },
    { value: '车辆登记', label: '车辆登记' },
  ],
  company_documents: [
    { value: '营业执照', label: '营业执照' },
    { value: '道路运输许可证', label: '道路运输许可证' },
    { value: '税务登记证', label: '税务登记证' },
  ],
}

const DocumentsPage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    category: string
    doc_type?: string
    expire_status?: string
    search?: string
    page: number
    page_size: number
  }>({
    category: 'driver_personal',
    page: 1,
    page_size: 10,
  })
  const [detailRecord, setDetailRecord] = useState<DocumentRecord | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DocumentRecord | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const listQuery = useQuery({
    queryKey: ['documents', filters, effectiveCompanyId],
    queryFn: () => fetchDocuments({ ...filters, company_id: effectiveCompanyId }),
    enabled: !!filters.category && (!isSuperAdmin || !!effectiveCompanyId),
  })

  const statsQuery = useQuery({
    queryKey: ['documents', 'stats', filters.category, effectiveCompanyId],
    queryFn: () =>
      fetchDocumentStats({
        category: filters.category,
        company_id: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      message.success('证件已新增')
      setCreateModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['documents', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '新增失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateDocument(id, payload),
    onSuccess: () => {
      message.success('证件已更新')
      setEditModalOpen(false)
      setEditingRecord(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['documents', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      message.success('证件已删除')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['documents', 'stats'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const handleUploadAsset = async (file: File) => {
    try {
      const res = await uploadDocumentAsset(file)
      const current = form.getFieldValue('assets') || []
      form.setFieldsValue({ assets: [...current, { file_url: res.url, file_name: res.filename }] })
      message.success('上传成功')
    } catch (error) {
      message.error((error as Error).message || '上传失败')
    }
    return Upload.LIST_IGNORE
  }

  const tableColumns: ColumnsType<DocumentRecord> = [
    {
      title: '证件类型',
      dataIndex: 'doc_type',
      width: 120,
    },
    {
      title: '证件号',
      dataIndex: 'doc_no',
      width: 150,
    },
    {
      title: '所属对象',
      dataIndex: 'subject_display',
      width: 150,
    },
    {
      title: '到期日',
      dataIndex: 'expire_date',
      width: 200,
      render: (value) => {
        if (!value) return '-'
        const diff = dayjs(value).diff(dayjs(), 'day')
        let color = 'green'
        if (diff < 0) color = 'red'
        else if (diff <= 30) color = 'orange'
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color}>{value}</Tag>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {diff < 0 ? '已过期' : diff === 0 ? '今天到期' : `${diff}天后到期`}
            </span>
          </Space>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      width: 200,
    },
    {
      title: '操作',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<FileSearchOutlined />} onClick={() => setDetailRecord(record)}>
            查看
          </Button>
          <Button
            size="small"
            icon={<CloudUploadOutlined />}
            onClick={() => {
              setEditingRecord(record)
              editForm.setFieldsValue({
                doc_type: record.doc_type,
                doc_no: record.doc_no,
                expire_date: record.expire_date ? dayjs(record.expire_date) : null,
                remark: record.remark,
              })
              setEditModalOpen(true)
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() =>
              modal.confirm({
                title: '确认删除该证件？',
                onOk: () => deleteMutation.mutate(record.id),
              })
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const stats = statsQuery.data as DocumentStats | undefined
  const pieConfig = {
    data: stats?.by_category.map((item) => ({ type: item.category, value: item.count })) || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      content: (data: any) => {
        const item = data.data || data
        return `${item.type}: ${item.value}`
      },
    },
  }

  const topConfig = {
    data: stats?.top_types.map((item) => ({ doc_type: item.doc_type, count: item.count })) || [],
    xField: 'doc_type',
    yField: 'count',
    columnWidthRatio: 0.5,
  }

  const summaryCards = useMemo(
    () => [
      { title: '证件总数', value: stats?.summary.total ?? 0, icon: <FileProtectOutlined /> },
      { title: '即将到期', value: stats?.summary.expiring ?? 0, icon: <CheckCircleOutlined />, color: '#faad14' },
      { title: '已过期', value: stats?.summary.expired ?? 0, icon: <FileAddOutlined />, color: '#ff4d4f' },
    ],
    [stats],
  )

  const handleCreate = async () => {
    const values = await form.validateFields()
    createMutation.mutate({
      ...values,
      assets: values.assets || [],
    })
  }

  const handleUpdate = async () => {
    if (!editingRecord) return
    const values = await editForm.validateFields()
    updateMutation.mutate({
      id: editingRecord.id,
      payload: {
        category: editingRecord.category,
        doc_type: values.doc_type,
        doc_no: values.doc_no,
        expire_date: values.expire_date ? values.expire_date.format('YYYY-MM-DD') : null,
        remark: values.remark || '',
      },
    })
  }

  // 导出证件列表
  const handleExport = () => {
    const records = listQuery.data?.records || []
    if (records.length === 0) {
      message.warning('暂无数据可导出')
      return
    }

    try {
      const exportData = records.map((record) => {
        const expireDate = record.expire_date
        let expireStatus = '-'
        if (expireDate) {
          const diff = dayjs(expireDate).diff(dayjs(), 'day')
          if (diff < 0) expireStatus = '已过期'
          else if (diff === 0) expireStatus = '今天到期'
          else if (diff <= 30) expireStatus = `${diff}天后到期（即将到期）`
          else expireStatus = `${diff}天后到期`
        }

        return {
          '证件类型': record.doc_type || '-',
          '证件号': record.doc_no || '-',
          '所属对象': record.subject_display || '-',
          '到期日': expireDate || '-',
          '到期状态': expireStatus,
          '备注': record.remark || '-',
        }
      })

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '证件列表')
      
      const fileName = `证件列表_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      XLSX.writeFile(wb, fileName)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败：' + (error as Error).message)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <div>
          <h2 style={{ marginBottom: 0 }}>文档与证件管理</h2>
          <p style={{ color: '#666' }}>集中管理车辆、人员、公司等证件，掌握到期情况</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button type="primary" icon={<FileAddOutlined />} onClick={() => setCreateModalOpen(true)}>
            新增证件
          </Button>
        </Space>
      </Flex>

      <Tabs
        items={[
          {
            key: 'list',
            label: '证件列表',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* KPI统计卡片 */}
                {statsQuery.data?.top_types && statsQuery.data.top_types.length > 0 && (
                  <Row gutter={16}>
                    {statsQuery.data.top_types.slice(0, 6).map((item) => (
                      <Col span={4} key={item.doc_type}>
                        <Card>
                          <Statistic
                            title={item.doc_type}
                            value={item.count}
                            suffix="个"
                            valueStyle={{ color: '#1677ff', fontSize: '24px' }}
                          />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
                
                <Flex gap={16} wrap>
                  <Select
                    style={{ width: 220 }}
                    value={filters.category}
                    onChange={(value) => setFilters((prev) => ({ ...prev, category: value, doc_type: undefined, page: 1 }))}
                    options={categoryOptions}
                  />
                  <Select
                    style={{ width: 180 }}
                    allowClear
                    placeholder="证件类型"
                    options={docTypeOptions[filters.category] || []}
                    value={filters.doc_type}
                    onChange={(value) => setFilters((prev) => ({ ...prev, doc_type: value || undefined, page: 1 }))}
                  />
                  <Input
                    style={{ width: 200 }}
                    placeholder="证件号/所属/备注"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                  />
                  <Select
                    style={{ width: 180 }}
                    allowClear
                    placeholder="到期筛选"
                    options={expireOptions}
                    value={filters.expire_status}
                    onChange={(value) => setFilters((prev) => ({ ...prev, expire_status: value || undefined, page: 1 }))}
                  />
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
                  loading={listQuery.isLoading}
                  columns={tableColumns}
                  dataSource={listQuery.data?.records || []}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                    columnWidth: 48,
                    selections: [
                      {
                        key: 'select-all-data',
                        text: '全选所有数据',
                        onSelect: () => {
                          const allKeys = (listQuery.data?.records || []).map((record) => record.id)
                          setSelectedRowKeys(allKeys)
                          message.success(`已全选 ${allKeys.length} 条数据`)
                        },
                      },
                      {
                        key: 'select-current-page',
                        text: '选择当前页',
                        onSelect: () => {
                          const records = listQuery.data?.records || []
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
                          const records = listQuery.data?.records || []
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
                    total: listQuery.data?.total,
                    showTotal: (total) => `共 ${total} 条`,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onChange: (page, pageSize) => setFilters((prev) => ({ ...prev, page, page_size: pageSize || prev.page_size })),
                  }}
                />
              </Space>
            ),
          },
          {
            key: 'stats',
            label: '统计分析',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                  {summaryCards.map((card) => (
                    <Col span={8} key={card.title}>
                      <Card>
                        <Statistic title={card.title} value={card.value} prefix={card.icon} />
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="按类别分布">
                      <Pie {...pieConfig} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="证件类型 Top10">
                      <Column {...topConfig} />
                    </Card>
                  </Col>
                </Row>
                <Card title="即将到期">
                  <List
                    dataSource={stats?.expiring_soon || []}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<FileProtectOutlined />} />}
                          title={item.doc_type}
                          description={`${item.subject_display || ''} · ${item.expire_date}`}
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
        width={800}
        title="证件详情"
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        destroyOnClose
      >
        {detailRecord ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card title="基本信息" size="small">
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="类型">{detailRecord.doc_type}</Descriptions.Item>
                <Descriptions.Item label="证件号">{detailRecord.doc_no}</Descriptions.Item>
                <Descriptions.Item label="所属">{detailRecord.subject_display || '-'}</Descriptions.Item>
                <Descriptions.Item label="到期日">{detailRecord.expire_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {detailRecord.remark || '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 识别信息 */}
            {detailRecord.extra && Object.keys(detailRecord.extra).length > 0 && (
              <Card title="识别信息" size="small">
                <Descriptions bordered size="small" column={2}>
                  {detailRecord.extra.owner && (
                    <Descriptions.Item label="所有人">{detailRecord.extra.owner}</Descriptions.Item>
                  )}
                  {detailRecord.extra.brand_model && (
                    <Descriptions.Item label="品牌型号">{detailRecord.extra.brand_model}</Descriptions.Item>
                  )}
                  {detailRecord.extra.vin && (
                    <Descriptions.Item label="车架号">{detailRecord.extra.vin}</Descriptions.Item>
                  )}
                  {detailRecord.extra.engine_no && (
                    <Descriptions.Item label="发动机号">{detailRecord.extra.engine_no}</Descriptions.Item>
                  )}
                  {detailRecord.extra.vehicle_type && (
                    <Descriptions.Item label="车辆类型">{detailRecord.extra.vehicle_type}</Descriptions.Item>
                  )}
                  {detailRecord.extra.usage && (
                    <Descriptions.Item label="使用性质">{detailRecord.extra.usage}</Descriptions.Item>
                  )}
                  {detailRecord.extra.register_date && (
                    <Descriptions.Item label="注册日期">{detailRecord.extra.register_date}</Descriptions.Item>
                  )}
                  {detailRecord.extra.scope && (
                    <Descriptions.Item label="经营范围">{detailRecord.extra.scope}</Descriptions.Item>
                  )}
                  {detailRecord.extra.dimensions && (
                    <Descriptions.Item label="外廓尺寸">{detailRecord.extra.dimensions}</Descriptions.Item>
                  )}
                  {detailRecord.extra.capacity && (
                    <Descriptions.Item label="核定载质量">{detailRecord.extra.capacity}</Descriptions.Item>
                  )}
                  {detailRecord.extra.company && (
                    <Descriptions.Item label="保险公司">{detailRecord.extra.company}</Descriptions.Item>
                  )}
                  {detailRecord.extra.product && (
                    <Descriptions.Item label="险种">{detailRecord.extra.product}</Descriptions.Item>
                  )}
                  {detailRecord.extra.premium && (
                    <Descriptions.Item label="保费">{detailRecord.extra.premium}</Descriptions.Item>
                  )}
                  {detailRecord.extra.effective_date && (
                    <Descriptions.Item label="生效日期">{detailRecord.extra.effective_date}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {/* 证件照片 */}
            {detailRecord.assets && detailRecord.assets.length > 0 && (
              <Card title="证件照片" size="small">
                <Row gutter={[16, 16]}>
                  {detailRecord.assets.map((item, index) => {
                    // 如果URL是相对路径，添加API域名前缀
                    const imageUrl = item.file_url.startsWith('http') 
                      ? item.file_url 
                      : `https://api.hodaruner.cn${item.file_url}`
                    
                    return (
                      <Col span={12} key={index}>
                        <Card
                          hoverable
                          cover={
                            <img
                              src={imageUrl}
                              alt={item.file_name || '证件照片'}
                              style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                            />
                          }
                        >
                          <Card.Meta
                            description={
                              <a href={imageUrl} target="_blank" rel="noreferrer">
                                {item.file_name || '查看原图'}
                              </a>
                            }
                          />
                        </Card>
                      </Col>
                    )
                  })}
                </Row>
              </Card>
            )}
          </Space>
        ) : (
          <p>暂无数据</p>
        )}
      </Drawer>

      <Modal
        title="新增证件"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
        width={720}
      >
        <Form form={form} layout="vertical" initialValues={{ category: filters.category }}>
          <Form.Item label="证件类别" name="category" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item label="证件类型" name="doc_type" rules={[{ required: true }]}>
            <Input placeholder="如：驾驶证、行驶证" />
          </Form.Item>
          <Form.Item label="证件号码" name="doc_no" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="所属对象" name="subject_display">
            <Input placeholder="如：司机姓名/车牌号" />
          </Form.Item>
          <Form.Item label="所属标识" name="subject_identifier">
            <Input placeholder="用于精确匹配的ID" />
          </Form.Item>
          <Form.Item label="到期日期" name="expire_date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="附件" name="assets">
            <Upload
              multiple
              listType="picture-card"
              beforeUpload={handleUploadAsset}
              showUploadList={false}
            >
              <CloudUploadOutlined /> 上传
            </Upload>
            <Space wrap>
              {(form.getFieldValue('assets') || []).map((asset: { file_url: string; file_name?: string }, index: number) => (
                <Card
                  key={`${asset.file_url}-${index}`}
                  size="small"
                  hoverable
                  cover={<img src={asset.file_url} alt={asset.file_name || '附件'} />}
                  style={{ width: 120 }}
                />
              ))}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑证件"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingRecord(null)
          editForm.resetFields()
        }}
        onOk={handleUpdate}
        confirmLoading={updateMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="证件类型" name="doc_type" rules={[{ required: true }]}>
            <Input placeholder="如：驾驶证、行驶证" />
          </Form.Item>
          <Form.Item label="证件号码" name="doc_no" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="到期日期" name="expire_date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default DocumentsPage

