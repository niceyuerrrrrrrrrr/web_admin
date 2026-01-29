#!/usr/bin/env python3
"""
为 Receipts.tsx 的所有列定义添加 onHeaderCell 配置
"""
import re
import sys

def add_onheadercell_to_column(column_text, key_name):
    """为单个列定义添加 onHeaderCell"""
    # 如果已经有 onHeaderCell，跳过
    if 'onHeaderCell' in column_text:
        return column_text
    
    # 找到 width 行
    width_match = re.search(r'width:\s*(\d+|columnWidths\.\w+)', column_text)
    if not width_match:
        return column_text
    
    width_value = width_match.group(1)
    
    # 如果 width 是数字，使用 columnWidths[key]
    if width_value.isdigit():
        width_ref = f'columnWidths.{key_name}'
    else:
        width_ref = width_value
    
    # 在 width 行后添加 onHeaderCell
    onheadercell_code = f'''onHeaderCell: () => ({{\n          width: {width_ref},\n          onResize: handleResize('{key_name}'),\n        }}),'''
    
    # 找到 width 行的位置，在其后插入
    lines = column_text.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        if 'width:' in line and 'onHeaderCell' not in column_text:
            # 获取缩进
            indent = len(line) - len(line.lstrip())
            # 添加 onHeaderCell
            for onheader_line in onheadercell_code.split('\n'):
                new_lines.append(' ' * indent + onheader_line)
    
    return '\n'.join(new_lines)

def process_file(filepath):
    """处理文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到所有列定义块
    # 匹配 { title: ..., dataIndex: ..., width: ..., ... }
    pattern = r'(\{[\s\S]*?title:\s*[\'"]([^\'"]+)[\'"][\s\S]*?width:\s*\d+[\s\S]*?\})'
    
    def replace_column(match):
        column_block = match.group(0)
        title = match.group(2)
        
        # 尝试提取 dataIndex 或 key
        dataindex_match = re.search(r'dataIndex:\s*[\'"]?(\w+)[\'"]?', column_block)
        key_match = re.search(r'key:\s*[\'"](\w+)[\'"]', column_block)
        
        if dataindex_match:
            key_name = dataindex_match.group(1)
        elif key_match:
            key_name = key_match.group(1)
        else:
            # 使用 title 生成 key
            key_name = title.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')
        
        # 添加 onHeaderCell
        new_column = add_onheadercell_to_column(column_block, key_name)
        return new_column
    
    # 替换所有列定义
    new_content = re.sub(pattern, replace_column, content)
    
    # 写回文件
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✅ 已处理文件: {filepath}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python add_resizable_columns.py <文件路径>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    process_file(filepath)



