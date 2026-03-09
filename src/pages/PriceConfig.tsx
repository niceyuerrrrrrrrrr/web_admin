import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  TimePicker,
  message,
  Popconfirm,
  Typography,
  Divider,
  Tag,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getPriceConfigs,
  createPriceConfig,
  updatePriceConfig,
  deletePriceConfig,
} from '../api/services/settlement'
import type { PriceConfig, DistancePriceRule } from '../api/services/settlement'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Text } = Typography

const PriceConfigPage: React.FC = () => {
  const [form] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PriceConfig | null>(null)
  const [searchCompany, setSearchCompany] = useState<string>('')
  const queryClient = useQueryClient()
  
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  
  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId

  // 获取单价配置列表
  const { data: configsData, isLoading } = useQuery({
    queryKey: ['priceConfigs', searchCompany, effectiveCompanyId],
    queryFn: () =>
      getPriceConfigs({
        company_id: effectiveCompanyId,
        loading_company: searchCompany,
        page: 1,
        page_size: 100,
      }),
    enabled: !!effectiveCompanyId, // 只有选择了公司才查询
  })

  const configs = configsData?.data?.data?.list || []
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  // 创建配置
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await createPriceConfig(payload)
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || '创建失败')
      }
      return res
    },
    onSuccess: () => {
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['priceConfigs'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || error.message || '创建失败')
    },
  })

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PriceConfig> }) => {
      const res = await updatePriceConfig(id, data)
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || '更新失败')
      }
      return res
    },
    onSuccess: () => {
      message.success('更新成功')
      setModalVisible(false)
      form.resetFields()
      setEditingConfig(null)
      queryClient.invalidateQueries({ queryKey: ['priceConfigs'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || error.message || '更新失败')
    },
  })

  // 删除配置
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await deletePriceConfig(id)
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || '删除失败')
      }
      return res
    },
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['priceConfigs'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || error.message || '删除失败')
    },
  })

  // 打开新建/编辑弹窗
  const handleOpenModal = (config?: PriceConfig) => {
    if (config) {
      setEditingConfig(config)
      // 处理对账周期配置的默认值
      const reconciliationFields: any = {}
      if (config.reconciliation_cycle_type) {
        reconciliationFields.reconciliation_cycle_type = config.reconciliation_cycle_type
        reconciliationFields.reconciliation_start_day = config.reconciliation_cycle_type === 'natural_month' ? 1 : config.reconciliation_start_day
        reconciliationFields.reconciliation_start_time = config.reconciliation_start_time ? dayjs(config.reconciliation_start_time, 'HH:mm:ss') : null
        reconciliationFields.reconciliation_end_day = config.reconciliation_cycle_type === 'natural_month' ? 31 : config.reconciliation_end_day
        reconciliationFields.reconciliation_end_time = config.reconciliation_end_time ? dayjs(config.reconciliation_end_time, 'HH:mm:ss') : null
      }

      form.setFieldsValue({
        loading_company: config.loading_company,
        distance_price_rules: config.distance_price_rules,
        tax_rate: config.tax_rate,
        base_price: config.base_price,
        increment_per_km: config.increment_per_km,
        base_distance: config.base_distance,
        small_volume_price: config.small_volume_price,
        water_ticket_price: config.water_ticket_price,
        water_ticket_company: config.water_ticket_company,
        full_return_price: config.full_return_price,
        effective_date: config.effective_date ? dayjs(config.effective_date) : null,
        expiry_date: config.expiry_date ? dayjs(config.expiry_date) : null,
        ...reconciliationFields,
        remarks: config.remarks,
      })
    } else {
      setEditingConfig(null)
      form.resetFields()
    }
    setModalVisible(true)
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      if (!effectiveCompanyId) {
        message.error('请先选择公司')
        return
      }
      
      const values = await form.validateFields()
      
      console.log('=== 表单验证后的values ===', values)
      console.log('water_ticket_company值:', values.water_ticket_company)
      console.log('water_ticket_company类型:', typeof values.water_ticket_company)
      
      const data = {
        company_id: effectiveCompanyId,
        loading_company: values.loading_company,
        distance_price_rules: values.distance_price_rules || [],
        tax_rate: values.tax_rate,
        base_price: values.base_price,
        increment_per_km: values.increment_per_km,
        base_distance: values.base_distance,
        small_volume_price: values.small_volume_price,
        water_ticket_price: values.water_ticket_price,
        water_ticket_company: values.water_ticket_company,
        full_return_price: values.full_return_price,
        effective_date: values.effective_date.format('YYYY-MM-DD'),
        expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : undefined,
        reconciliation_cycle_type: values.reconciliation_cycle_type || null,
        reconciliation_start_day: values.reconciliation_cycle_type === 'natural_month' ? 1 : (values.reconciliation_start_day || null),
        reconciliation_start_time: values.reconciliation_start_time ? values.reconciliation_start_time.format('HH:mm:ss') : null,
        reconciliation_end_day: values.reconciliation_cycle_type === 'natural_month' ? 31 : (values.reconciliation_end_day || null),
        reconciliation_end_time: values.reconciliation_end_time ? values.reconciliation_end_time.format('HH:mm:ss') : null,
        remarks: values.remarks,
      }

      console.log('=== 准备发送的data ===', data)
      console.log('data.water_ticket_company:', data.water_ticket_company)
      console.log('=== 对账周期配置数据 ===', {
        reconciliation_cycle_type: data.reconciliation_cycle_type,
        reconciliation_start_day: data.reconciliation_start_day,
        reconciliation_start_time: data.reconciliation_start_time,
        reconciliation_end_day: data.reconciliation_end_day,
        reconciliation_end_time: data.reconciliation_end_time,
      })

      if (editingConfig) {
        console.log('执行更新操作，ID:', editingConfig.id)
        updateMutation.mutate({ id: editingConfig.id!, data })
      } else {
        console.log('执行创建操作')
        createMutation.mutate(data)
      }
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  // 表格列定义
  const columns: ColumnsType<PriceConfig> = [
    {
      title: '装料公司',
      dataIndex: 'loading_company',
      key: 'loading_company',
      width: 200,
      fixed: 'left',
    },
    {
      title: '正常运输单价规则',
      dataIndex: 'distance_price_rules',
      key: 'distance_price_rules',
      width: 350,
      render: (rules: DistancePriceRule[]) => (
        <Space direction="vertical" size="small">
          {rules?.map((rule, index) => (
            <Text key={index} style={{ fontSize: 12 }}>
              {rule.min_distance}km - {rule.max_distance ? `${rule.max_distance}km` : '∞'}: 
              税率{rule.tax_rate}%, 含税价¥{rule.price_with_tax}/方
            </Text>
          ))}
        </Space>
      ),
    },
    {
      title: '小方量单价',
      dataIndex: 'small_volume_price',
      key: 'small_volume_price',
      width: 120,
      render: (val: number) => (val ? `¥${val}/趟` : '-'),
    },
    {
      title: '水票单价',
      dataIndex: 'water_ticket_price',
      key: 'water_ticket_price',
      width: 120,
      render: (val: number) => (val ? `¥${val}/趟` : '-'),
    },
    {
      title: '整车退料单价',
      dataIndex: 'full_return_price',
      key: 'full_return_price',
      width: 130,
      render: (val: number) => (val ? `¥${val}/趟` : '-'),
    },
    {
      title: '生效日期',
      dataIndex: 'effective_date',
      key: 'effective_date',
      width: 120,
    },
    {
      title: '失效日期',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      width: 120,
      render: (val: string) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (val: string) =>
        val === 'Y' ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此配置吗？"
            onConfirm={() => deleteMutation.mutate(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>
          <SettingOutlined /> 运输单价配置管理
        </Title>
        <Divider />
        
        {showCompanyWarning && (
          <Alert
            message="请先选择公司"
            description="您是超级管理员，请使用顶部的公司切换器选择要管理的公司。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索装料公司"
            allowClear
            style={{ width: 300 }}
            onSearch={setSearchCompany}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            新建配置
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1500 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingConfig ? '编辑单价配置' : '新建单价配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setEditingConfig(null)
        }}
        width={800}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="loading_company"
            label="装料公司名称"
            rules={[{ required: true, message: '请输入装料公司名称' }]}
          >
            <Input placeholder="请输入装料公司名称" />
          </Form.Item>

          <Form.Item label="正常运输单价规则（按运距分段）">
            <Form.List name="distance_price_rules">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8, alignItems: 'flex-start' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'min_distance']}
                        rules={[{ required: true, message: '请输入最小运距' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="最小运距(km)"
                          min={0}
                          style={{ width: 120 }}
                        />
                      </Form.Item>
                      <span>-</span>
                      <Form.Item
                        {...field}
                        name={[field.name, 'max_distance']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="最大运距(km)"
                          min={0}
                          style={{ width: 120 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'tax_rate']}
                        rules={[{ required: true, message: '请输入税率' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="税率(%)"
                          min={0}
                          max={100}
                          precision={2}
                          style={{ width: 100 }}
                          addonAfter="%"
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'price_with_tax']}
                        rules={[{ required: true, message: '请输入含税价格' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="含税价格(元/方)"
                          min={0}
                          precision={2}
                          style={{ width: 140 }}
                          addonAfter="元/方"
                        />
                      </Form.Item>
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加运距规则
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Divider>递增定价规则（运距超过基础运距后）</Divider>
          
          <Form.Item name="base_distance" label="基础运距（km）">
            <InputNumber
              placeholder="请输入基础运距"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="base_price" label="底价（元/方）">
            <InputNumber
              placeholder="请输入底价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="increment_per_km" label="每公里增加价格（元）">
            <InputNumber
              placeholder="请输入每公里增加的价格"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="tax_rate" label="递增定价税率（%）">
            <InputNumber
              placeholder="请输入税率"
              min={0}
              max={100}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider>固定单价</Divider>

          <Form.Item name="small_volume_price" label="小方量/砂浆固定单价（元/趟）">
            <InputNumber
              placeholder="请输入单价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="water_ticket_price" label="水票固定单价（元/趟）">
            <InputNumber
              placeholder="请输入单价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="water_ticket_company" label="关联的水票公司">
            <Input
              placeholder="请输入水票公司名称（用于匹配哪个水票公司的水票与该装料公司一起结算）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="full_return_price" label="整车退料固定单价（元/趟）">
            <InputNumber
              placeholder="请输入单价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="effective_date"
            label="生效日期"
            rules={[{ required: true, message: '请选择生效日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="expiry_date" label="失效日期（可选）">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Divider orientation="left">对账周期配置（可选）</Divider>

          <Form.Item name="reconciliation_cycle_type" label="对账周期类型">
            <Select
              placeholder="请选择对账周期类型"
              style={{ width: '100%' }}
              allowClear
              options={[
                { label: '按月对账（每月几号-次月几号）', value: 'monthly' },
                { label: '自然月对账（每月 1 号-月末）', value: 'natural_month' },
                { label: '按周对账（星期几-星期几）', value: 'weekly' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.reconciliation_cycle_type !== currentValues.reconciliation_cycle_type
            }
          >
            {({ getFieldValue }) => {
              const cycleType = getFieldValue('reconciliation_cycle_type')
              if (!cycleType) return null

              return (
                <>
                  <Form.Item label="开始">
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="reconciliation_start_day"
                        noStyle
                        rules={[{ required: !!cycleType, message: '请输入开始日期' }]}
                      >
                        <InputNumber
                          placeholder={
                            cycleType === 'monthly'
                              ? '每月几号 (1-31)'
                              : cycleType === 'weekly'
                              ? '星期几 (1-7)'
                              : '每月 1 号'
                          }
                          min={1}
                          max={cycleType === 'weekly' ? 7 : 31}
                          style={{ width: '50%' }}
                          disabled={cycleType === 'natural_month'}
                        />
                      </Form.Item>
                      <Form.Item
                        name="reconciliation_start_time"
                        noStyle
                        rules={[{ required: !!cycleType, message: '请选择开始时间' }]}
                      >
                        <TimePicker
                          format="HH:mm:ss"
                          placeholder="开始时间"
                          style={{ width: '50%' }}
                        />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item label="结束">
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="reconciliation_end_day"
                        noStyle
                        rules={[{ required: !!cycleType, message: '请输入结束日期' }]}
                      >
                        <InputNumber
                          placeholder={
                            cycleType === 'monthly'
                              ? '次月几号 (1-31)'
                              : cycleType === 'weekly'
                              ? '星期几 (1-7)'
                              : '月末'
                          }
                          min={1}
                          max={cycleType === 'weekly' ? 7 : 31}
                          style={{ width: '50%' }}
                          disabled={cycleType === 'natural_month'}
                        />
                      </Form.Item>
                      <Form.Item
                        name="reconciliation_end_time"
                        noStyle
                        rules={[{ required: !!cycleType, message: '请选择结束时间' }]}
                      >
                        <TimePicker
                          format="HH:mm:ss"
                          placeholder="结束时间"
                          style={{ width: '50%' }}
                        />
                      </Form.Item>
                    </Space.Compact>
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PriceConfigPage
