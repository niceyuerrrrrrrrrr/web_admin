import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Tree,
  Typography,
} from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import type { FinCategoryRecord } from '../api/types'
import { createFinCategory, fetchFinCategories, toggleFinCategoryActive, updateFinCategory } from '../api/services/finBase'

const { Title, Text } = Typography

const buildNodeTitle = (r: FinCategoryRecord) => {
  if (Number(r.is_active) === 1) return r.name
  return (
    <Space size={6}>
      <span>{r.name}</span>
      <Tag>停用</Tag>
    </Space>
  )
}

const recordsToNodes = (records: FinCategoryRecord[]): DataNode[] => {
  return records.map((r) => ({
    key: String(r.id),
    title: buildNodeTitle(r),
    isLeaf: false,
    dataRef: r,
  }))
}

const updateTreeData = (list: DataNode[], key: React.Key, children: DataNode[] | null, markLeaf?: boolean): DataNode[] => {
  return list.map((node) => {
    if (node.key === key) {
      const next: DataNode = { ...node }
      if (children) next.children = children
      if (markLeaf) next.isLeaf = true
      return next
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children, markLeaf),
      }
    }
    return node
  })
}

const FinCategoriesPage = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [activeOnly, setActiveOnly] = useState(true)
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<FinCategoryRecord | null>(null)

  const [createModal, setCreateModal] = useState<{ open: boolean; parentId?: number }>({ open: false })
  const [editModal, setEditModal] = useState<{ open: boolean }>({ open: false })
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const rootQuery = useQuery({
    queryKey: ['fin', 'categories', 'root', { activeOnly }, effectiveCompanyId],
    queryFn: () => fetchFinCategories({ companyId: effectiveCompanyId, activeOnly }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  useEffect(() => {
    if (rootQuery.data?.records) {
      setTreeData(recordsToNodes(rootQuery.data.records))
      setSelectedKey(null)
      setSelectedRecord(null)
    }
  }, [rootQuery.data?.records])

  const loadChildren = useCallback(
    async (nodeKey: React.Key) => {
      const id = Number(nodeKey)
      if (!id) return

      const data = await queryClient.fetchQuery({
        queryKey: ['fin', 'categories', 'children', id, { activeOnly }, effectiveCompanyId],
        queryFn: () => fetchFinCategories({ companyId: effectiveCompanyId, parentId: id, activeOnly }),
      })

      const childrenNodes = recordsToNodes(data.records || [])
      if (!childrenNodes.length) {
        setTreeData((prev) => updateTreeData(prev, nodeKey, null, true))
        return
      }
      setTreeData((prev) => updateTreeData(prev, nodeKey, childrenNodes, false))
    },
    [activeOnly, effectiveCompanyId, queryClient],
  )

  const onLoadData: TreeProps['loadData'] = async ({ key, children, isLeaf }) => {
    if (isLeaf) return
    if (children && children.length) return
    await loadChildren(key)
  }

  const onSelect: TreeProps['onSelect'] = (_keys, info) => {
    const node: any = info.node
    const k = String(node.key)
    setSelectedKey(k)
    setSelectedRecord(node.dataRef || null)
  }

  const createMutation = useMutation({
    mutationFn: createFinCategory,
    onSuccess: () => {
      message.success('已创建')
      setCreateModal({ open: false })
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['fin', 'categories'] })
    },
    onError: (e) => message.error((e as Error).message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: { name?: string; sort_order?: number; is_active?: number } }) =>
      updateFinCategory(payload.id, { ...payload.data, companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('已更新')
      setEditModal({ open: false })
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['fin', 'categories'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: number; isActive: number }) =>
      toggleFinCategoryActive(payload.id, { is_active: payload.isActive, companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['fin', 'categories'] })
    },
    onError: (e) => message.error((e as Error).message || '更新失败'),
  })

  const treeEmpty = useMemo(() => {
    if (rootQuery.isLoading) return false
    return !treeData.length
  }, [rootQuery.isLoading, treeData.length])

  const userPosition = (user as any)?.positionType || (user as any)?.position_type
  const canEdit = isSuperAdmin || ['财务', '总经理'].includes(userPosition)

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              费用分类
            </Title>
            {isSuperAdmin && !effectiveCompanyId ? <Text type="warning">请先在右上角选择公司</Text> : null}
          </div>
          <Space>
            <Space>
              <Text>仅启用</Text>
              <Switch checked={activeOnly} onChange={setActiveOnly} />
            </Space>
            <Button
              type="primary"
              onClick={() => {
                if (!canEdit) {
                  message.error('无权限')
                  return
                }
                setCreateModal({ open: true })
                createForm.setFieldsValue({ is_active: true, sort_order: 0 })
              }}
              disabled={isSuperAdmin && !effectiveCompanyId}
            >
              新增一级
            </Button>
            <Button
              onClick={() => {
                if (!canEdit) {
                  message.error('无权限')
                  return
                }
                if (!selectedRecord) {
                  message.warning('请先选择一个分类')
                  return
                }
                setCreateModal({ open: true, parentId: selectedRecord.id })
                createForm.setFieldsValue({ is_active: true, sort_order: 0 })
              }}
              disabled={!selectedRecord || (isSuperAdmin && !effectiveCompanyId)}
            >
              新增子级
            </Button>
            <Button
              onClick={() => {
                if (!canEdit) {
                  message.error('无权限')
                  return
                }
                if (!selectedRecord) {
                  message.warning('请先选择一个分类')
                  return
                }
                setEditModal({ open: true })
                editForm.setFieldsValue({
                  name: selectedRecord.name,
                  sort_order: selectedRecord.sort_order,
                  is_active: Number(selectedRecord.is_active) === 1,
                })
              }}
              disabled={!selectedRecord || (isSuperAdmin && !effectiveCompanyId)}
            >
              编辑
            </Button>
            <Button
              danger={Number(selectedRecord?.is_active) === 1}
              onClick={() => {
                if (!canEdit) {
                  message.error('无权限')
                  return
                }
                if (!selectedRecord) {
                  message.warning('请先选择一个分类')
                  return
                }
                const next = Number(selectedRecord.is_active) === 1 ? 0 : 1
                Modal.confirm({
                  title: next === 1 ? '确认启用？' : '确认停用？',
                  onOk: async () => {
                    toggleMutation.mutate({ id: selectedRecord.id, isActive: next })
                  },
                })
              }}
              disabled={!selectedRecord || (isSuperAdmin && !effectiveCompanyId)}
              loading={toggleMutation.isPending}
            >
              {Number(selectedRecord?.is_active) === 1 ? '停用' : '启用'}
            </Button>
            <Button
              onClick={() => {
                message.info('当前为只读树形展示')
              }}
            >
              说明
            </Button>
          </Space>
        </div>

        <Card>
          {treeEmpty ? (
            <Empty description="暂无分类" />
          ) : (
            <Tree
              showLine
              blockNode
              defaultExpandAll={false}
              treeData={treeData}
              loadData={onLoadData}
              onSelect={onSelect}
            />
          )}
        </Card>
      </Space>

      <Modal
        title={createModal.parentId ? '新增子分类' : '新增一级分类'}
        open={createModal.open}
        onCancel={() => setCreateModal({ open: false })}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => {
            createMutation.mutate({
              companyId: effectiveCompanyId,
              name: values.name,
              parent_id: createModal.parentId,
              sort_order: Number(values.sort_order || 0),
              is_active: values.is_active ? 1 : 0,
            })
          }}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑分类"
        open={editModal.open}
        onCancel={() => setEditModal({ open: false })}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedRecord) return
            updateMutation.mutate({
              id: selectedRecord.id,
              data: {
                name: values.name,
                sort_order: Number(values.sort_order || 0),
                is_active: values.is_active ? 1 : 0,
              },
            })
          }}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <Input />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FinCategoriesPage
