import { useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileAddOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
  ScheduleOutlined,
  TableOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { CustomReportRecord, ReportHistoryRecord } from '../api/types'
import {
  createReport,
  deleteReport,
  exportReport,
  fetchReportHistory,
  fetchReportModules,
  fetchReports,
  runReport,
  updateReport,
} from '../api/services/reportBuilder'

const ReportBuilderPage = () => {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<CustomReportRecord | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyRecords, setHistoryRecords] = useState<ReportHistoryRecord[]>([])

  const modulesQuery = useQuery({
    queryKey: ['report-modules'],
    queryFn: fetchReportModules,
  })
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })

  const upsertMutation = useMutation({
    mutationFn: (values: any) => {
      if (editing?.id) {
        return updateReport(editing.id, values)
      }
      return createReport(values)
    },
    onSuccess: () => {
      message.success('报表已保存')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setEditing(null)
      form.resetFields()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteReport(id),
    onSuccess: () => {
      message.success('报表已删除')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })

  const handleEdit = (record?: CustomReportRecord) => {
    setEditing(record || { id: 0, name: '', module: '', fields: [], filters: {} })
    form.setFieldsValue({
      ...record,
      fields: record?.fields?.map((field) => field.alias || field.field || field.name) || [],
      export_formats: record?.export_formats?.length ? record.export_formats : ['csv'],
    })
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      upsertMutation.mutate({
        ...values,
        fields: (values.fields || []).map((field: string) => ({ field, alias: field })),
        export_formats: values.export_formats || ['csv'],
      })
    })
  }

  const moduleValue = Form.useWatch('module', form)
  const moduleFields = useMemo(() => {
    const current = modulesQuery.data?.modules.find((m) => m.module === moduleValue)
    return current?.fields || []
  }, [modulesQuery.data?.modules, moduleValue])

  const runMutation = useMutation({
    mutationFn: (id: number) => runReport(id),
    onSuccess: (data) => {
      setPreviewRows(data.rows)
      message.success('报表已运行')
    },
  })

  const handleExport = (id: number) => {
    exportReport(id).then((response) => {
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `report-${id}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    })
  }

  const showHistory = (id: number) => {
    fetchReportHistory(id).then((res) => {
      setHistoryRecords(res.records)
      setHistoryVisible(true)
    })
  }

  const reportColumns: ColumnsType<CustomReportRecord> = [
    { title: '报表名称', dataIndex: 'name' },
    { title: '模块', dataIndex: 'module' },
    {
      title: '字段',
      dataIndex: 'fields',
      render: (fields: any[]) => fields?.map((f) => <Tag key={f.alias || f.field}>{f.alias || f.field}</Tag>),
    },
    {
      title: '导出格式',
      dataIndex: 'export_formats',
      render: (formats: string[]) => (formats || []).map((f) => <Tag key={f}>{f.toUpperCase()}</Tag>),
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<TableOutlined />} onClick={() => showHistory(record.id)}>
            历史
          </Button>
          <Button type="link" icon={<PlayCircleOutlined />} loading={runMutation.isPending} onClick={() => runMutation.mutate(record.id)}>
            运行
          </Button>
          <Button type="link" icon={<LineChartOutlined />} onClick={() => handleExport(record.id)}>
            导出
          </Button>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <FileAddOutlined />
            自定义报表设计
          </Space>
        }
        extra={
          <Button type="primary" icon={<FileAddOutlined />} onClick={() => handleEdit()}>
            新建报表
          </Button>
        }
      >
        <Table rowKey="id" loading={reportsQuery.isLoading} dataSource={reportsQuery.data?.records || []} columns={reportColumns} />
      </Card>

      <Card
        title={
          <Space>
            <ScheduleOutlined />
            运行结果预览
          </Space>
        }
      >
        <Table
          rowKey={(_, index) => (index !== undefined ? index.toString() : '')}
          dataSource={previewRows}
          columns={(previewRows[0] ? Object.keys(previewRows[0]) : []).map((key) => ({
            dataIndex: key,
            title: key,
          }))}
          pagination={false}
          locale={{ emptyText: '暂无数据，请运行报表。' }}
        />
      </Card>

      <Drawer
        title={editing?.id ? '编辑报表' : '新建报表'}
        width={600}
        open={!!editing}
        destroyOnClose
        onClose={() => {
          setEditing(null)
          form.resetFields()
        }}
        extra={
          <Space>
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" loading={upsertMutation.isPending} onClick={handleSubmit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} initialValues={{ export_formats: ['csv'] }}>
          <Form.Item label="报表名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="数据模块" name="module" rules={[{ required: true, message: '请选择模块' }]}>
            <Select options={modulesQuery.data?.modules.map((m) => ({ label: m.label, value: m.module }))} />
          </Form.Item>
          <Form.Item label="字段选择" name="fields">
            <Select mode="multiple" options={moduleFields.map((field) => ({ label: field, value: field }))} placeholder="选择需要展示的字段" />
          </Form.Item>
          <Form.Item label="导出格式" name="export_formats">
            <Select mode="multiple" options={['csv', 'xlsx', 'pdf'].map((value) => ({ label: value.toUpperCase(), value }))} />
          </Form.Item>
          <Form.Item label="定时规则 (CRON)" name="schedule_cron">
            <Input placeholder="如 0 8 * * * 每天8点" />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal open={historyVisible} width={640} footer={null} onCancel={() => setHistoryVisible(false)} title="运行历史">
        <Table
          rowKey="id"
          dataSource={historyRecords}
          columns={[
            { title: '时间', dataIndex: 'created_at' },
            { title: '状态', dataIndex: 'status' },
            { title: '行数', dataIndex: 'generated_rows' },
            { title: '导出文件', dataIndex: 'export_url' },
          ]}
          pagination={false}
        />
      </Modal>
    </Space>
  )
}

export default ReportBuilderPage

