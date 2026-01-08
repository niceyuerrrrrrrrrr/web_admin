#!/bin/bash

# Web管理后台部署脚本
# 用法: ./deploy.sh [--skip-build]

set -e

echo "🚀 开始部署Web管理后台..."

# 服务器配置
SERVER="47.108.135.142"
USER="admin"
REMOTE_PATH="/www/wwwroot/admin.hodaruner.cn"

# 检查是否跳过构建
SKIP_BUILD=false
if [ "$1" == "--skip-build" ]; then
  SKIP_BUILD=true
  echo "⏭️  跳过构建步骤"
fi

# 1. 构建前端（除非指定跳过）
if [ "$SKIP_BUILD" = false ]; then
  echo "📦 构建前端代码..."
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误信息"
    exit 1
  fi
fi

# 2. 确保dist目录存在
if [ ! -d "dist" ]; then
  echo "❌ dist目录不存在，请先运行 npm run build"
  exit 1
fi

# 3. 上传到服务器
echo "📤 上传到服务器..."
scp -r dist/* ${USER}@${SERVER}:/tmp/web-admin-deploy/

# 4. 在服务器上部署
echo "🔧 在服务器上部署..."
ssh ${USER}@${SERVER} << 'EOF'
sudo rm -rf /www/wwwroot/admin.hodaruner.cn/*
sudo cp -r /tmp/web-admin-deploy/* /www/wwwroot/admin.hodaruner.cn/
sudo chown -R nginx:nginx /www/wwwroot/admin.hodaruner.cn
sudo chmod -R 755 /www/wwwroot/admin.hodaruner.cn
sudo rm -rf /tmp/web-admin-deploy
echo "✅ 服务器端部署完成"
EOF

echo ""
echo "✅ 部署完成！"
echo "🌐 访问地址: https://admin.hodaruner.cn"
echo ""
echo "📝 提示："
echo "  - 使用 ./deploy.sh 进行完整部署（包含构建）"
echo "  - 使用 ./deploy.sh --skip-build 跳过构建步骤"
echo "  - 如果遇到权限问题，请确保SSH密钥已配置"
