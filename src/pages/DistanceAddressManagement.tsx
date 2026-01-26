import { useMemo, useState, type Key } from 'react'
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import MapPicker from '../components/MapPicker'
import type { NavigationAddress } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import {
  createNavigationAddress,
  deleteNavigationAddress,
  fetchNavigationAddresses,
  updateNavigationAddress,
} from '../api/services/navigation'

const { Title } = Typography

const DEFAULT_PLACEHOLDER_ADDRESS = '待补充地址'
const DEFAULT_LONGITUDE = 0
const DEFAULT_LATITUDE = 0

type AddressType = 'loading' | 'unloading'

interface Props {
  addressType: AddressType
  title: string
}

const DistanceAddressManagementPage = ({ addressType, title }: Props) => {
  const queryClient = useQueryClient()
  const { message, modal } = AntdApp.useApp()

  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId

  const [keyword, setKeyword] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<NavigationAddress | null>(null)
  const [form] = Form.useForm()

  const [batchCreateOpen, setBatchCreateOpen] = useState(false)
  const [batchCreateText, setBatchCreateText] = useState('')

  const [quickCreate, setQuickCreate] = useState(true)

  const [batchEditOpen, setBatchEditOpen] = useState(false)
  const [batchEditForm] = Form.useForm()

  const listQuery = useQuery({
    queryKey: ['navigation', 'addresses', addressType, keyword, effectiveCompanyId],
    queryFn: () => fetchNavigationAddresses({ type: addressType, keyword, companyId: effectiveCompanyId }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const addresses = listQuery.data?.addresses || []

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createNavigationAddress>[0]) =>
      createNavigationAddress(data, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('新增成功')
      setEditModalOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
    },
    onError: (error) => message.error((error as Error).message || '新增失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: Parameters<typeof updateNavigationAddress>[1] }) =>
      updateNavigationAddress(payload.id, payload.data, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('更新成功')
      setEditModalOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
    },
    onError: (error) => message.error((error as Error).message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNavigationAddress(id, { companyId: effectiveCompanyId }),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const columns: ColumnsType<NavigationAddress> = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', width: 180 },
      { title: '详细地址', dataIndex: 'address' },
      {
        title: '经纬度',
        width: 160,
        render: (_, r) =>
          typeof r.longitude === 'number' && typeof r.latitude === 'number'
            ? `${r.longitude.toFixed(6)}, ${r.latitude.toFixed(6)}`
            : '-',
      },
      { title: '联系人', dataIndex: 'contact', width: 120, render: (v) => v || '-' },
      { title: '电话', dataIndex: 'phone', width: 140, render: (v) => v || '-' },
      {
        title: '操作',
        width: 160,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record)
                form.setFieldsValue({
                  name: record.name,
                  address: record.address,
                  longitude: record.longitude ?? undefined,
                  latitude: record.latitude ?? undefined,
                  contact: record.contact ?? undefined,
                  phone: record.phone ?? undefined,
                  remark: record.remark ?? undefined,
                })
                setEditModalOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                modal.confirm({
                  title: '确认删除',
                  content: `确定删除地址「${record.name}」吗？`,
                  onOk: () => deleteMutation.mutate(record.id),
                })
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [deleteMutation, form, modal],
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ type: addressType })
    setQuickCreate(true)
    setEditModalOpen(true)
  }

  const saveAddress = async () => {
    const values = await form.validateFields()

    const resolvedAddress = values.address || values.name || DEFAULT_PLACEHOLDER_ADDRESS
    const resolvedLongitude = values.longitude ?? DEFAULT_LONGITUDE
    const resolvedLatitude = values.latitude ?? DEFAULT_LATITUDE
    const payload = {
      type: addressType,
      name: values.name,
      address: resolvedAddress,
      longitude: resolvedLongitude,
      latitude: resolvedLatitude,
      contact: values.contact,
      phone: values.phone,
      remark: values.remark,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload })
      return
    }

    createMutation.mutate(payload)
  }

  const doBatchDelete = () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的记录')
      return
    }

    modal.confirm({
      title: '批量删除',
      content: `确定删除选中的 ${selectedRowKeys.length} 条记录吗？`,
      onOk: async () => {
        const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n))
        await Promise.all(ids.map((id) => deleteNavigationAddress(id, { companyId: effectiveCompanyId })))
        setSelectedRowKeys([])
        message.success('批量删除成功')
        queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
      },
    })
  }

  const doBatchEdit = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要编辑的记录')
      return
    }

    const values = await batchEditForm.validateFields()
    const ids = selectedRowKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n))

    await Promise.all(
      ids.map((id) =>
        updateNavigationAddress(
          id,
          {
          contact: values.contact,
          phone: values.phone,
          remark: values.remark,
          },
          { companyId: effectiveCompanyId },
        ),
      ),
    )

    setBatchEditOpen(false)
    batchEditForm.resetFields()
    setSelectedRowKeys([])
    message.success('批量更新成功')
    queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
  }

  const geocodeIfNeeded = async (addr: string): Promise<{ lng: number; lat: number } | null> => {
    if (!(window as any).AMap) {
      return null
    }

    return new Promise((resolve) => {
      try {
        ;(window as any).AMap.plugin('AMap.Geocoder', () => {
          const geocoder = new (window as any).AMap.Geocoder({ city: '全国' })
          geocoder.getLocation(addr, (status: string, result: any) => {
            if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
              const loc = result.geocodes[0].location
              resolve({ lng: loc.lng, lat: loc.lat })
            } else {
              resolve(null)
            }
          })
        })
      } catch {
        resolve(null)
      }
    })
  }

  const doBatchCreate = async () => {
    const text = batchCreateText.trim()
    if (!text) {
      message.warning('请输入要导入的数据')
      return
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) {
      message.warning('未解析到有效数据')
      return
    }

    const errors: string[] = []
    const tasks: Array<Parameters<typeof createNavigationAddress>[0]> = []

    for (let i = 0; i < lines.length; i += 1) {
      const parts = lines[i].split(/[\t,，]+/).map((p) => p.trim()).filter(Boolean)
      const name = parts[0]
      const address = parts[1]
      const lng = parts[2]
      const lat = parts[3]
      const contact = parts[4]
      const phone = parts[5]
      const remark = parts[6]

      if (!name) {
        errors.push(`第${i + 1}行：缺少名称`)
        continue
      }

      let longitude: number | undefined
      let latitude: number | undefined

      if (lng && lat && !Number.isNaN(Number(lng)) && !Number.isNaN(Number(lat))) {
        longitude = Number(lng)
        latitude = Number(lat)
      } else {
        const geo = address ? await geocodeIfNeeded(address) : null
        if (geo) {
          longitude = geo.lng
          latitude = geo.lat
        }
      }

      if (longitude === undefined || latitude === undefined) {
        longitude = DEFAULT_LONGITUDE
        latitude = DEFAULT_LATITUDE
      }

      tasks.push({
        type: addressType,
        name,
        address: address || DEFAULT_PLACEHOLDER_ADDRESS,
        longitude,
        latitude,
        contact,
        phone,
        remark,
      })
    }

    if (!tasks.length) {
      modal.warning({
        title: '导入失败',
        content: errors.length ? errors.join('\n') : '未生成任何有效数据',
      })
      return
    }

    await Promise.all(tasks.map((t) => createNavigationAddress(t, { companyId: effectiveCompanyId })))

    if (errors.length) {
      modal.warning({
        title: '部分导入失败',
        content: `成功导入 ${tasks.length} 条，失败 ${errors.length} 条：\n${errors.join('\n')}`,
      })
    } else {
      message.success(`批量导入成功：${tasks.length} 条`)
    }

    setBatchCreateOpen(false)
    setBatchCreateText('')
    queryClient.invalidateQueries({ queryKey: ['navigation', 'addresses'] })
  }

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {showCompanyWarning ? <Alert type="warning" showIcon message="请先在顶部选择公司后再查看/编辑数据" /> : null}
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              {title}
            </Title>
            <Space>
              <Input
                allowClear
                placeholder="搜索名称/地址"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 240 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()} loading={listQuery.isFetching}>
                刷新
              </Button>
              <Button icon={<PlusOutlined />} type="primary" onClick={openCreate} disabled={showCompanyWarning}>
                新增
              </Button>
            </Space>
          </Space>

          <Space>
            <Button onClick={() => setBatchCreateOpen(true)} disabled={showCompanyWarning}>
              批量新增
            </Button>
            <Button onClick={() => setBatchEditOpen(true)} disabled={showCompanyWarning || !selectedRowKeys.length}>
              批量编辑
            </Button>
            <Button danger onClick={doBatchDelete} disabled={showCompanyWarning || !selectedRowKeys.length}>
              批量删除
            </Button>
          </Space>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={addresses}
            loading={listQuery.isFetching}
            scroll={{ x: 900 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          />
        </Space>
      </Card>

      <Modal
        title={editing ? '编辑地址' : '新增地址'}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={saveAddress}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={900}
      >
        <Form form={form} layout="vertical">
          {!editing ? (
            <Space style={{ marginBottom: 12 }}>
              <span>仅填名称快速新增</span>
              <Switch checked={quickCreate} onChange={setQuickCreate} />
              {quickCreate ? (
                <Alert
                  type="warning"
                  showIcon
                  message="将使用默认地址/默认坐标占位，后续请编辑补全，否则导航定位可能不准确"
                />
              ) : null}
            </Space>
          ) : null}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="名称" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系人" name="contact">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="详细地址" name="address" rules={[{ required: editing ? true : !quickCreate }]}>
            <Input />
          </Form.Item>

          {!editing && quickCreate ? null : (
            <Form.Item label="选择位置">
              <MapPicker
                lng={form.getFieldValue('longitude')}
                lat={form.getFieldValue('latitude')}
                onChange={(lng, lat, addr) => {
                  form.setFieldsValue({
                    longitude: lng,
                    latitude: lat,
                    address: addr || form.getFieldValue('address'),
                  })
                }}
                height={320}
              />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="经度"
                name="longitude"
                rules={editing || !quickCreate ? [{ required: true, type: 'number' }] : []}
              >
                <InputNumber className="w-full" controls={false} precision={6} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="纬度"
                name="latitude"
                rules={editing || !quickCreate ? [{ required: true, type: 'number' }] : []}
              >
                <InputNumber className="w-full" controls={false} precision={6} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="电话" name="phone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" name="remark">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="批量新增"
        open={batchCreateOpen}
        onCancel={() => {
          setBatchCreateOpen(false)
          setBatchCreateText('')
        }}
        onOk={doBatchCreate}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            支持每行一条：名称, 详细地址, 经度, 纬度, 联系人, 电话, 备注（除名称外均可省略；缺省时会使用默认地址/默认坐标占位）
          </div>
          <Input.TextArea rows={10} value={batchCreateText} onChange={(e) => setBatchCreateText(e.target.value)} />
        </Space>
      </Modal>

      <Modal
        title="批量编辑"
        open={batchEditOpen}
        onCancel={() => {
          setBatchEditOpen(false)
          batchEditForm.resetFields()
        }}
        onOk={doBatchEdit}
      >
        <Form form={batchEditForm} layout="vertical">
          <Form.Item label="联系人" name="contact">
            <Input />
          </Form.Item>
          <Form.Item label="电话" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DistanceAddressManagementPage
