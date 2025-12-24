#!/bin/bash

# Web管理后台部署脚本
# 用法: ./deploy.sh

set -e

echo "🚀 开始部署Web管理后台..."

# 服务器配置
SERVER="47.108.135.142"
USER="admin"
REMOTE_PATH="/var/www/admin"

# 1. 确保已构建
if [ ! -d "dist" ]; then
  echo "❌ dist目录不存在，请先运行 npm run build"
  exit 1
fi

# 2. 打包
echo "📦 打包dist目录..."
tar -czf dist.tar.gz dist/

# 3. 上传到服务器
echo "📤 上传到服务器..."
scp dist.tar.gz ${USER}@${SERVER}:/tmp/

# 4. 在服务器上解压并部署
echo "🔧 在服务器上部署..."
ssh ${USER}@${SERVER} << 'EOF'
cd /tmp
tar -xzf dist.tar.gz
sudo rm -rf /var/www/admin/*
sudo cp -r dist/* /var/www/admin/
sudo chown -R www:www /var/www/admin
rm -rf dist dist.tar.gz
echo "服务器端部署完成"
EOF

# 5. 清理本地临时文件
echo "🧹 清理本地临时文件..."
rm dist.tar.gz

echo "✅ 部署完成！"
echo "🌐 访问地址: https://admin.hodaruner.cn"
echo ""
echo "📝 提示："
echo "  - 如果遇到权限问题，请确保SSH密钥已配置"
echo "  - 或者手动输入密码完成部署"
