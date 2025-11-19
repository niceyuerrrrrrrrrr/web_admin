import { useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudDownloadOutlined, CloudUploadOutlined, HistoryOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ExportJobRecord, ExportTemplateRecord } from '../api/types'
import {
  createExportJob,
  createExportTemplate,
  deleteExportTemplate,
  downloadExportJob,
  fetchExportJobs,
  fetchExportModules,
  fetchExportTemplates,
} from '../api/services/exportCenter'

const ExportCenterPage = () => {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm()
  const [jobForm] = Form.useForm()
  const queryClient = useQueryClient()
  const [jobModalVisible, setJobModalVisible] = useState(false)

  const modulesQuery = useQuery({
    queryKey: ['export-modules'],
    queryFn: fetchExportModules,
  })
  const templatesQuery = useQuery({
    queryKey: ['export-templates'],
    queryFn: fetchExportTemplates,
  })
  const jobsQuery = useQuery({
    queryKey: ['export-jobs'],
    queryFn: fetchExportJobs,
  })

  const templateMutation = useMutation({
    mutationFn: (values: any) => createExportTemplate(values),
    onSuccess: () => {
      message.success('模板已保存')
      queryClient.invalidateQueries({ queryKey: ['export-templates'] })
      form.resetFields()
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => deleteExportTemplate(id),
    onSuccess: () => {
      message.success('已删除模板')
      queryClient.invalidateQueries({ queryKey: ['export-templates'] })
    },
  })

  const jobMutation = useMutation({
    mutationFn: (values: any) => createExportJob(values),
    onSuccess: () => {
      message.success('导出任务已完成')
      queryClient.invalidateQueries({ queryKey: ['export-jobs'] })
      setJobModalVisible(false)
      jobForm.resetFields()
    },
  })

  const handleTemplateSubmit = () => {
    form.validateFields().then((values) => {
      let filtersObj: Record<string, any> = {}
      if (values.filters) {
        try {
          filtersObj = JSON.parse(values.filters)
        } catch (error) {
          message.error('过滤条件必须为 JSON 格式')
          return
        }
      }
      templateMutation.mutate({
        ...values,
        filters: filtersObj,
      })
    })
  }

  const handleJobSubmit = () => {
    jobForm.validateFields().then((values) => {
      let paramsObj: Record<string, any> = {}
      if (values.params) {
        try {
          paramsObj = JSON.parse(values.params)
        } catch (error) {
          message.error('过滤参数必须为 JSON 格式')
          return
        }
      }
      jobMutation.mutate({
        module: values.module,
        params: paramsObj,
      })
    })
  }

  const templateColumns: ColumnsType<ExportTemplateRecord> = [
    { title: '模板名称', dataIndex: 'name' },
    { title: '模块', dataIndex: 'module' },
    {
      title: '字段',
      dataIndex: 'fields',
      render: (fields: string[]) => fields.map((field) => <Tag key={field}>{field}</Tag>),
    },
    { title: '创建时间', dataIndex: 'created_at' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => deleteTemplateMutation.mutate(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const jobColumns: ColumnsType<ExportJobRecord> = [
    { title: '模块', dataIndex: 'module' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => <Tag color={status === 'completed' ? 'green' : 'orange'}>{status}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at' },
    { title: '完成时间', dataIndex: 'completed_at' },
    {
      title: '操作',
      render: (_, record) => (
        <Button
          type="link"
          icon={<CloudDownloadOutlined />}
          onClick={() => {
            downloadExportJob(record.id).then((res) => {
              const blob = new Blob([res.data], { type: 'text/csv' })
              const url = window.URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', record.file_name || 'export.csv')
              document.body.appendChild(link)
              link.click()
              link.remove()
            })
          }}
        >
          下载
        </Button>
      ),
    },
  ]

  return (
    <>
      <Tabs
        items={[
        {
          key: 'templates',
          label: (
            <Space>
              <CloudUploadOutlined />
              导出模板
            </Space>
          ),
          children: (
            <Row gutter={16}>
              <Col span={10}>
                <Card title="新建模板">
                  <Form form={form} layout="vertical">
                    <Form.Item label="模板名称" name="name" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="数据模块" name="module" rules={[{ required: true }]}>
                      <Select options={modulesQuery.data?.modules.map((m) => ({ label: m.label, value: m.module }))} />
                    </Form.Item>
                    <Form.Item label="字段" name="fields" rules={[{ required: true }]}>
                      <Select
                        mode="tags"
                        placeholder="请输入字段名称"
                        tokenSeparators={[',']}
                      />
                    </Form.Item>
                    <Form.Item label="过滤条件(JSON)" name="filters">
                      <Input.TextArea rows={3} placeholder='例如 {"status":"approved"}' />
                    </Form.Item>
                    <Button type="primary" loading={templateMutation.isPending} onClick={handleTemplateSubmit}>
                      保存模板
                    </Button>
                  </Form>
                </Card>
              </Col>
              <Col span={14}>
                <Card title="模板列表">
                  <Table rowKey="id" loading={templatesQuery.isLoading} dataSource={templatesQuery.data?.records || []} columns={templateColumns} />
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: 'history',
          label: (
            <Space>
              <HistoryOutlined />
              导出历史
            </Space>
          ),
          children: (
            <Card
              title="导出任务"
              extra={
                <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => setJobModalVisible(true)}>
                  发起导出
                </Button>
              }
            >
              <Table rowKey="id" loading={jobsQuery.isLoading} dataSource={jobsQuery.data?.records || []} columns={jobColumns} />
            </Card>
          ),
        },
        ]}
      />
      <Modal
        open={jobModalVisible}
        title="新建导出任务"
        destroyOnClose
        onCancel={() => setJobModalVisible(false)}
        onOk={handleJobSubmit}
        confirmLoading={jobMutation.isPending}
      >
        <Form form={jobForm} layout="vertical">
          <Form.Item label="数据模块" name="module" rules={[{ required: true }]}>
            <Select options={modulesQuery.data?.modules.map((m) => ({ label: m.label, value: m.module }))} />
          </Form.Item>
          <Form.Item label="过滤参数(JSON)" name="params">
            <Input.TextArea rows={3} placeholder='例如 {"date_range":["2024-01-01","2024-01-31"]}' />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default ExportCenterPage

