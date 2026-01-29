#!/bin/bash

# 批量为文件添加列宽调整功能的脚本

FILES=(
  "Leave.tsx"
  "MaterialRequests.tsx"
  "Reports.tsx"
  "Inventory.tsx"
)

cd /Users/niesiyu/Desktop/web-admin/src/pages

for file in "${FILES[@]}"; do
  echo "处理 $file..."
  
  # 备份
  cp "$file" "${file}.bak"
  
  # 1. 添加 useCallback 到 import (如果还没有)
  if ! grep -q "useCallback" "$file"; then
    sed -i '' 's/import { \(.*\)useState/import { useCallback, \1useState/' "$file"
  fi
  
  # 2. 添加 ResizableHeaderCell 导入 (如果还没有)
  if ! grep -q "ResizableHeaderCell" "$file"; then
    # 在最后一个 store 导入后添加
    sed -i '' "/import.*store/a\\
import ResizableHeaderCell from '../components/ResizableHeaderCell'
" "$file"
  fi
  
  echo "✓ $file 导入已更新"
done

echo "所有文件导入已更新！"
echo "接下来需要手动添加："
echo "1. 列宽状态管理"
echo "2. addResizableToColumns 函数"
echo "3. columnsResizable 变量"
echo "4. 更新 Table 组件"



