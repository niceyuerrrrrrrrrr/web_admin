import { Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleTwoTone,
  ExclamationCircleTwoTone,
  ClockCircleTwoTone,
} from '@ant-design/icons'

const { Title, Paragraph } = Typography

const summaryMetrics = [
  { title: '今日审批通过', value: 38, suffix: '单' },
  { title: '今日审批拒绝', value: 6, suffix: '单' },
  { title: '运行车辆', value: 128, suffix: '台' },
  { title: '本月碳排放', value: 12.6, suffix: '吨' },
]

const approvalColumns: ColumnsType<ApprovalRow> = [
  { title: '审批编号', dataIndex: 'code', width: 140 },
  { title: '发起人', dataIndex: 'applicant' },
  { title: '类型', dataIndex: 'type' },
  { title: '所属公司', dataIndex: 'company' },
  {
    title: '状态',
    dataIndex: 'status',
    render: (status: ApprovalRow['status']) => {
      const statusMap = {
        approved: { color: 'green', label: '已通过' },
        rejected: { color: 'red', label: '已驳回' },
        pending: { color: 'blue', label: '待审批' },
      }
      return <Tag color={statusMap[status].color}>{statusMap[status].label}</Tag>
    },
  },
]

const approvalMock: ApprovalRow[] = [
  {
    key: 1,
    code: 'AP20250218001',
    applicant: '李华',
    type: '费用报销',
    company: '江苏总部',
    status: 'pending',
  },
  {
    key: 2,
    code: 'AP20250217002',
    applicant: '赵强',
    type: '出车申请',
    company: '华东车队',
    status: 'approved',
  },
  {
    key: 3,
    code: 'AP20250216003',
    applicant: '陈敏',
    type: '采购审批',
    company: '安徽运力',
    status: 'rejected',
  },
]

interface ApprovalRow {
  key: number
  code: string
  applicant: string
  type: string
  company: string
  status: 'approved' | 'rejected' | 'pending'
}

const statusIcons = {
  approved: <CheckCircleTwoTone twoToneColor="#52c41a" />,
  rejected: <ExclamationCircleTwoTone twoToneColor="#ff4d4f" />,
  pending: <ClockCircleTwoTone twoToneColor="#1677ff" />,
}

const DashboardPage = () => {
  return (
    <div>
      <Title level={3}>数据总览</Title>
      <Paragraph type="secondary">
        汇集审批、车辆、能耗等核心指标，帮助管理层实时掌握运营情况。
      </Paragraph>
      <Row gutter={[16, 16]}>
        {summaryMetrics.map((metric) => (
          <Col span={6} key={metric.title}>
            <Card className="dashboard-card">
              <Statistic
                title={metric.title}
                value={metric.value}
                suffix={metric.suffix}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {(['approved', 'pending', 'rejected'] as const).map((status) => (
          <Col span={8} key={status}>
            <Card>
              <Space align="center" size="large">
                {statusIcons[status]}
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    {status === 'approved'
                      ? '今日已通过'
                      : status === 'pending'
                        ? '待审批'
                        : '今日驳回'}
                  </Title>
                  <Paragraph style={{ margin: 0 }} type="secondary">
                    最近 24 小时的审批动态
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="审批实时列表" style={{ marginTop: 16 }}>
        <Table
          rowKey="key"
          columns={approvalColumns}
          dataSource={approvalMock}
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default DashboardPage
