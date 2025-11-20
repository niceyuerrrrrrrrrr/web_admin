import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  APPROVAL_TYPES,
  createWorkflow,
  deleteWorkflow,
  fetchRoleUsers,
  fetchWorkflows,
  updateWorkflow,
  type RoleUsersMap,
  type Workflow,
  type WorkflowNode,
  type WorkflowPayload,
} from '../api/services/approval'

import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Paragraph, Text } = Typography

const getApprovalTypeLabel = (value: string) =>
  APPROVAL_TYPES.find((item) => item.value === value)?.label || value

const ApprovalWorkflowsPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const [filterType, setFilterType] = useState<string>('all')
  const [drawerWorkflow, setDrawerWorkflow] = useState<Workflow | null>(null)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<WorkflowPayload>()

  const workflowsQuery = useQuery({
    queryKey: ['approval', 'workflows', filterType, effectiveCompanyId],
    queryFn: () =>
      fetchWorkflows({
        approvalType: filterType !== 'all' ? filterType : undefined,
        companyId: effectiveCompanyId,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const roleUsersQuery = useQuery({
    queryKey: ['approval', 'role-users', effectiveCompanyId],
    queryFn: () => fetchRoleUsers({ companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const workflows = workflowsQuery.data?.workflows ?? []
  const roleUsersMap: RoleUsersMap = roleUsersQuery.data?.role_users ?? {}

  const openCreateModal = () => {
    setEditingWorkflow(null)
    setModalOpen(true)
    form.setFieldsValue({
      approval_type: 'reimbursement',
      name: '',
      description: '',
      is_active: true,
      nodes: [],
    } as WorkflowPayload)
  }

  const openEditModal = async (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setModalOpen(true)
    form.setFieldsValue({
      approval_type: workflow.approval_type,
      name: workflow.name,
      description: workflow.description,
      is_active: workflow.is_active,
      nodes: workflow.nodes.map((node) => ({
        node_name: node.node_name,
        approver_role: node.approver_role,
        approver_user_id: node.approver_user_id,
        is_required: node.is_required,
        can_reject: node.can_reject,
        node_order: node.node_order,
      })),
    } as WorkflowPayload)
  }

  const handleDrawerOpen = useCallback(
    (record: Workflow) => {
      setDrawerWorkflow(record)
    },
    [],
  )

  const closeModal = () => {
    setModalOpen(false)
    form.resetFields()
  }

  const mutation = useMutation({
    mutationFn: (payload: WorkflowPayload) => {
      if (isSuperAdmin && !effectiveCompanyId) {
        message.error('请先选择要配置的公司')
        return Promise.reject(new Error('missing company'))
      }
      const normalizedNodes = (payload.nodes || []).map((node, index) => ({
        ...node,
        node_order: index + 1,
      }))
      const finalPayload: WorkflowPayload = {
        ...payload,
        nodes: normalizedNodes,
        ...(isSuperAdmin ? { companyId: effectiveCompanyId } : {}),
      }
      if (editingWorkflow) {
        return updateWorkflow(editingWorkflow.id, finalPayload)
      }
      return createWorkflow(finalPayload)
    },
    onSuccess: () => {
      message.success('流程保存成功')
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['approval', 'workflows'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '保存失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (workflow: Workflow) => deleteWorkflow(workflow.id),
    onSuccess: () => {
      message.success('流程已删除')
      queryClient.invalidateQueries({ queryKey: ['approval', 'workflows'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const columns: ColumnsType<Workflow> = useMemo(
    () => [
      {
        title: '审批类型',
        dataIndex: 'approval_type',
        render: (value: string) => getApprovalTypeLabel(value),
        width: 160,
      },
      {
        title: '流程名称',
        dataIndex: 'name',
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 120,
        render: (value: boolean) => (
          <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>
        ),
      },
      {
        title: '节点数',
        dataIndex: ['nodes'],
        width: 100,
        render: (_: WorkflowNode[], record) => record.nodes.length,
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 200,
        render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 200,
        render: (_, record) => (
          <Space size="small">
            <Button type="link" onClick={() => handleDrawerOpen(record)}>
              查看
            </Button>
            <Button type="link" onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Button
              type="link"
              danger
              loading={deleteMutation.isPending}
              onClick={() =>
                Modal.confirm({
                  title: '确认删除该流程？',
                  content: '删除后不可恢复，请谨慎操作。',
                  onOk: () => deleteMutation.mutateAsync(record),
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [deleteMutation, handleDrawerOpen],
  )

  const roleOptions = useMemo(
    () =>
      Object.entries(roleUsersMap).map(([role, users]) => ({
        label: role,
        value: role,
        users,
      })),
    [roleUsersMap],
  )

  const userOptions = (role?: string) => {
    if (!role) return []
    return (roleUsersMap[role] || []).map((item) => ({ label: item.name, value: item.id }))
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      mutation.mutate(values as WorkflowPayload)
    } catch {
      // validation errors handled by form
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            审批流程配置
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            由总经理维护各审批类型的流程节点与审批人，确保 PC 端与小程序一致。
          </Paragraph>
        </div>
        <Space>
          <Select
            value={filterType}
            style={{ width: 200 }}
            onChange={setFilterType}
            options={[{ value: 'all', label: '全部类型' }, ...APPROVAL_TYPES]}
          />
          <Button
            type="primary"
            onClick={openCreateModal}
            disabled={isSuperAdmin && !effectiveCompanyId}
          >
            新建流程
          </Button>
        </Space>
      </Flex>

      {isSuperAdmin && !effectiveCompanyId && (
        <Alert
          type="warning"
          message="请选择要配置审批流程的公司"
          showIcon
        />
      )}

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={workflows}
          loading={workflowsQuery.isLoading}
          pagination={false}
          scroll={{ x: 900 }}
        />
        {!workflows.length && !workflowsQuery.isLoading && (
          <Alert style={{ marginTop: 16 }} type="info" message="暂无流程，请先创建" />
        )}
      </Card>

      <Drawer
        title={drawerWorkflow ? `${drawerWorkflow.name} · 流程节点` : '流程详情'}
        width={520}
        open={!!drawerWorkflow}
        onClose={() => setDrawerWorkflow(null)}
      >
        {drawerWorkflow ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              类型：{getApprovalTypeLabel(drawerWorkflow.approval_type)}
            </Text>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '顺序', dataIndex: 'node_order', width: 80 },
                { title: '节点名称', dataIndex: 'node_name' },
                { title: '审批角色', dataIndex: 'approver_role', width: 120 },
                {
                  title: '审批人',
                  dataIndex: 'approver_user_name',
                  render: (value: string) => value || '-',
                },
                {
                  title: '设置',
                  dataIndex: 'is_required',
                  render: (_, node: WorkflowNode) => (
                    <Space size="small">
                      <Tag color={node.is_required ? 'blue' : 'default'}>
                        {node.is_required ? '必审' : '可选'}
                      </Tag>
                      <Tag color={node.can_reject ? 'red' : 'default'}>
                        {node.can_reject ? '可驳回' : '不可驳回'}
                      </Tag>
                    </Space>
                  ),
                },
              ]}
              dataSource={drawerWorkflow.nodes}
            />
          </Space>
        ) : (
          <Empty description="请选择流程" />
        )}
      </Drawer>

      <Modal
        title={editingWorkflow ? '编辑审批流程' : '新建审批流程'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleModalOk}
        confirmLoading={mutation.isPending}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="approval_type"
                label="审批类型"
                rules={[{ required: true, message: '请选择审批类型' }]}
              >
                <Select
                  disabled={!!editingWorkflow}
                  options={APPROVAL_TYPES}
                  placeholder="请选择"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_active"
                label="是否启用"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="流程名称" rules={[{ required: true, message: '请输入流程名称' }]}
            >
            <Input placeholder="例如：报销审批流程" />
          </Form.Item>
          <Form.Item name="description" label="流程描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>

          <Form.List name="nodes">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Flex justify="space-between" align="center">
                  <Title level={5} style={{ margin: 0 }}>
                    审批节点
                  </Title>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                    新增节点
                  </Button>
                </Flex>
                {fields.length === 0 && (
                  <Alert type="info" message="请至少添加一个审批节点" />
                )}
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`节点 ${index + 1}`}
                    extra={
                      <Button
                        type="text"
                        icon={<MinusCircleOutlined />}
                        danger
                        onClick={() => remove(field.name)}
                      >
                        删除
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'node_name']}
                          label="节点名称"
                          rules={[{ required: true, message: '请输入节点名称' }]}
                        >
                          <Input placeholder="例如：财务审批" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'approver_role']}
                          label="审批角色"
                          rules={[{ required: true, message: '请选择角色' }]}
                        >
                          <Select
                            placeholder="请选择角色"
                            options={roleOptions.map((item) => ({ label: item.label, value: item.value }))}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          shouldUpdate={(prev, curr) =>
                            prev.nodes?.[field.name]?.approver_role !== curr.nodes?.[field.name]?.approver_role
                          }
                          noStyle
                        >
                          {({ getFieldValue }) => {
                            const role = getFieldValue(['nodes', field.name, 'approver_role'])
                            return (
                              <Form.Item
                                name={[field.name, 'approver_user_id']}
                                label="审批人"
                                rules={[{ required: true, message: '请选择审批人' }]}
                              >
                                <Select placeholder="请选择审批人" options={userOptions(role)} />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'can_reject']}
                          label="允许驳回"
                          valuePropName="checked"
                          initialValue={true}
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'is_required']}
                          label="必审节点"
                          valuePropName="checked"
                          initialValue={true}
                        >
                          <Switch />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Space>
  )
}

export default ApprovalWorkflowsPage
