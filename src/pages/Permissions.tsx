import { useState, useMemo } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPermissions,
  fetchRolesList,
  createRole,
  updateRole,
  deleteRole,
  type Permission,
  type Role,
} from '../api/services/permissions'

const { Title, Paragraph, Text } = Typography

// 权限代码到中文名称的映射
const getPermissionName = (code: string, permissions: Permission[]): string => {
  const permission = permissions.find(p => p.code === code)
  return permission ? permission.name : code
}

const PermissionsPage = () => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()
  const [activeTab, setActiveTab] = useState('roles')
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleDrawerVisible, setRoleDrawerVisible] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [form] = Form.useForm()

  // 获取权限列表
  const permissionsQuery = useQuery({
    queryKey: ['permissions', 'list'],
    queryFn: () => fetchPermissions(),
  })

  // 获取角色列表
  const rolesQuery = useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: () => fetchRolesList(),
  })

  const permissions = permissionsQuery.data?.permissions || []
  const permissionModules = permissionsQuery.data?.modules || {}
  const roles = rolesQuery.data?.roles || []

  // 创建角色
  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      message.success('角色创建成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setRoleModalVisible(false)
      form.resetFields()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败')
    },
  })

  // 更新角色
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateRole(id, data),
    onSuccess: () => {
      message.success('角色更新成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setRoleModalVisible(false)
      setEditingRole(null)
      form.resetFields()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败')
    },
  })

  // 删除角色
  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      message.success('角色删除成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败')
    },
  })

  // 将权限转换为树形结构
  const permissionTree: DataNode[] = useMemo(() => {
    const tree: DataNode[] = []
    const moduleMap: Record<string, DataNode> = {}

    Object.entries(permissionModules).forEach(([module, perms]) => {
      const moduleNode: DataNode = {
        title: module,
        key: module,
        children: [],
      }

      perms.forEach((perm) => {
        if (perm.type === 'menu') {
          moduleNode.children?.push({
            title: `${perm.name} (${perm.code})`,
            key: perm.code,
            children: perms
              .filter((p) => p.parent_code === perm.code)
              .map((p) => ({
                title: `${p.name} (${p.code})`,
                key: p.code,
              })),
          })
        }
      })

      tree.push(moduleNode)
    })

    return tree
  }, [permissionModules])

  // 角色表格列
  const roleColumns: ColumnsType<Role> = useMemo(
    () => [
      {
        title: '角色代码',
        dataIndex: 'code',
        width: 150,
        render: (value, record) => (
          <Space>
            {record.is_system ? <LockOutlined style={{ color: '#faad14' }} /> : <UnlockOutlined />}
            <Text strong>{value}</Text>
          </Space>
        ),
      },
      {
        title: '角色名称',
        dataIndex: 'name',
        width: 150,
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
      },
      {
        title: '权限数量',
        dataIndex: 'permissions',
        width: 100,
        align: 'center',
        render: (perms: string[]) => <Tag color="blue">{perms.length}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 80,
        align: 'center',
        render: (active) => (
          <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '类型',
        dataIndex: 'is_system',
        width: 100,
        align: 'center',
        render: (isSystem) => (
          <Tag color={isSystem ? 'orange' : 'default'}>{isSystem ? '系统角色' : '自定义'}</Tag>
        ),
      },
      {
        title: '操作',
        width: 200,
        align: 'center',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => {
                setSelectedRole(record)
                setRoleDrawerVisible(true)
              }}
            >
              查看权限
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRole(record)
                form.setFieldsValue({
                  name: record.name,
                  description: record.description,
                  is_active: record.is_active,
                  permission_codes: record.permissions,
                })
                setRoleModalVisible(true)
              }}
            >
              编辑
            </Button>
            {!record.is_system && (
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  modal.confirm({
                    title: '确认删除',
                    content: `确定要删除角色"${record.name}"吗？`,
                    okText: '确定',
                    cancelText: '取消',
                    onOk: () => deleteRoleMutation.mutate(record.id),
                  })
                }}
              >
                删除
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [deleteRoleMutation, form]
  )

  // 权限表格列
  const permissionColumns: ColumnsType<Permission> = useMemo(
    () => [
      {
        title: '权限代码',
        dataIndex: 'code',
        width: 250,
        render: (value) => <Text code>{value}</Text>,
      },
      {
        title: '权限名称',
        dataIndex: 'name',
        width: 150,
      },
      {
        title: '模块',
        dataIndex: 'module',
        width: 120,
        render: (value) => <Tag>{value}</Tag>,
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: (value) => {
          const colorMap = { menu: 'blue', action: 'green', data: 'orange' }
          return <Tag color={colorMap[value as keyof typeof colorMap]}>{value}</Tag>
        },
      },
      {
        title: '父级权限',
        dataIndex: 'parent_code',
        width: 200,
        render: (value) => (value ? <Text type="secondary">{value}</Text> : '-'),
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 80,
        align: 'center',
        render: (active) => (
          <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
        ),
      },
    ],
    []
  )

  // 提交角色表单
  const handleRoleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingRole) {
        updateRoleMutation.mutate({
          id: editingRole.id,
          data: values,
        })
      } else {
        createRoleMutation.mutate(values)
      }
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            权限管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理系统权限和角色配置
          </Paragraph>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRole(null)
              form.resetFields()
              setRoleModalVisible(true)
            }}
          >
            新建角色
          </Button>
          <ReloadOutlined
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['permissions'] })
              queryClient.invalidateQueries({ queryKey: ['roles'] })
            }}
            style={{ cursor: 'pointer', fontSize: 16 }}
          />
        </Space>
      </Flex>

      {(permissionsQuery.error || rolesQuery.error) && (
        <Alert
          type="error"
          showIcon
          message={
            (permissionsQuery.error as Error)?.message ||
            (rolesQuery.error as Error)?.message ||
            '数据加载失败'
          }
        />
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'roles',
              label: '角色管理',
              children: (
            <Table
              rowKey="id"
              columns={roleColumns}
              dataSource={roles}
              loading={rolesQuery.isLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              locale={{ emptyText: <Empty description="暂无角色数据" /> }}
            />
              ),
            },
            {
              key: 'permissions',
              label: '权限列表',
              children: (
            <Table
              rowKey="id"
              columns={permissionColumns}
              dataSource={permissions}
              loading={permissionsQuery.isLoading}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              locale={{ emptyText: <Empty description="暂无权限数据" /> }}
            />
              ),
            },
            {
              key: 'tree',
              label: '权限树',
              children: (
            <Card>
              <Tree
                showLine
                defaultExpandAll
                treeData={permissionTree}
                style={{ marginTop: 16 }}
              />
            </Card>
              ),
            },
          ]}
        />
      </Card>

      {/* 角色编辑弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={roleModalVisible}
        onOk={handleRoleSubmit}
        onCancel={() => {
          setRoleModalVisible(false)
          setEditingRole(null)
          form.resetFields()
        }}
        width={700}
        confirmLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          {!editingRole && (
            <Form.Item
              label="角色代码"
              name="code"
              rules={[
                { required: true, message: '请输入角色代码' },
                { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' },
              ]}
            >
              <Input placeholder="如: custom_role" />
            </Form.Item>
          )}

          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="如: 自定义角色" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="角色描述" />
          </Form.Item>

          <Form.Item label="状态" name="is_active" valuePropName="checked" initialValue={true}>
            <Checkbox>启用</Checkbox>
          </Form.Item>

          <Form.Item label="权限配置" name="permission_codes">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                {Object.entries(permissionModules).map(([module, perms]) => (
                  <Col span={24} key={module}>
                    <Card size="small" title={module} variant="outlined" style={{ marginBottom: 8 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {perms.map((perm) => (
                          <Checkbox key={perm.code} value={perm.code}>
                            <Space>
                              <Text strong>{perm.name}</Text>
                              <Text type="secondary" code>
                                {perm.code}
                              </Text>
                            </Space>
                          </Checkbox>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色权限详情抽屉 */}
      <Drawer
        title="角色权限详情"
        placement="right"
        width={600}
        open={roleDrawerVisible}
        onClose={() => {
          setRoleDrawerVisible(false)
          setSelectedRole(null)
        }}
      >
        {selectedRole && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="角色代码">{selectedRole.code}</Descriptions.Item>
              <Descriptions.Item label="角色名称">{selectedRole.name}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedRole.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {selectedRole.is_system ? '系统角色' : '自定义角色'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedRole.is_active ? '启用' : '禁用'}
              </Descriptions.Item>
              <Descriptions.Item label="权限数量">{selectedRole.permissions.length}</Descriptions.Item>
            </Descriptions>

            <Card title="权限列表" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {selectedRole.permissions.map((perm) => {
                  const permName = getPermissionName(perm, permissions)
                  return (
                    <Tag key={perm} color="blue">
                      {permName}
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        ({perm})
                      </Text>
                    </Tag>
                  )
                })}
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>
    </Space>
  )
}

export default PermissionsPage
