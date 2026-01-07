# Receipts页面UI更新补丁

## 需要在Receipts.tsx中添加的代码片段

### 1. 在搜索表单中添加删除状态筛选器

在搜索表单的Form.Item列表中添加（大约在第1800-2000行之间，搜索 `<Form` 和 `onFinish={handleSearch}`）：

```tsx
<Form.Item label="删除状态" name="deletedStatus" initialValue="normal">
  <Select
    placeholder="选择删除状态"
    allowClear
    style={{ width: 150 }}
    options={[
      { label: '全部', value: 'all' },
      { label: '正常', value: 'normal' },
      { label: '已删除', value: 'deleted' },
    ]}
  />
</Form.Item>
```

### 2. 在装料单列定义中添加删除状态列

在 `loadingColumns` 定义中添加（大约在第653-767行）：

```tsx
{
  title: '删除状态',
  dataIndex: 'deleted_at',
  width: 150,
  render: (deleted_at: string | null, record: Receipt) => {
    if (deleted_at) {
      return (
        <Tag color="red">
          已删除
          <br />
          <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
          {record.deleted_by_name && (
            <>
              <br />
              <small>删除人：{record.deleted_by_name}</small>
            </>
          )}
        </Tag>
      )
    }
    return <Tag color="green">正常</Tag>
  },
},
```

**插入位置**：在 `created_at` 列之后，`thumb_url` 列之前

### 3. 在卸货单列定义中添加删除状态列

在 `unloadingColumns` 定义中添加（大约在第770-884行）：

```tsx
{
  title: '删除状态',
  dataIndex: 'deleted_at',
  width: 150,
  render: (deleted_at: string | null, record: Receipt) => {
    if (deleted_at) {
      return (
        <Tag color="red">
          已删除
          <br />
          <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
          {record.deleted_by_name && (
            <>
              <br />
              <small>删除人：{record.deleted_by_name}</small>
            </>
          )}
        </Tag>
      )
    }
    return <Tag color="green">正常</Tag>
  },
},
```

**插入位置**：在 `created_at` 列之后，`thumb_url` 列之前

### 4. 在充电单列定义中添加删除状态列

在 `chargingColumns` 定义中添加（大约在第887行之后）：

```tsx
{
  title: '删除状态',
  dataIndex: 'deleted_at',
  width: 150,
  render: (deleted_at: string | null, record: Receipt) => {
    if (deleted_at) {
      return (
        <Tag color="red">
          已删除
          <br />
          <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
          {record.deleted_by_name && (
            <>
              <br />
              <small>删除人：{record.deleted_by_name}</small>
            </>
          )}
        </Tag>
      )
    }
    return <Tag color="green">正常</Tag>
  },
},
```

### 5. 在水票列定义中添加删除状态列和图片列

在 `waterColumns` 定义中添加（需要找到水票的列定义）：

```tsx
// 删除状态列
{
  title: '删除状态',
  dataIndex: 'deleted_at',
  width: 150,
  render: (deleted_at: string | null, record: Receipt) => {
    if (deleted_at) {
      return (
        <Tag color="red">
          已删除
          <br />
          <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
          {record.deleted_by_name && (
            <>
              <br />
              <small>删除人：{record.deleted_by_name}</small>
            </>
          )}
        </Tag>
      )
    }
    return <Tag color="green">正常</Tag>
  },
},
// 图片列
{
  title: '水票图片',
  dataIndex: 'thumb_url',
  width: 100,
  render: (value: string, record: any) => {
    const imageUrl = value || record.image_path
    if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
      return '-'
    }
    return (
      <Image
        src={imageUrl}
        width={60}
        height={60}
        style={{ objectFit: 'cover', borderRadius: 4 }}
        preview={{ mask: '查看' }}
      />
    )
  },
},
```

### 6. 在出厂单列定义中添加删除状态列和图片列

在 `departureColumns` 定义中添加：

```tsx
// 删除状态列
{
  title: '删除状态',
  dataIndex: 'deleted_at',
  width: 150,
  render: (deleted_at: string | null, record: Receipt) => {
    if (deleted_at) {
      return (
        <Tag color="red">
          已删除
          <br />
          <small>{dayjs(deleted_at).format('YYYY-MM-DD HH:mm')}</small>
          {record.deleted_by_name && (
            <>
              <br />
              <small>删除人：{record.deleted_by_name}</small>
            </>
          )}
        </Tag>
      )
    }
    return <Tag color="green">正常</Tag>
  },
},
// 图片列
{
  title: '出厂单图片',
  dataIndex: 'thumb_url',
  width: 100,
  render: (value: string, record: any) => {
    const imageUrl = value || record.image_path
    if (!imageUrl || imageUrl.startsWith('wxfile://') || imageUrl.startsWith('file://')) {
      return '-'
    }
    return (
      <Image
        src={imageUrl}
        width={60}
        height={60}
        style={{ objectFit: 'cover', borderRadius: 4 }}
        preview={{ mask: '查看' }}
      />
    )
  },
},
```

### 7. 更新装卸匹配删除按钮（添加权限控制）

找到 `handleDeleteMatched` 函数（大约在第488-507行），更新为：

```tsx
const handleDeleteMatched = useCallback((record: any) => {
  // 检查权限：仅超级管理员和统计员
  const canDeleteMatch = isSuperAdmin || ['统计', '统计员'].includes(user?.positionType || '')
  
  if (!canDeleteMatch) {
    message.warning('仅超级管理员和统计员可以删除装卸匹配')
    return
  }
  
  modal.confirm({
    title: '确认删除装卸匹配',
    content: (
      <div>
        <p>确定要删除任务 <strong>{record.task_id}</strong> 的装卸匹配吗？</p>
        <Alert
          message="重要提示"
          description="此操作将同时软删除关联的装料单和卸货单，但数据可在回收站恢复。"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </div>
    ),
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    width: 500,
    onOk: async () => {
      try {
        await deleteTransportTaskMutation.mutateAsync(record.task_id)
      } catch (error) {
        // Error is handled by mutation
      }
    },
  })
}, [modal, deleteTransportTaskMutation, isSuperAdmin, user, message])
```

找到装卸匹配的操作列渲染（在 matchedColumns 中），更新为：

```tsx
{
  title: '操作',
  width: 120,
  fixed: 'right',
  render: (_, record) => {
    // 检查权限：仅超级管理员和统计员可以删除
    const canDeleteMatch = isSuperAdmin || ['统计', '统计员'].includes(user?.positionType || '')
    
    return (
      <Space direction="vertical" size={0}>
        <Button 
          type="link" 
          size="small" 
          icon={<EyeOutlined />} 
          onClick={() => openDetail(record)}
        >
          查看
        </Button>
        {canDeleteMatch && (
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteMatched(record)}
          >
            删除
          </Button>
        )}
      </Space>
    )
  },
}
```

### 8. 在详情抽屉中添加图片和删除信息显示

在详情抽屉的 Descriptions 中添加（找到 `<Drawer` 和 `title="票据详情"`）：

```tsx
{/* 图片显示 */}
{selectedReceipt?.thumb_url && 
 !selectedReceipt.thumb_url.startsWith('wxfile://') && 
 !selectedReceipt.thumb_url.startsWith('file://') && (
  <Descriptions.Item label="票据图片" span={3}>
    <Image
      src={selectedReceipt.thumb_url}
      width={200}
      style={{ borderRadius: 8 }}
      preview={{
        mask: '点击查看大图',
      }}
    />
  </Descriptions.Item>
)}

{/* 删除信息显示 */}
{selectedReceipt?.deleted_at && (
  <>
    <Descriptions.Item label="删除状态" span={3}>
      <Tag color="red">已删除</Tag>
    </Descriptions.Item>
    <Descriptions.Item label="删除时间" span={2}>
      {dayjs(selectedReceipt.deleted_at).format('YYYY-MM-DD HH:mm:ss')}
    </Descriptions.Item>
    <Descriptions.Item label="删除人">
      {selectedReceipt.deleted_by_name || '-'}
    </Descriptions.Item>
  </>
)}
```

**插入位置**：在 Descriptions 的最后，`</Descriptions>` 之前

---

## 需要导入的组件

确保在文件顶部已导入以下组件：

```tsx
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,  // 确保已导入 Tag
  Typography,
} from 'antd'
```

---

## 实施步骤

1. 打开 `/Users/niesiyu/Desktop/web-admin/src/pages/Receipts.tsx`
2. 按照上述补丁逐个添加代码片段
3. 保存文件
4. 运行 `npm run dev` 测试功能
5. 检查所有票据列表是否正确显示删除状态列
6. 测试删除状态筛选器是否工作正常
7. 测试装卸匹配删除按钮的权限控制

---

## 注意事项

1. **Tag组件**：确保已从antd导入Tag组件
2. **Alert组件**：确保已从antd导入Alert组件  
3. **权限检查**：装卸匹配删除按钮只对超级管理员和统计员显示
4. **默认值**：删除状态筛选器默认值为"normal"（只显示正常票据）
5. **图片兼容**：水票和出厂单的图片字段可能是`thumb_url`或`image_path`，需要兼容处理
