import { useEffect } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import {
  BellOutlined,
  CheckCircleOutlined,
  MailOutlined,
  NotificationOutlined,
  SettingOutlined,
  SkinOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type {
  NoticeRecord,
  SystemAttendanceConfig,
  SystemApprovalConfig,
  SystemBaseConfig,
  SystemConfigResponse,
  SystemNotificationConfig,
} from '../api/types'
import { fetchSystemConfig, saveSystemConfig } from '../api/services/systemConfig'
import { fetchNoticeStats } from '../api/services/notice'

const { Title, Paragraph } = Typography

const SettingsPage = () => {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: ['system-config'],
    queryFn: fetchSystemConfig,
  })

  const statsQuery = useQuery({
    queryKey: ['notice', 'stats'],
    queryFn: () => fetchNoticeStats(),
  })

  const saveMutation = useMutation({
    mutationFn: saveSystemConfig,
    onSuccess: () => {
      message.success('系统配置已保存')
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
    },
    onError: (error) => message.error((error as Error).message || '保存失败'),
  })

  useEffect(() => {
    if (configQuery.data) {
      const config = configQuery.data as SystemConfigResponse
      form.setFieldsValue({
        base: config.base,
        approval: config.approval,
        attendance: {
          ...config.attendance,
          fence_center:
            config.attendance.fence_center && config.attendance.fence_center.lat
              ? `${config.attendance.fence_center.lat},${config.attendance.fence_center.lng}`
              : '',
        },
        notification: config.notification,
      })
    }
  }, [configQuery.data, form])

  const handleSave = () => {
    form.validateFields().then((values) => {
      const payload = {
        base: values.base as SystemBaseConfig,
        approval: {
          reminder_channel: values.approval?.reminder_channel || [],
          auto_remind_hours: values.approval?.auto_remind_hours || 24,
          enable_auto_escalation: !!values.approval?.enable_auto_escalation,
        } as SystemApprovalConfig,
        attendance: {
          workdays: values.attendance?.workdays || [],
          work_start: values.attendance?.work_start || '09:00',
          work_end: values.attendance?.work_end || '18:00',
          fence_radius: values.attendance?.fence_radius || 200,
          fence_center:
            values.attendance?.fence_center && values.attendance.fence_center.includes(',')
              ? {
                  lat: parseFloat(values.attendance.fence_center.split(',')[0].trim()),
                  lng: parseFloat(values.attendance.fence_center.split(',')[1].trim()),
                }
              : undefined,
        } as SystemAttendanceConfig,
        notification: {
          sms_enabled: values.notification?.sms_enabled || false,
          sms_channel: values.notification?.sms_channel,
          email_enabled: values.notification?.email_enabled || false,
          email_sender: values.notification?.email_sender,
          wecom_enabled: values.notification?.wecom_enabled || false,
          wecom_webhook: values.notification?.wecom_webhook,
        } as SystemNotificationConfig,
      }
      saveMutation.mutate(payload)
    })
  }

  const stats = statsQuery.data ?? {
    summary: { total: 0, published: 0, urgent: 0, read_count: 0 },
    top_notices: [],
  }
  const noticeColumns: ColumnsType<NoticeRecord> = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (text, record) => (
        <Space>
          {record.is_urgent && <Tag color="red">紧急</Tag>}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'notice_type',
    },
    {
      title: '阅读数',
      dataIndex: 'read_count',
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          系统配置中心
        </Title>
        <Paragraph type="secondary">
          统一管理系统基础信息、审批策略、考勤规则和全渠道通知。
        </Paragraph>
      </div>

      <Form form={form} layout="vertical">
        <Tabs
          items={[
            {
              key: 'base',
              label: (
                <Space>
                  <SkinOutlined />
                  基础配置
                </Space>
              ),
              children: (
                <Card>
                  <Form.Item label="系统名称" name={['base', 'system_name']} rules={[{ required: true }]}>
                    <Input placeholder="如 智能调度平台" />
                  </Form.Item>
                  <Form.Item label="Logo 地址" name={['base', 'logo_url']}>
                    <Input placeholder="https://..." />
                  </Form.Item>
                  <Form.Item label="默认公司 ID" name={['base', 'default_company_id']}>
                    <InputNumber className="w-full" placeholder="如 10001" />
                  </Form.Item>
                  <Form.Item label="主题色" name={['base', 'theme_color']}>
                    <Input placeholder="#1677ff" />
                  </Form.Item>
                </Card>
              ),
            },
            {
              key: 'approval',
              label: (
                <Space>
                  <ThunderboltOutlined />
                  审批配置
                </Space>
              ),
              children: (
                <Card>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="提醒渠道" name={['approval', 'reminder_channel']}>
                        <Select mode="multiple" placeholder="选择渠道">
                          <Select.Option value="sms">短信</Select.Option>
                          <Select.Option value="email">邮件</Select.Option>
                          <Select.Option value="wecom">企业微信</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="自动提醒间隔(小时)" name={['approval', 'auto_remind_hours']}>
                        <InputNumber min={1} className="w-full" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="启用自动升级到上级审批人" name={['approval', 'enable_auto_escalation']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Card>
              ),
            },
            {
              key: 'attendance',
              label: (
                <Space>
                  <NotificationOutlined />
                  考勤配置
                </Space>
              ),
              children: (
                <Card>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="工作日" name={['attendance', 'workdays']}>
                        <Select mode="multiple" placeholder="选择工作日">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <Select.Option key={day} value={day}>
                              {day}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="上班时间" name={['attendance', 'work_start']}>
                        <Input placeholder="09:00" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="下班时间" name={['attendance', 'work_end']}>
                        <Input placeholder="18:00" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="围栏半径(米)" name={['attendance', 'fence_radius']}>
                        <InputNumber min={50} className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="围栏中心点" name={['attendance', 'fence_center']} extra="格式：纬度,经度">
                        <Input placeholder="23.1291,113.2644" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
            {
              key: 'notification',
              label: (
                <Space>
                  <BellOutlined />
                  通知配置
                </Space>
              ),
              children: (
                <Card>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="短信通知" name={['notification', 'sms_enabled']} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="邮件通知" name={['notification', 'email_enabled']} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="企业微信" name={['notification', 'wecom_enabled']} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="短信渠道" name={['notification', 'sms_channel']}>
                    <Input placeholder="阿里云/腾讯云等" />
                  </Form.Item>
                  <Form.Item label="邮件发件人" name={['notification', 'email_sender']}>
                    <Input placeholder="noreply@company.com" />
                  </Form.Item>
                  <Form.Item label="企业微信 Webhook" name={['notification', 'wecom_webhook']}>
                    <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook..." />
                  </Form.Item>
                </Card>
              ),
            },
          ]}
        />
        <Row justify="end" style={{ marginTop: 16 }}>
          <Button type="primary" onClick={handleSave} loading={saveMutation.isPending}>
            保存配置
          </Button>
        </Row>
      </Form>

      <Card title="通知公告统计" extra={<SettingOutlined />} style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="公告总数" value={stats?.summary.total ?? 0} prefix={<MailOutlined />} />
          </Col>
          <Col span={6}>
            <Statistic title="已发布" value={stats?.summary.published ?? 0} prefix={<CheckCircleOutlined />} />
          </Col>
          <Col span={6}>
            <Statistic title="紧急公告" value={stats?.summary.urgent ?? 0} prefix={<ThunderboltOutlined />} />
          </Col>
          <Col span={6}>
            <Statistic title="总阅读" value={stats?.summary.read_count ?? 0} prefix={<NotificationOutlined />} />
          </Col>
        </Row>
        <Table
          rowKey="id"
          columns={noticeColumns}
          dataSource={stats.top_notices as NoticeRecord[]}
          pagination={false}
          style={{ marginTop: 24 }}
        />
      </Card>
    </Space>
  )
}

export default SettingsPage
