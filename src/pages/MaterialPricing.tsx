import { useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalculatorOutlined, CheckCircleOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calculateMaterialIncome,
  createMaterialType,
  deleteMaterialType,
  fetchMaterialTypes,
  updateMaterialType,
} from '../api/services/materialPricing'
import type { MaterialIncomeCalculation, MaterialType } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography

const MaterialPricingPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [calcModalOpen, setCalcModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [calcForm] = Form.useForm()
  const [calcResult, setCalcResult] = useState<MaterialIncomeCalculation | null>(null)

  const materialsQuery = useQuery({
    queryKey: ['material-pricing', 'types', effectiveCompanyId],
    queryFn: () => fetchMaterialTypes({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const createMutation = useMutation({
    mutationFn: createMaterialType,
    onSuccess: () => {
      message.success('材料创建成功')
      createForm.resetFields()
      setCreateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['material-pricing', 'types'] })
    },
    onError: (error) => message.error((error as Error).message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: Partial<MaterialType> }) => updateMaterialType(params.id, params.data),
    onSuccess: () => {
      message.success('材料更新成功')
      setDrawerOpen(false)
      setSelectedMaterial(null)
      queryClient.invalidateQueries({ queryKey: ['material-pricing', 'types'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMaterialType,
    onSuccess: () => {
      message.success('已禁用该材料')
      queryClient.invalidateQueries({ queryKey: ['material-pricing', 'types'] })
    },
    onError: (error) => message.error((error as Error).message || '操作失败'),
  })

  const calcMutation = useMutation({
    mutationFn: calculateMaterialIncome,
    onSuccess: (data) => {
      setCalcResult(data)
    },
    onError: (error) => message.error((error as Error).message || '计算失败'),
  })

  const columns: ColumnsType<MaterialType> = useMemo(
    () => [
      { title: '材料名称', dataIndex: 'name', width: 180 },
      { title: '规格', dataIndex: 'spec', width: 160, render: (value) => value || '-' },
      {
        title: '单价 (元/吨)',
        dataIndex: 'unit_price',
        width: 150,
        render: (value) => `¥ ${value.toFixed(2)}`,
      },
      {
        title: '运费 (元/吨)',
        dataIndex: 'freight_price',
        width: 150,
        render: (value) => `¥ ${value.toFixed(2)}`,
      },
      {
        title: '综合单价',
        dataIndex: 'total_price',
        width: 150,
        render: (value) => `¥ ${value.toFixed(2)}`,
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 120,
        render: (value) => <Tag color={value ? 'success' : 'default'}>{value ? '启用' : '禁用'}</Tag>,
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedMaterial(record)
                setDrawerOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              icon={<CheckCircleOutlined />}
              onClick={() =>
                Modal.confirm({
                  title: '禁用材料',
                  content: '确定要禁用该材料吗？',
                  onOk: () => deleteMutation.mutate(record.id),
                })
              }
            >
              禁用
            </Button>
          </Space>
        ),
      },
    ],
    [deleteMutation],
  )

  const handleCreate = () => {
    createForm.validateFields().then((values) => {
      createMutation.mutate({
        name: values.name,
        spec: values.spec,
        unit_price: values.unit_price,
        freight_price: values.freight_price,
        description: values.description,
        is_active: values.is_active !== false,
      })
    })
  }

  const handleUpdate = () => {
    if (!selectedMaterial) return
    updateMutation.mutate({
      id: selectedMaterial.id,
      data: {
        name: selectedMaterial.name,
        spec: selectedMaterial.spec,
        unit_price: selectedMaterial.unit_price,
        freight_price: selectedMaterial.freight_price,
        description: selectedMaterial.description,
        is_active: selectedMaterial.is_active,
      },
    })
  }

  const handleCalculate = () => {
    calcForm.validateFields().then((values) => {
      calcMutation.mutate({
        task_id: values.task_id,
        unloading_receipt_id: values.unloading_receipt_id,
        material_name: values.material_name,
        net_weight: values.net_weight,
      })
    })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            材料价格管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            配置材料单价、运费，支持运输收入计算。
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['material-pricing', 'types'] })}>
            刷新
          </Button>
          <Button icon={<CalculatorOutlined />} onClick={() => setCalcModalOpen(true)}>
            收入计算
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新增材料
          </Button>
        </Space>
      </Flex>

      {showCompanyWarning && (
        <Alert type="warning" message="请选择要查看的公司后再查看材料定价数据" showIcon />
      )}

      <Tabs
        items={[
          {
            key: 'list',
            label: '材料列表',
            children: (
              <Card>
                {materialsQuery.error && <Alert type="error" showIcon message={(materialsQuery.error as Error).message || '加载失败'} />}
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={materialsQuery.data || []}
                  loading={materialsQuery.isLoading}
                  pagination={false}
                  scroll={{ x: 1000 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Drawer
        width={520}
        title={`编辑材料 - ${selectedMaterial?.name || ''}`}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedMaterial(null)
        }}
        extra={
          <Button type="primary" onClick={handleUpdate} loading={updateMutation.isPending}>
            保存
          </Button>
        }
      >
        {selectedMaterial ? (
          <Form layout="vertical" initialValues={selectedMaterial} onValuesChange={(_, values) => setSelectedMaterial((prev) => ({ ...prev!, ...values }))}>
            <Form.Item label="材料名称" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="规格" name="spec">
              <Input />
            </Form.Item>
            <Form.Item label="单价 (元/吨)" name="unit_price" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
            <Form.Item label="运费 (元/吨)" name="freight_price" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
            <Form.Item label="描述" name="description">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Form>
        ) : (
          <Alert type="info" message="请选择材料" showIcon />
        )}
      </Drawer>

      <Modal
        title="新增材料"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={createMutation.isPending}
      >
        <Form layout="vertical" form={createForm} initialValues={{ is_active: true }}>
          <Form.Item label="材料名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="规格" name="spec">
            <Input />
          </Form.Item>
          <Form.Item label="单价 (元/吨)" name="unit_price" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item label="运费 (元/吨)" name="freight_price" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="启用状态" name="is_active" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="运输收入计算" open={calcModalOpen} onCancel={() => setCalcModalOpen(false)} onOk={handleCalculate} confirmLoading={calcMutation.isPending}>
        <Form layout="vertical" form={calcForm}>
          <Form.Item label="任务ID" name="task_id">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="卸货单ID" name="unloading_receipt_id">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="材料名称" name="material_name">
            <Input />
          </Form.Item>
          <Form.Item label="净重 (吨)" name="net_weight">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Alert type="info" message="可通过任务ID / 卸货单ID / 材料名称 + 净重任意组合计算。" showIcon />
        </Form>
        {calcResult && (
          <Card
            style={{ marginTop: 16 }}
            title={
              <>
                计算结果 · <Text strong>{calcResult.material_name}</Text>
              </>
            }
          >
            <Descriptions column={2}>
              <Descriptions.Item label="单位重量">{calcResult.net_weight} 吨</Descriptions.Item>
              <Descriptions.Item label="材料单价">¥ {calcResult.unit_price.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="运费单价">¥ {calcResult.freight_price.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="综合单价">¥ {calcResult.total_price.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="总收入" span={2}>
                <Text strong style={{ fontSize: 18 }}>
                  ¥ {calcResult.total_income.toFixed(2)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Modal>
    </Space>
  )
}

export default MaterialPricingPage

