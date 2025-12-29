import { useCallback, useMemo, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import type { ColumnConfig } from '../components/ColumnSettings'

/**
 * 从 Ant Design 列定义生成列配置
 */
export function generateColumnConfig<T>(columns: ColumnsType<T>): ColumnConfig[] {
  return columns.map((col) => ({
    key: String((col as { dataIndex?: string }).dataIndex || (col as { key?: string }).key || ''),
    title: String(col.title || ''),
    visible: true,
    fixed: col.fixed,
  }))
}

/**
 * 根据列配置过滤和排序列
 */
export function applyColumnConfig<T>(
  columns: ColumnsType<T>,
  config: ColumnConfig[]
): ColumnsType<T> {
  if (!config.length) return columns

  // 按配置顺序排序，并过滤不可见的列
  const orderedColumns: ColumnsType<T> = []
  
  for (const cfg of config) {
    if (!cfg.visible) continue
    const col = columns.find((c) => {
      const key = String((c as { dataIndex?: string }).dataIndex || (c as { key?: string }).key || '')
      return key === cfg.key
    })
    if (col) {
      orderedColumns.push(col)
    }
  }

  // 添加配置中没有的新列（可能是后来添加的）
  for (const col of columns) {
    const key = String((col as { dataIndex?: string }).dataIndex || (col as { key?: string }).key || '')
    if (!config.find((c) => c.key === key)) {
      orderedColumns.push(col)
    }
  }

  return orderedColumns
}

/**
 * 列配置 Hook
 */
export function useColumnSettings<T>(
  _storageKey: string,
  originalColumns: ColumnsType<T>
) {
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([])

  const defaultConfig = useMemo(
    () => generateColumnConfig(originalColumns),
    [originalColumns]
  )

  const displayColumns = useMemo(
    () => applyColumnConfig(originalColumns, columnConfig),
    [originalColumns, columnConfig]
  )

  const handleColumnsChange = useCallback((config: ColumnConfig[]) => {
    setColumnConfig(config)
  }, [])

  return {
    defaultConfig,
    displayColumns,
    handleColumnsChange,
  }
}

export default useColumnSettings
