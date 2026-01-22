import { useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { BatchCreateUserItem, BatchUpdateUserItem } from '../api/services/users'

const { TextArea } = Input
const { Text } = Typography

interface BatchCreateModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: (users: BatchCreateUserItem[], skipDuplicates: boolean) => void
  loading: boolean
  companyId?: number
  departments: Array<{ id: number; title: string }>
}

export const BatchCreateUserModal = ({
  open,
  onCancel,
  onSubmit,
  loading,
  companyId,
  departments,
}: BatchCreateModalProps) => {
  const [users, setUsers] = useState<BatchCreateUserItem[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [textInput, setTextInput] = useState('')

  const POSITION_TYPES = [
    { value: '司机', label: '司机' },
    { value: '统计', label: '统计' },
    { value: '统计员', label: '统计员' },
    { value: '车队长', label: '车队长' },
    { value: '财务', label: '财务' },
    { value: '总经理', label: '总经理' },
  ]

  const handleAddUser = () => {
    setUsers([
      ...users,
      {
        nickname: '',
        phone: '',
        password: '123456',
        position_type: '司机',
        company_id: companyId,
        status: 'active',
      },
    ])
  }

  const handleRemoveUser = (index: number) => {
    setUsers(users.filter((_, i) => i !== index))
  }

  const handleUserChange = (index: number, field: keyof BatchCreateUserItem, value: any) => {
    const newUsers = [...users]
    newUsers[index] = { ...newUsers[index], [field]: value }
    setUsers(newUsers)
  }

  const handleParseText = () => {
    if (!textInput.trim()) {
      message.warning('请输入用户数据')
      return
    }

    const lines = textInput.trim().split('\n')
    const parsedUsers: BatchCreateUserItem[] = []

    lines.forEach((line) => {
      const parts = line.split(/[\t,，\s]+/).filter((p) => p.trim())
      if (parts.length >= 2) {
        parsedUsers.push({
          nickname: parts[0].trim(),
          phone: parts[1].trim(),
          position_type: parts[2]?.trim() || '司机',
          password: '123456',
          company_id: companyId,
          status: 'active',
        })
      }
    })

    if (parsedUsers.length === 0) {
      message.warning('未能解析出有效的用户数据')
      return
    }

    setUsers(parsedUsers)
    setTextInput('')
    message.success(`已解析 ${parsedUsers.length} 个用户`)
  }

  const handleSubmit = () => {
    if (users.length === 0) {
      message.warning('请至少添加一个用户')
      return
    }

    // 验证必填字段
    const invalidUsers = users.filter((u) => !u.nickname || !u.phone)
    if (invalidUsers.length > 0) {
      message.error('请填写所有用户的姓名和手机号')
      return
    }

    onSubmit(users, skipDuplicates)
  }

  const handleCancel = () => {
    setUsers([])
    setTextInput('')
    onCancel()
  }

  const columns: ColumnsType<BatchCreateUserItem & { index: number }> = [
    {
      title: '序号',
      dataIndex: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '姓名*',
      dataIndex: 'nickname',
      width: 120,
      render: (value, _, index) => (
        <Input
          value={value}
          onChange={(e) => handleUserChange(index, 'nickname', e.target.value)}
          placeholder="请输入姓名"
        />
      ),
    },
    {
      title: '手机号*',
      dataIndex: 'phone',
      width: 130,
      render: (value, _, index) => (
        <Input
          value={value}
          onChange={(e) => handleUserChange(index, 'phone', e.target.value)}
          placeholder="请输入手机号"
        />
      ),
    },
    {
      title: '职位',
      dataIndex: 'position_type',
      width: 120,
      render: (value, _, index) => (
        <Select
          value={value}
          onChange={(val) => handleUserChange(index, 'position_type', val)}
          options={POSITION_TYPES}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '部门',
      dataIndex: 'department_id',
      width: 120,
      render: (value, _, index) => (
        <Select
          value={value}
          onChange={(val) => handleUserChange(index, 'department_id', val)}
          options={departments.map((d) => ({ value: d.id, label: d.title }))}
          placeholder="选择部门"
          allowClear
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '车牌号',
      dataIndex: 'plate',
      width: 120,
      render: (value, _, index) => (
        <Input
          value={value}
          onChange={(e) => handleUserChange(index, 'plate', e.target.value)}
          placeholder="车牌号"
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_, __, index) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveUser(index)}
        >
          删除
        </Button>
      ),
    },
  ]

  return (
    <Modal
      title="批量新增用户"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      width={1200}
      confirmLoading={loading}
      okText="提交"
      cancelText="取消"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>方式一：文本批量导入</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            （每行一个用户，格式：姓名 手机号 职位，用空格或Tab分隔）
          </Text>
          <TextArea
            rows={4}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="示例：&#10;张三 13800138000 司机&#10;李四 13800138001 车队长"
            style={{ marginTop: 8 }}
          />
          <Button onClick={handleParseText} style={{ marginTop: 8 }}>
            解析并添加
          </Button>
        </div>

        <div>
          <Space>
            <Text strong>方式二：手动添加</Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
              添加用户
            </Button>
            <Text type="secondary">已添加 {users.length} 个用户</Text>
          </Space>
        </div>

        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <Table
            columns={columns}
            dataSource={users.map((u, i) => ({ ...u, index: i }))}
            pagination={false}
            rowKey="index"
            size="small"
          />
        </div>

        <div>
          <Space>
            <Text>跳过重复手机号：</Text>
            <Select
              value={skipDuplicates}
              onChange={setSkipDuplicates}
              options={[
                { value: true, label: '是（推荐）' },
                { value: false, label: '否' },
              ]}
              style={{ width: 150 }}
            />
          </Space>
        </div>
      </Space>
    </Modal>
  )
}

interface BatchUpdateModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: (users: BatchUpdateUserItem[]) => void
  loading: boolean
  selectedUsers: Array<{ id: number; nickname?: string; phone?: string }>
  departments: Array<{ id: number; title: string }>
}

export const BatchUpdateUserModal = ({
  open,
  onCancel,
  onSubmit,
  loading,
  selectedUsers,
  departments,
}: BatchUpdateModalProps) => {
  const [form] = Form.useForm()
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [textInput, setTextInput] = useState('')
  const [parsedData, setParsedData] = useState<Array<{ name: string; id_card?: string; bank_card?: string; bank_name?: string }>>([])

  const POSITION_TYPES = [
    { value: '司机', label: '司机' },
    { value: '统计', label: '统计' },
    { value: '统计员', label: '统计员' },
    { value: '车队长', label: '车队长' },
    { value: '财务', label: '财务' },
    { value: '总经理', label: '总经理' },
  ]

  const handleParseText = () => {
    if (!textInput.trim()) {
      message.warning('请输入数据')
      return
    }

    const lines = textInput.trim().split('\n')
    const parsed: Array<{ name: string; id_card?: string; bank_card?: string; bank_name?: string }> = []

    lines.forEach((line) => {
      const parts = line.split(/[\t,，]+/).map(p => p.trim()).filter(p => p)
      if (parts.length >= 2) {
        const item: any = {
          name: parts[0],
        }
        
        // 根据列数判断数据类型
        if (parts.length === 2) {
          // 姓名 + 身份证号
          item.id_card = parts[1]
        } else if (parts.length === 3) {
          // 姓名 + 身份证号 + 银行卡号
          item.id_card = parts[1]
          item.bank_card = parts[2]
        } else if (parts.length >= 4) {
          // 姓名 + 身份证号 + 银行卡号 + 开户行
          item.id_card = parts[1]
          item.bank_card = parts[2]
          item.bank_name = parts[3]
        }
        
        parsed.push(item)
      }
    })

    if (parsed.length === 0) {
      message.warning('未能解析出有效数据')
      return
    }

    setParsedData(parsed)
    message.success(`已解析 ${parsed.length} 条数据`)
  }

  const handleSubmit = async () => {
    if (mode === 'simple') {
    try {
      const values = await form.validateFields()
      
      // 构建批量更新数据（只包含填写的字段）
      const updates: BatchUpdateUserItem[] = selectedUsers.map((user) => {
        const update: BatchUpdateUserItem = { id: user.id }
        
        if (values.position_type) update.position_type = values.position_type
        if (values.department_id) update.department_id = values.department_id
        if (values.status) update.status = values.status
        
        return update
      })

      onSubmit(updates)
    } catch (error) {
      // 表单验证失败
      }
    } else {
      // 高级模式：根据姓名匹配用户
      if (parsedData.length === 0) {
        message.warning('请先解析数据')
        return
      }

      const updates: BatchUpdateUserItem[] = []
      const notFoundUsers: string[] = []

      parsedData.forEach((data) => {
        // 根据姓名查找用户
        const user = selectedUsers.find(
          (u) => u.nickname === data.name || (u as any).name === data.name
        )

        if (user) {
          const update: BatchUpdateUserItem = { id: user.id }
          if (data.id_card) (update as any).id_card = data.id_card
          if (data.bank_card) update.bank_card = data.bank_card
          if (data.bank_name) update.bank_name = data.bank_name
          updates.push(update)
        } else {
          notFoundUsers.push(data.name)
        }
      })

      if (notFoundUsers.length > 0) {
        Modal.warning({
          title: '部分用户未找到',
          content: (
            <div>
              <p>以下用户在选中列表中未找到，将被跳过：</p>
              <ul>
                {notFoundUsers.map((name, idx) => (
                  <li key={idx}>{name}</li>
                ))}
              </ul>
              <p>匹配成功：{updates.length} 个用户</p>
            </div>
          ),
          onOk: () => {
            if (updates.length > 0) {
              onSubmit(updates)
            }
          },
        })
      } else {
        onSubmit(updates)
      }
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setTextInput('')
    setParsedData([])
    setMode('simple')
    onCancel()
  }

  return (
    <Modal
      title={`批量修改用户（已选择 ${selectedUsers.length} 个用户）`}
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      width={800}
      confirmLoading={loading}
      okText="提交"
      cancelText="取消"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>修改模式：</Text>
          <Select
            value={mode}
            onChange={setMode}
            style={{ width: 200, marginLeft: 8 }}
            options={[
              { value: 'simple', label: '简单模式（统一修改）' },
              { value: 'advanced', label: '高级模式（批量导入）' },
            ]}
          />
        </div>

        {mode === 'simple' ? (
          <>
        <div>
          <Text type="secondary">
            提示：只填写需要修改的字段，未填写的字段将保持原值不变
          </Text>
        </div>

        <div>
          <Text strong>已选择的用户：</Text>
              <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', border: '1px solid #d9d9d9', padding: 8, borderRadius: 4 }}>
            {selectedUsers.map((user) => (
              <div key={user.id}>
                <Text>
                  {user.nickname || '未命名'} ({user.phone || '无手机号'})
                </Text>
              </div>
            ))}
          </div>
        </div>

        <Form form={form} layout="vertical">
          <Form.Item label="职位类型" name="position_type">
            <Select
              placeholder="选择职位类型（不选则不修改）"
              options={POSITION_TYPES}
              allowClear
            />
          </Form.Item>

          <Form.Item label="部门" name="department_id">
            <Select
              placeholder="选择部门（不选则不修改）"
              options={departments.map((d) => ({ value: d.id, label: d.title }))}
              allowClear
            />
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select
              placeholder="选择状态（不选则不修改）"
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '禁用' },
              ]}
              allowClear
            />
          </Form.Item>
        </Form>
          </>
        ) : (
          <>
            <div>
              <Text strong>批量导入数据</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                （每行一个用户，格式：姓名 身份证号 [银行卡号] [开户行]，用Tab或逗号分隔）
              </Text>
              <TextArea
                rows={8}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="示例：&#10;张三	110101199001011234	6222021234567890123	中国工商银行&#10;李四	110101199002021234	6222021234567890124	中国建设银行&#10;&#10;或简化格式：&#10;张三	110101199001011234&#10;李四	110101199002021234"
                style={{ marginTop: 8, fontFamily: 'monospace' }}
              />
              <Space style={{ marginTop: 8 }}>
                <Button onClick={handleParseText}>解析数据</Button>
                <Button onClick={() => { setTextInput(''); setParsedData([]) }}>清空</Button>
              </Space>
            </div>

            {parsedData.length > 0 && (
              <div>
                <Text strong>解析结果（共 {parsedData.length} 条）：</Text>
                <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={parsedData}
                    rowKey={(_, index) => index!}
                    columns={[
                      { title: '序号', width: 60, render: (_, __, index) => index + 1 },
                      { title: '姓名', dataIndex: 'name', width: 100 },
                      { 
                        title: '身份证号', 
                        dataIndex: 'id_card',
                        render: (val) => val || <Text type="secondary">-</Text>
                      },
                      { 
                        title: '银行卡号', 
                        dataIndex: 'bank_card',
                        render: (val) => val || <Text type="secondary">-</Text>
                      },
                      { 
                        title: '开户行', 
                        dataIndex: 'bank_name',
                        render: (val) => val || <Text type="secondary">-</Text>
                      },
                      {
                        title: '匹配状态',
                        render: (_, record) => {
                          const found = selectedUsers.find(
                            (u) => u.nickname === record.name || (u as any).name === record.name
                          )
                          return found ? (
                            <Text type="success">✓ 已匹配</Text>
                          ) : (
                            <Text type="danger">✗ 未找到</Text>
                          )
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            )}

            <div>
              <Text type="warning" strong>
                注意：系统将根据姓名自动匹配已选择的用户，未匹配的数据将被跳过
              </Text>
            </div>
          </>
        )}
      </Space>
    </Modal>
  )
}
