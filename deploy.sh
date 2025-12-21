#!/bin/bash

# Web管理后台部署脚本
# 用法: ./deploy.sh

set -e

echo "🚀 开始部署Web管理后台..."

# 1. 构建项目
echo "📦 构建项目..."
npx vite build

# 2. 打包
echo "📦 打包dist目录..."
tar -czf dist.tar.gz dist/

# 3. 上传到服务器
echo "📤 上传到服务器..."
scp dist.tar.gz admin@47.108.135.142:/tmp/

# 4. 在服务器上解压并部署
echo "🔧 在服务器上部署..."
ssh admin@47.108.135.142 "cd /tmp && tar -xzf dist.tar.gz && sudo rm -rf /var/www/admin/* && sudo mv dist/* /var/www/admin/ && sudo chown -R www:www /var/www/admin && rm -rf dist dist.tar.gz"

# 5. 清理本地临时文件
echo "🧹 清理本地临时文件..."
rm dist.tar.gz

echo "✅ 部署完成！"
echo "🌐 访问地址: https://admin.hodaruner.cn"
