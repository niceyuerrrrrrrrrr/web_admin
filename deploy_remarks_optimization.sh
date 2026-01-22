#!/bin/bash

# 管理后台备注列优化部署脚本
# 创建时间: 2026-01-13

set -e

echo "🚀 开始部署管理后台备注列优化..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_USER="admin"
SERVER_HOST="47.108.135.142"
SERVER_PATH="/opt/web-admin"
BACKUP_DIR="/opt/web-admin/backups"

# 检查dist目录是否存在
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ dist目录不存在，请先运行 npm run build${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到构建产物${NC}"

# 创建备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dist-backup-remarks-${TIMESTAMP}.tar.gz"
DEPLOY_NAME="dist-remarks-optimization.tar.gz"

# 打包dist目录
echo "📦 打包构建产物..."
tar -czf "${DEPLOY_NAME}" dist/
echo -e "${GREEN}✅ 打包完成: ${DEPLOY_NAME}${NC}"

# 上传到服务器
echo "📤 上传到服务器..."
scp "${DEPLOY_NAME}" "${SERVER_USER}@${SERVER_HOST}:/tmp/"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 上传成功${NC}"
else
    echo -e "${RED}❌ 上传失败${NC}"
    exit 1
fi

# 在服务器上执行部署
echo "🔧 在服务器上执行部署..."
ssh "${SERVER_USER}@${SERVER_HOST}" << 'ENDSSH'
set -e

echo "📋 开始服务器端部署..."

# 创建备份目录
sudo mkdir -p /opt/web-admin/backups

# 备份当前版本
if [ -d "/opt/web-admin/dist" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    echo "💾 备份当前版本..."
    sudo tar -czf "/opt/web-admin/backups/dist-backup-${TIMESTAMP}.tar.gz" -C /opt/web-admin dist/
    echo "✅ 备份完成: dist-backup-${TIMESTAMP}.tar.gz"
fi

# 解压新版本
echo "📦 解压新版本..."
cd /opt/web-admin
sudo rm -rf dist
sudo tar -xzf /tmp/dist-remarks-optimization.tar.gz
echo "✅ 解压完成"

# 设置权限
echo "🔐 设置文件权限..."
sudo chown -R www-data:www-data dist/
sudo chmod -R 755 dist/
echo "✅ 权限设置完成"

# 清理临时文件
sudo rm -f /tmp/dist-remarks-optimization.tar.gz
echo "🧹 清理临时文件完成"

# 重启nginx
echo "🔄 重启nginx..."
sudo systemctl reload nginx
if [ $? -eq 0 ]; then
    echo "✅ nginx重启成功"
else
    echo "⚠️  nginx重启失败，尝试restart..."
    sudo systemctl restart nginx
fi

echo "✅ 服务器端部署完成"
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo ""
    echo "📊 部署信息："
    echo "  - 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  - 服务器: ${SERVER_HOST}"
    echo "  - 部署路径: ${SERVER_PATH}"
    echo ""
    echo "🌐 访问地址："
    echo "  - http://${SERVER_HOST}"
    echo ""
    echo "📝 测试清单："
    echo "  1. 检查装料单列表中的备注列"
    echo "  2. 检查卸货单列表中的备注列"
    echo "  3. 检查充电单列表中的备注列"
    echo "  4. 检查水票列表中的备注列"
    echo "  5. 检查出厂单列表中的备注列"
    echo "  6. 检查装卸匹配列表中的装料备注和卸货备注"
    echo "  7. 测试备注列的筛选功能（有备注/无备注）"
    echo "  8. 测试列配置功能（调整备注列位置）"
    echo "  9. 查看详情页中的备注显示"
    echo ""
    echo "🔄 如需回滚，请运行："
    echo "  ssh ${SERVER_USER}@${SERVER_HOST}"
    echo "  cd ${SERVER_PATH}"
    echo "  sudo rm -rf dist"
    echo "  sudo tar -xzf backups/dist-backup-YYYYMMDD_HHMMSS.tar.gz"
    echo "  sudo systemctl reload nginx"
else
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

# 清理本地临时文件
rm -f "${DEPLOY_NAME}"
echo "🧹 清理本地临时文件完成"

echo ""
echo -e "${GREEN}🎉 所有操作完成！${NC}"






