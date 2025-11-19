import { useMemo, useState } from 'react'
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
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FileAddOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { DocumentRecord, DocumentStats } from '../api/types'
import {
  createDocument,
  deleteDocument,
  fetchDocumentStats,
  fetchDocuments,
  uploadDocumentAsset,
} from '../api/services/documents'
import dayjs from 'dayjs'

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

const DocumentsPage = () => {
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
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
  const [form] = Form.useForm()

  const listQuery = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => fetchDocuments(filters),
    enabled: !!filters.category,
  })

  const statsQuery = useQuery({
    queryKey: ['documents', 'stats', filters.category],
    queryFn: () =>
      fetchDocumentStats({
        category: filters.category,
      }),
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
      render: (text, record) => (
        <Space>
          <Tag>{record.category}</Tag>
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '证件号',
      dataIndex: 'doc_no',
    },
    {
      title: '所属对象',
      dataIndex: 'subject_display',
    },
    {
      title: '到期日',
      dataIndex: 'expire_date',
      render: (value) => {
        if (!value) return '-'
        const diff = dayjs(value).diff(dayjs(), 'day')
        let color = 'green'
        if (diff < 0) color = 'red'
        else if (diff <= 30) color = 'orange'
        return (
          <Space>
            <Tag color={color}>{value}</Tag>
            <span>{diff < 0 ? '已过期' : diff === 0 ? '今天到期' : `${diff}天后到期`}</span>
          </Space>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<FileSearchOutlined />} onClick={() => setDetailRecord(record)}>
            查看
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
      type: 'outer',
      content: '{name} {percentage}',
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
                <Flex gap={16} wrap>
                  <Select
                    style={{ width: 220 }}
                    value={filters.category}
                    onChange={(value) => setFilters((prev) => ({ ...prev, category: value, page: 1 }))}
                    options={categoryOptions}
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
                <Table
                  rowKey="id"
                  loading={listQuery.isLoading}
                  columns={tableColumns}
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
        width={640}
        title="证件详情"
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        destroyOnClose
      >
        {detailRecord ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="类型">{detailRecord.doc_type}</Descriptions.Item>
              <Descriptions.Item label="证件号">{detailRecord.doc_no}</Descriptions.Item>
              <Descriptions.Item label="所属">{detailRecord.subject_display || '-'}</Descriptions.Item>
              <Descriptions.Item label="到期日">{detailRecord.expire_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailRecord.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
            <List
              header="附件"
              dataSource={detailRecord.assets || []}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Avatar shape="square" src={item.file_thumb || item.file_url} size={64} />
                    <a href={item.file_url} target="_blank" rel="noreferrer">
                      {item.file_name || '预览附件'}
                    </a>
                  </Space>
                </List.Item>
              )}
            />
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
    </Space>
  )
}

export default DocumentsPage

