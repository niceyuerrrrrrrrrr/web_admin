import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Form,
  DatePicker,
  Select,
  Button,
  Table,
  Space,
  Typography,
  Divider,
  message,
  Spin,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  FileTextOutlined,
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import { generateSettlement, getPriceConfigs } from '../api/services/settlement'
import type { SettlementStatement, SettlementItem, PriceConfig } from '../api/services/settlement'
import { fetchDepartments } from '../api/services/departments'
import { fetchLoadingCompanies } from '../api/services/receipts'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const settlementCacheKey = (companyId?: number | null) =>
  companyId ? `settlement_statement:last:${companyId}` : `settlement_statement:last`

const SettlementStatementPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [statement, setStatement] = useState<SettlementStatement | null>(null)
  
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId

  // 获取部门列表
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', effectiveCompanyId],
    queryFn: () => fetchDepartments({ company_id: effectiveCompanyId }),
    enabled: !!effectiveCompanyId,
  })

  const departments = departmentsData?.records || []
  
  // 获取装料公司列表（从装料单据中获取）
  const { data: loadingCompaniesData } = useQuery({
    queryKey: ['loadingCompanies', effectiveCompanyId],
    queryFn: () => fetchLoadingCompanies({ companyId: effectiveCompanyId }),
    enabled: !!effectiveCompanyId,
  })

  const loadingCompanies = loadingCompaniesData || []

  // 计算最近的对账周期
  const calculateRecentReconciliationPeriod = (config: PriceConfig): [Dayjs, Dayjs] | null => {
    const { reconciliation_cycle_type, reconciliation_start_day, reconciliation_start_time, reconciliation_end_day, reconciliation_end_time } = config
    
    if (!reconciliation_cycle_type || !reconciliation_start_time || !reconciliation_end_time) {
      return null
    }

    const now = dayjs()
    let startDate: Dayjs
    let endDate: Dayjs

    if (reconciliation_cycle_type === 'natural_month') {
      // 自然月：每月1号到月末
      const currentMonth = now.startOf('month')
      startDate = currentMonth.hour(parseInt(reconciliation_start_time.split(':')[0])).minute(parseInt(reconciliation_start_time.split(':')[1])).second(parseInt(reconciliation_start_time.split(':')[2]))
      endDate = currentMonth.endOf('month').hour(parseInt(reconciliation_end_time.split(':')[0])).minute(parseInt(reconciliation_end_time.split(':')[1])).second(parseInt(reconciliation_end_time.split(':')[2]))
      
      // 如果当前时间已过本月结束时间，则取下个月
      if (now.isAfter(endDate)) {
        startDate = startDate.add(1, 'month')
        endDate = startDate.endOf('month').hour(parseInt(reconciliation_end_time.split(':')[0])).minute(parseInt(reconciliation_end_time.split(':')[1])).second(parseInt(reconciliation_end_time.split(':')[2]))
      }
    } else if (reconciliation_cycle_type === 'monthly') {
      // 按月：每月X号到次月Y号
      const currentMonth = now.month()
      const currentYear = now.year()
      
      startDate = dayjs().year(currentYear).month(currentMonth).date(reconciliation_start_day!).hour(parseInt(reconciliation_start_time.split(':')[0])).minute(parseInt(reconciliation_start_time.split(':')[1])).second(parseInt(reconciliation_start_time.split(':')[2]))
      endDate = dayjs().year(currentYear).month(currentMonth + 1).date(reconciliation_end_day!).hour(parseInt(reconciliation_end_time.split(':')[0])).minute(parseInt(reconciliation_end_time.split(':')[1])).second(parseInt(reconciliation_end_time.split(':')[2]))
      
      // 如果当前时间已过本周期结束时间，则取下个周期
      if (now.isAfter(endDate)) {
        startDate = startDate.add(1, 'month')
        endDate = endDate.add(1, 'month')
      } else if (now.isBefore(startDate)) {
        // 如果当前时间在本周期开始之前，则取上个周期
        startDate = startDate.subtract(1, 'month')
        endDate = endDate.subtract(1, 'month')
      }
    } else if (reconciliation_cycle_type === 'weekly') {
      // 按周：星期X到星期Y
      const currentWeekStart = now.startOf('week')
      
      startDate = currentWeekStart.day(reconciliation_start_day!).hour(parseInt(reconciliation_start_time.split(':')[0])).minute(parseInt(reconciliation_start_time.split(':')[1])).second(parseInt(reconciliation_start_time.split(':')[2]))
      endDate = currentWeekStart.day(reconciliation_end_day!).hour(parseInt(reconciliation_end_time.split(':')[0])).minute(parseInt(reconciliation_end_time.split(':')[1])).second(parseInt(reconciliation_end_time.split(':')[2]))
      
      // 如果结束日期小于开始日期，说明跨周了
      if (reconciliation_end_day! < reconciliation_start_day!) {
        endDate = endDate.add(1, 'week')
      }
      
      // 如果当前时间已过本周期结束时间，则取下个周期
      if (now.isAfter(endDate)) {
        startDate = startDate.add(1, 'week')
        endDate = endDate.add(1, 'week')
      } else if (now.isBefore(startDate)) {
        // 如果当前时间在本周期开始之前，则取上个周期
        startDate = startDate.subtract(1, 'week')
        endDate = endDate.subtract(1, 'week')
      }
    } else {
      return null
    }

    return [startDate, endDate]
  }

  // 监听装料公司变化，自动加载对账时间
  const handleLoadingCompanyChange = async (loadingCompany: string) => {
    if (!effectiveCompanyId || !loadingCompany) return
    
    try {
      const response = await getPriceConfigs({
        company_id: effectiveCompanyId,
        loading_company: loadingCompany,
        is_active: 'Y',
        page: 1,
        page_size: 1,
      })
      
      const configs = response?.data?.data?.list || []
      if (configs.length > 0) {
        const config = configs[0] as PriceConfig
        const period = calculateRecentReconciliationPeriod(config)
        
        if (period) {
          const [startDate, endDate] = period
          form.setFieldsValue({
            dateRange: [startDate, endDate]
          })
          
          const cycleTypeLabel = 
            config.reconciliation_cycle_type === 'monthly' ? '按月对账' :
            config.reconciliation_cycle_type === 'natural_month' ? '自然月对账' :
            config.reconciliation_cycle_type === 'weekly' ? '按周对账' : ''
          
          message.success(`已自动加载该装料公司的对账时间（${cycleTypeLabel}）`)
        }
      }
    } catch (error) {
      console.error('加载对账时间失败:', error)
    }
  }

  useEffect(() => {
    const key = settlementCacheKey(effectiveCompanyId)
    if (!effectiveCompanyId) {
      return
    }

    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setStatement(null)
        return
      }
      const parsed = JSON.parse(raw) as {
        form?: {
          start_date?: string
          end_date?: string
          loading_company?: string
          department_id?: number
        }
        statement?: SettlementStatement
      }

      if (parsed?.statement) {
        setStatement(parsed.statement)
      } else {
        setStatement(null)
      }

      const f = parsed?.form
      if (f?.start_date && f?.end_date && f?.loading_company) {
        form.setFieldsValue({
          dateRange: [dayjs(f.start_date), dayjs(f.end_date)],
          loading_company: f.loading_company,
          department_id: f.department_id,
        })
      }
    } catch {
      setStatement(null)
    }
  }, [effectiveCompanyId, form])

  // 生成结算单
  const handleGenerate = async () => {
    try {
      if (!effectiveCompanyId) {
        message.error('请先选择公司')
        return
      }

      const values = await form.validateFields()
      setLoading(true)

      const [startDate, endDate] = values.dateRange

      const params = {
        start_date: startDate.format('YYYY-MM-DD HH:mm:ss'),
        end_date: endDate.format('YYYY-MM-DD HH:mm:ss'),
        loading_company: values.loading_company,
        company_id: effectiveCompanyId,
        department_id: values.department_id,
      }

      const response = await generateSettlement(params)

      const payload: any = response?.data
      const ok = payload?.code === 200 || payload?.success === true
      const data: SettlementStatement | undefined = payload?.data?.data || payload?.data

      if (ok && data) {
        setStatement(data)
        try {
          localStorage.setItem(
            settlementCacheKey(effectiveCompanyId),
            JSON.stringify({
              form: {
                start_date: params.start_date,
                end_date: params.end_date,
                loading_company: params.loading_company,
                department_id: params.department_id,
              },
              statement: data,
            }),
          )
        } catch {
          // ignore
        }
        message.success('结算单生成成功')
      } else {
        message.error(payload?.message || payload?.msg || '生成失败')
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.response?.data?.msg || error?.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  // 导出Excel
  const handleExportExcel = () => {
    if (!statement) {
      message.warning('请先生成结算单')
      return
    }

    try {
      const wb = XLSX.utils.book_new()
      
      // 创建表头
      const headers = [
        '装料公司',
        '工程名称',
        '趟次',
        '总方量',
        '运距(km)',
        '单价(元/方)',
        '含税金额(元)',
        '不含税金额(元)'
      ]

      // 创建工程明细数据行
      const data = statement.items.map(item => [
        item.loading_company,
        item.project_name,
        item.trips,
        item.volume,
        item.distance,
        item.price,
        item.amount,
        item.amount_without_tax
      ])

      // 添加汇总项（小方量、水票、整车退料）
      const summaryTypeNames: Record<string, string> = {
        small_volume: '小方量/砂浆',
        water: '水票',
        full_return: '整车退料'
      }
      
      statement.summary_items.forEach(summaryItem => {
        data.push([
          '',
          summaryTypeNames[summaryItem.item_type] || summaryItem.item_type,
          summaryItem.trips,
          summaryItem.item_type === 'water' ? '' : summaryItem.volume,
          '',
          `${summaryItem.price}(元/趟)`,
          summaryItem.amount,
          ''
        ])
      })

      // 添加合计行
      data.push([
        '合计',
        '', '', '', '', '',
        statement.total_amount,
        ''
      ])

      // 创建工作表
      const ws = XLSX.utils.aoa_to_sheet([
        [`运输结算对账单`],
        [`结算周期：${statement.start_date} 至 ${statement.end_date}`],
        statement.department_name ? [`部门：${statement.department_name}`] : [],
        [`生成时间：${statement.generated_at}`],
        [],
        headers,
        ...data
      ])

      // 设置列宽
      ws['!cols'] = [
        { wch: 25 }, // 装料公司
        { wch: 35 }, // 工程名称
        { wch: 10 }, // 趟次
        { wch: 12 }, // 总方量
        { wch: 12 }, // 运距
        { wch: 15 }, // 单价
        { wch: 15 }, // 含税金额
        { wch: 15 }  // 不含税金额
      ]

      XLSX.utils.book_append_sheet(wb, ws, '结算单')
      
      const fileName = `结算单_${statement.start_date}_${statement.end_date}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      message.success('导出成功')
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    }
  }

  // 打印
  const handlePrint = () => {
    if (!statement) {
      message.warning('请先生成结算单')
      return
    }
    window.print()
  }

  // 表格列定义 - 工程明细（仅正常方量）
  const columns = [
    {
      title: '装料公司',
      dataIndex: 'loading_company',
      key: 'loading_company',
      fixed: 'left' as const,
      width: 220,
      render: (_: any, __: any, index: number) => {
        if (!statement?.items?.length) {
          return {
            children: '',
            props: {},
          }
        }
        const rowSpan = index === 0 ? statement.items.length : 0
        return {
          children: statement.items[0].loading_company,
          props: { rowSpan },
        }
      },
    },
    {
      title: '工程名称',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 320,
    },
    {
      title: '趟次',
      dataIndex: 'trips',
      key: 'trips',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '总方量',
      dataIndex: 'volume',
      key: 'volume',
      width: 120,
      align: 'right' as const,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: '运距(km)',
      dataIndex: 'distance',
      key: 'distance',
      width: 120,
      align: 'right' as const,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: '单价(元/方)',
      dataIndex: 'price',
      key: 'price',
      width: 130,
      align: 'right' as const,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: '含税金额(元)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          ¥{val.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '不含税金额(元)',
      dataIndex: 'amount_without_tax',
      key: 'amount_without_tax',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ¥{val.toFixed(2)}
        </Text>
      ),
    },
  ]

  // 汇总项列定义（小方量、水票、整车退料）
  const summaryColumns = [
    {
      title: '类型',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 200,
      render: (type: string) => {
        const typeNames: Record<string, string> = {
          small_volume: '小方量/砂浆',
          water: '水票',
          full_return: '整车退料'
        }
        return typeNames[type] || type
      }
    },
    {
      title: '趟次',
      dataIndex: 'trips',
      key: 'trips',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '总方量',
      dataIndex: 'volume',
      key: 'volume',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: any) => record.item_type === 'water' ? '-' : val.toFixed(2),
    },
    {
      title: '单价(元/趟)',
      dataIndex: 'price',
      key: 'price',
      width: 130,
      align: 'right' as const,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: '金额(元)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          ¥{val.toFixed(2)}
        </Text>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>
          <FileTextOutlined /> 生成运输结算单
        </Title>
        <Divider />

        <Form
          form={form}
          layout="inline"
          style={{ marginBottom: 24 }}
        >
          <Form.Item
            name="dateRange"
            label="结算周期"
            rules={[{ required: true, message: '请选择结算周期' }]}
          >
            <RangePicker
              showTime
              style={{ width: 400 }}
              format="YYYY-MM-DD HH:mm:ss"
              placeholder={['开始时间', '结束时间']}
            />
          </Form.Item>

          <Form.Item
            name="loading_company"
            label="装料公司"
            rules={[{ required: true, message: '请选择或输入装料公司' }]}
          >
            <Select
              placeholder="请选择或输入装料公司"
              style={{ width: 200 }}
              showSearch
              onChange={handleLoadingCompanyChange}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={loadingCompanies.map((company: string) => ({
                label: company,
                value: company,
              }))}
            />
          </Form.Item>

          <Form.Item name="department_id" label="部门筛选">
            <Select
              placeholder="全部部门"
              allowClear
              style={{ width: 200 }}
              options={departments.map((dept: any) => ({
                label: dept.title,
                value: dept.id,
              }))}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={handleGenerate}
                loading={loading}
              >
                生成结算单
              </Button>
              {statement && (
                <>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportExcel}
                  >
                    导出Excel
                  </Button>
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                  >
                    打印
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {loading && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" tip="正在生成结算单..." />
          </div>
        )}

        {!loading && statement && (
          <>
            <Card
              style={{ marginBottom: 24, background: '#fafafa' }}
              bodyStyle={{ padding: '16px 24px' }}
            >
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic
                    title="结算周期"
                    value={`${statement.start_date} 至 ${statement.end_date}`}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Col>
                {statement.department_name && (
                  <Col span={6}>
                    <Statistic
                      title="部门"
                      value={statement.department_name}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                )}
                <Col span={6}>
                  <Statistic
                    title="装料公司数量"
                    value={statement.items.length}
                    suffix="家"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="结算总金额"
                    value={statement.total_amount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#cf1322', fontSize: 24 }}
                  />
                </Col>
              </Row>
            </Card>

            <div style={{ marginBottom: 16 }}>
              <Title level={5}>工程明细（正常方量运输）</Title>
              <Table
                columns={columns}
                dataSource={statement.items}
                rowKey="project_name"
                scroll={{ x: 1200 }}
                pagination={false}
                bordered
                summary={() => {
                  const totalTrips = statement.items.reduce((sum, item) => sum + (item.trips || 0), 0)
                  const totalVolume = statement.items.reduce((sum, item) => sum + (item.volume || 0), 0)
                  const totalAmount = statement.items.reduce((sum, item) => sum + (item.amount || 0), 0)
                  const totalAmountWithoutTax = statement.items.reduce((sum, item) => sum + (item.amount_without_tax || 0), 0)
                  return (
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>小计</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="center">
                        <Text strong>{totalTrips}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong>{totalVolume.toFixed(2)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                      <Table.Summary.Cell index={5} />
                      <Table.Summary.Cell index={6} align="right">
                        <Text strong style={{ color: '#1890ff' }}>
                          ¥{totalAmount.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <Text strong style={{ color: '#52c41a' }}>
                          ¥{totalAmountWithoutTax.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )
                }}
              />
            </div>

            {statement.summary_items && statement.summary_items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>汇总项（小方量/水票/整车退料）</Title>
                <Table
                  columns={summaryColumns}
                  dataSource={statement.summary_items}
                  rowKey="item_type"
                  pagination={false}
                  bordered
                  summary={() => {
                    const totalAmount = statement.summary_items.reduce((sum, item) => sum + item.amount, 0)
                    return (
                      <Table.Summary.Row style={{ background: '#fafafa' }}>
                        <Table.Summary.Cell index={0} colSpan={4}>
                          <Text strong>小计</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4}>
                          <Text strong style={{ color: '#1890ff' }}>
                            ¥{totalAmount.toFixed(2)}
                          </Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    )
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: 24, textAlign: 'right', color: '#999' }}>
              <Text type="secondary">生成时间：{statement.generated_at}</Text>
            </div>
          </>
        )}
      </Card>

      <style>{`
        @media print {
          .ant-card-head,
          .ant-form,
          button {
            display: none !important;
          }
          .ant-card {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  )
}

export default SettlementStatementPage
