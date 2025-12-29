import { useCallback, useEffect, useState } from 'react'
import { Button, Checkbox, Drawer, Space, Typography } from 'antd'
import { HolderOutlined, SettingOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const { Text } = Typography

export interface ColumnConfig {
  key: string
  title: string
  visible: boolean
  fixed?: 'left' | 'right' | boolean
}

interface SortableItemProps {
  id: string
  title: string
  visible: boolean
  disabled?: boolean
  onVisibleChange: (visible: boolean) => void
}

const SortableItem = ({ id, title, visible, disabled, onVisibleChange }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: '8px 12px',
    marginBottom: '4px',
    backgroundColor: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <span {...listeners} style={{ cursor: disabled ? 'not-allowed' : 'grab', color: '#999' }}>
        <HolderOutlined />
      </span>
      <Checkbox
        checked={visible}
        onChange={(e) => onVisibleChange(e.target.checked)}
        disabled={disabled}
      />
      <Text style={{ flex: 1 }}>{title}</Text>
      {disabled && <Text type="secondary" style={{ fontSize: 12 }}>固定列</Text>}
    </div>
  )
}

interface ColumnSettingsProps {
  storageKey: string
  defaultColumns: ColumnConfig[]
  onColumnsChange: (columns: ColumnConfig[]) => void
}

const ColumnSettings = ({ storageKey, defaultColumns, onColumnsChange }: ColumnSettingsProps) => {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ColumnConfig[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 从 localStorage 加载配置（仅在 storageKey 变化时执行）
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[]
        // 合并保存的配置和默认配置（处理新增列的情况）
        const mergedColumns = defaultColumns.map((defaultCol) => {
          const savedCol = savedColumns.find((c) => c.key === defaultCol.key)
          return savedCol ? { ...defaultCol, visible: savedCol.visible } : defaultCol
        })
        // 按保存的顺序排序
        const orderedColumns = savedColumns
          .map((savedCol) => mergedColumns.find((c) => c.key === savedCol.key))
          .filter(Boolean) as ColumnConfig[]
        // 添加新增的列
        const newColumns = mergedColumns.filter(
          (c) => !savedColumns.find((s) => s.key === c.key)
        )
        const finalColumns = [...orderedColumns, ...newColumns]
        setColumns(finalColumns)
        onColumnsChange(finalColumns)
      } catch {
        setColumns(defaultColumns)
        onColumnsChange(defaultColumns)
      }
    } else {
      setColumns(defaultColumns)
      onColumnsChange(defaultColumns)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // 保存配置到 localStorage
  const saveColumns = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns)
    localStorage.setItem(storageKey, JSON.stringify(newColumns))
    onColumnsChange(newColumns)
  }, [storageKey, onColumnsChange])

  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.key === active.id)
      const newIndex = columns.findIndex((c) => c.key === over.id)
      const newColumns = arrayMove(columns, oldIndex, newIndex)
      saveColumns(newColumns)
    }
  }, [columns, saveColumns])

  // 切换列可见性
  const handleVisibleChange = useCallback((key: string, visible: boolean) => {
    const newColumns = columns.map((c) =>
      c.key === key ? { ...c, visible } : c
    )
    saveColumns(newColumns)
  }, [columns, saveColumns])

  // 重置为默认配置
  const handleReset = useCallback(() => {
    localStorage.removeItem(storageKey)
    setColumns(defaultColumns)
    onColumnsChange(defaultColumns)
  }, [storageKey, defaultColumns, onColumnsChange])

  // 全选/全不选
  const handleSelectAll = useCallback((checked: boolean) => {
    const newColumns = columns.map((c) => ({
      ...c,
      visible: c.fixed ? true : checked, // 固定列始终显示
    }))
    saveColumns(newColumns)
  }, [columns, saveColumns])

  const allVisible = columns.filter((c) => !c.fixed).every((c) => c.visible)
  const someVisible = columns.filter((c) => !c.fixed).some((c) => c.visible)

  return (
    <>
      <Button
        icon={<SettingOutlined />}
        onClick={() => setOpen(true)}
      >
        列设置
      </Button>
      <Drawer
        title="列设置"
        placement="right"
        width={320}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button size="small" onClick={handleReset}>
              重置
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Checkbox
            indeterminate={someVisible && !allVisible}
            checked={allVisible}
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            全选
          </Checkbox>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.key)}
            strategy={verticalListSortingStrategy}
          >
            {columns.map((column) => (
              <SortableItem
                key={column.key}
                id={column.key}
                title={column.title}
                visible={column.visible}
                disabled={!!column.fixed}
                onVisibleChange={(visible) => handleVisibleChange(column.key, visible)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            拖拽调整列顺序，勾选控制列显示/隐藏
          </Text>
        </div>
      </Drawer>
    </>
  )
}

export default ColumnSettings
