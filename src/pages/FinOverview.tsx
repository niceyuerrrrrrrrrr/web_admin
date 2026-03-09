import { useState, useMemo } from 'react'
import {
  Card,
  Col,
  Row,
  Statistic,
  Button,
  Space,
  Typography,
  Empty,
  Spin,
  Alert,
} from 'antd'
import { Line, Pie, Column } from '@ant-design/plots'
import dayjs from 'dayjs'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  DollarOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useCompanyStore from '../store/company'
import useAuthStore from '../store/auth'
import client from '../api/client'
import { fetchFinAccounts } from '../api/services/finBase'
import type { FinAccountRecord } from '../api/types'

const { Title, Text } = Typography

// 获取财务概览真实数据
const fetchFinancialOverview = async (companyId: number | null) => {
  const params: any = {}
  if (companyId) params.company_id = companyId
  
  const response = await client.get('/fin/overview', { params })
  if (!response.data.success) {
    throw new Error(response.data.message || '获取财务数据失败')
  }
  
  const data = response.data.data
  return {
    accounts: {
      totalBalance: (data.accounts?.totalBalance || 0) / 100,
      balanceChange: data.accounts?.balanceChange || 0,
    },
    monthly: {
      income: (data.monthly?.income || 0) / 100,
      incomeChange: data.monthly?.incomeChange || 0,
      expense: (data.monthly?.expense || 0) / 100,
      expenseChange: data.monthly?.expenseChange || 0,
    },
    receivable: {
      total: (data.receivable?.total || 0) / 100,
      overdue: (data.receivable?.overdue || 0) / 100,
    },
    payable: {
      total: (data.payable?.total || 0) / 100,
      overdue: (data.payable?.overdue || 0) / 100,
    },
    pending: {
      cashInCount: data.pending?.cashInCount || 0,
      cashOutCount: data.pending?.cashOutCount || 0,
      arReceiptCount: data.pending?.arReceiptCount || 0,
      apPaymentCount: data.pending?.apPaymentCount || 0,
    },
  }
}

const FinOverview = () => {
  const navigate = useNavigate()
  const { selectedCompanyId } = useCompanyStore()
  const { user } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-overview', selectedCompanyId],
    queryFn: () => fetchFinancialOverview(selectedCompanyId ?? null),
    enabled: !!selectedCompanyId || !!user,
  })

  const accountsQuery = useQuery({
    queryKey: ['fin', 'accounts', 'overview', selectedCompanyId],
    queryFn: () => fetchFinAccounts({ companyId: selectedCompanyId ?? undefined, activeOnly: true }),
    enabled: !!selectedCompanyId || !!user,
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={(error as Error).message || '无法加载财务数据'}
        type="error"
        showIcon
      />
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          财务概览
        </Title>
        <Text type="secondary">实时查看财务数据和待办事项</Text>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="账户总余额"
              value={data?.accounts.totalBalance || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#3f8600' }}
              suffix={
                <span style={{ fontSize: 14 }}>
                  {data?.accounts.balanceChange && data.accounts.balanceChange > 0 ? (
                    <>
                      <ArrowUpOutlined /> {data.accounts.balanceChange}%
                    </>
                  ) : (
                    <>
                      <ArrowDownOutlined /> {Math.abs(data?.accounts.balanceChange || 0)}%
                    </>
                  )}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="本月收入"
              value={data?.monthly.income || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
              suffix={
                <span style={{ fontSize: 14 }}>
                  {data?.monthly.incomeChange && data.monthly.incomeChange > 0 ? (
                    <>
                      <ArrowUpOutlined /> {data.monthly.incomeChange}%
                    </>
                  ) : (
                    <>
                      <ArrowDownOutlined /> {Math.abs(data?.monthly.incomeChange || 0)}%
                    </>
                  )}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="本月支出"
              value={data?.monthly.expense || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
              suffix={
                <span style={{ fontSize: 14 }}>
                  {data?.monthly.expenseChange && data.monthly.expenseChange < 0 ? (
                    <>
                      <ArrowDownOutlined /> {Math.abs(data.monthly.expenseChange)}%
                    </>
                  ) : (
                    <>
                      <ArrowUpOutlined /> {data?.monthly.expenseChange || 0}%
                    </>
                  )}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="待收款金额"
              value={data?.receivable.total || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
            {data?.receivable.overdue && data.receivable.overdue > 0 && (
              <Text type="danger" style={{ fontSize: 12 }}>
                逾期：¥{data.receivable.overdue.toFixed(2)}
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 待办事项 */}
      <Card title="待办事项" bordered={false}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/fin/cash-in')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="待审批收款单"
                value={data?.pending.cashInCount || 0}
                suffix="笔"
                prefix={<FileTextOutlined />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/fin/cash-out')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="待审批付款单"
                value={data?.pending.cashOutCount || 0}
                suffix="笔"
                prefix={<FileTextOutlined />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/fin/ar')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="逾期应收款"
                value={data?.receivable.overdue || 0}
                prefix="¥"
                precision={2}
                valueStyle={{ fontSize: 20, color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              hoverable
              onClick={() => navigate('/fin/ap')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="逾期应付款"
                value={data?.payable.overdue || 0}
                prefix="¥"
                precision={2}
                valueStyle={{ fontSize: 20, color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 快捷操作 */}
      <Card title="快捷操作" bordered={false}>
        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/fin/cash-in')}
          >
            新建收款单
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/fin/cash-out')}
          >
            新建付款单
          </Button>
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/fin/ar-receipts')}
          >
            登记回款
          </Button>
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/fin/ap-payments')}
          >
            登记付款
          </Button>
          <Button
            icon={<DollarOutlined />}
            size="large"
            onClick={() => navigate('/fin/accounts')}
          >
            账户管理
          </Button>
        </Space>
      </Card>

      <Card title="账户分账户统计" bordered={false}>
        {accountsQuery.data?.records?.length ? (
          <Row gutter={[16, 16]}>
            {accountsQuery.data.records.map((account) => {
              const opening = Number(account.opening_balance_cents || 0) / 100
              const current = Number(account.balance_cents || 0) / 100
              const flow = current - opening

              return (
                <Col xs={24} sm={12} xl={8} key={account.id}>
                  <Card size="small">
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div>
                        <Text strong>{account.name}</Text>
                        <br />
                        <Text type="secondary">{account.type}</Text>
                      </div>

                      <Row gutter={12}>
                        <Col span={12}>
                          <Statistic title="当前余额" value={current} precision={2} prefix="¥" valueStyle={{ fontSize: 20, color: '#1677ff' }} />
                        </Col>
                        <Col span={12}>
                          <Statistic title="期初余额" value={opening} precision={2} prefix="¥" valueStyle={{ fontSize: 18 }} />
                        </Col>
                      </Row>

                      <Statistic
                        title="净流转"
                        value={flow}
                        precision={2}
                        prefix="¥"
                        valueStyle={{
                          fontSize: 18,
                          color: flow >= 0 ? '#3f8600' : '#cf1322',
                        }}
                      />
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        ) : (
          <Empty description="暂无账户数据" />
        )}
      </Card>

      {/* 数据可视化区域 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="收支趋势（近6个月）" bordered={false}>
            <IncomeTrendChart />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="账户余额分布" bordered={false}>
            <AccountBalanceChart accounts={accountsQuery.data?.records || []} />
          </Card>
        </Col>
      </Row>

      <Card title="账户余额明细（分账户）" bordered={false}>
        {accountsQuery.data?.records?.length ? (
          <Row gutter={[16, 16]}>
            {accountsQuery.data.records.map((account) => (
              <Col xs={24} sm={12} lg={8} key={account.id}>
                <Card size="small">
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong>{account.name}</Text>
                    <Text type="secondary">{account.type}</Text>
                    <Text style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>
                      ¥{((account.balance_cents || 0) / 100).toFixed(2)}
                    </Text>
                    <Text type="secondary">
                      期初：¥{((account.opening_balance_cents || 0) / 100).toFixed(2)}
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无账户数据" />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="应收应付对比" bordered={false}>
            <ARAPComparisonChart />
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

// 收支趋势图组件
const IncomeTrendChart = () => {
  // 生成近6个月的模拟数据
  const data = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const month = dayjs().subtract(i, 'month').format('YYYY-MM')
      months.push({
        month,
        type: '收入',
        value: Math.random() * 200000 + 100000,
      })
      months.push({
        month,
        type: '支出',
        value: Math.random() * 150000 + 80000,
      })
    }
    return months
  }, [])

  return (
    <Line
      data={data}
      xField="month"
      yField="value"
      seriesField="type"
      smooth={true}
      animation={{
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      }}
      color={['#52c41a', '#cf1322']}
      legend={{
        position: 'top' as const,
      }}
      yAxis={{
        label: {
          formatter: (v: string) => `¥${(Number(v) / 10000).toFixed(1)}万`,
        },
      }}
      tooltip={{
        formatter: (datum: any = {}) => {
          return {
            name: datum?.type || '未知',
            value: `¥${Number(datum?.value || 0).toFixed(2)}`,
          }
        },
      }}
      height={300}
    />
  )
}

// 账户余额分布图组件
const AccountBalanceChart = ({ accounts }: { accounts: FinAccountRecord[] }) => {
  const data = useMemo(
    () =>
      accounts.map((account) => ({
        type: account.name,
        value: Number(account.balance_cents || 0) / 100,
      })),
    [accounts],
  )

  if (!data.length) {
    return <Empty description="暂无账户余额数据" />
  }

  return (
    <Pie
      data={data}
      angleField="value"
      colorField="type"
      radius={0.8}
      innerRadius={0.6}
      label={{
        type: 'spider',
        formatter: (datum: any = {}) => {
          const type = datum?.type || '未知'
          const value = Number(datum?.value || 0)
          return `${type}\n¥${(value / 10000).toFixed(2)}万`
        },
      }}
      statistic={{
        title: {
          content: '总余额',
        },
        content: {
          formatter: () => {
            const total = data.reduce((sum, item) => sum + item.value, 0)
            return `¥${(total / 10000).toFixed(2)}万`
          },
        },
      }}
      height={300}
    />
  )
}

// 应收应付对比图组件
const ARAPComparisonChart = () => {
  // 模拟应收应付数据
  const data = useMemo(() => [
    { category: '应收账款', type: '总额', value: 456789 },
    { category: '应收账款', type: '已收', value: 256789 },
    { category: '应收账款', type: '未收', value: 200000 },
    { category: '应付账款', type: '总额', value: 334567 },
    { category: '应付账款', type: '已付', value: 134567 },
    { category: '应付账款', type: '未付', value: 200000 },
  ], [])

  return (
    <Column
      data={data}
      xField="category"
      yField="value"
      seriesField="type"
      isGroup={true}
      columnStyle={{
        radius: [4, 4, 0, 0],
      }}
      color={['#1890ff', '#52c41a', '#faad14']}
      legend={{
        position: 'top' as const,
      }}
      yAxis={{
        label: {
          formatter: (v: string) => `¥${(Number(v) / 10000).toFixed(1)}万`,
        },
      }}
      tooltip={{
        formatter: (datum: any = {}) => {
          return {
            name: datum?.type || '未知',
            value: `¥${Number(datum?.value || 0).toFixed(2)}`,
          }
        },
      }}
      label={{
        position: 'top' as const,
        formatter: (datum: any = {}) => `¥${(Number(datum?.value || 0) / 10000).toFixed(1)}万`,
      }}
      height={300}
    />
  )
}

export default FinOverview
