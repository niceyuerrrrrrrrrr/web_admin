#!/bin/bash

# 考勤异常统计功能 - 快速部署脚本
# 使用方法: ./deploy_attendance_stats.sh

set -e

echo "=========================================="
echo "考勤异常统计功能部署"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
FRONTEND_DIR="/Users/niesiyu/Desktop/web-admin"
BACKEND_DIR="/Users/niesiyu/Desktop/pythonProject"
REMOTE_HOST="admin.hodaruner.cn"
REMOTE_USER="root"
REMOTE_FRONTEND_PATH="/www/wwwroot/admin.hodaruner.cn"
REMOTE_BACKEND_PATH="/root/pythonProject"

echo ""
echo "📋 部署配置："
echo "   前端目录: $FRONTEND_DIR"
echo "   后端目录: $BACKEND_DIR"
echo "   远程服务器: $REMOTE_HOST"
echo ""

# 步骤1：构建前端
echo "=========================================="
echo "步骤1：构建前端"
echo "=========================================="
cd "$FRONTEND_DIR"
echo "✅ 进入前端目录"

echo "🔨 开始构建..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端构建成功${NC}"
else
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

# 步骤2：部署前端
echo ""
echo "=========================================="
echo "步骤2：部署前端到服务器"
echo "=========================================="

echo "📦 备份远程前端文件..."
BACKUP_NAME="dist.backup.$(date +%Y%m%d_%H%M%S)"
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_FRONTEND_PATH} && [ -d dist ] && cp -r dist ${BACKUP_NAME} || echo '无需备份'"

echo "📤 上传前端文件..."
scp -r dist/* ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_FRONTEND_PATH}/dist/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端部署成功${NC}"
else
    echo -e "${RED}❌ 前端部署失败${NC}"
    exit 1
fi

# 步骤3：部署后端
echo ""
echo "=========================================="
echo "步骤3：部署后端到服务器"
echo "=========================================="

echo "📦 备份远程后端文件..."
BACKEND_BACKUP="attendance.py.backup.$(date +%Y%m%d_%H%M%S)"
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_BACKEND_PATH}/miniprogram_user_api/api/routers && cp attendance.py ${BACKEND_BACKUP}"

echo "📤 上传后端文件..."
scp ${BACKEND_DIR}/miniprogram_user_api/api/routers/attendance.py ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BACKEND_PATH}/miniprogram_user_api/api/routers/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端文件上传成功${NC}"
else
    echo -e "${RED}❌ 后端文件上传失败${NC}"
    exit 1
fi

# 步骤4：重启后端服务
echo ""
echo "=========================================="
echo "步骤4：重启后端服务"
echo "=========================================="

echo "🔄 重启后端服务..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "supervisorctl restart miniprogram_user_api" 2>/dev/null || \
ssh ${REMOTE_USER}@${REMOTE_HOST} "systemctl restart miniprogram_user_api" 2>/dev/null || \
ssh ${REMOTE_USER}@${REMOTE_HOST} "pkill -f 'uvicorn.*miniprogram_user_api' && cd ${REMOTE_BACKEND_PATH} && nohup python3 -m uvicorn miniprogram_user_api.main:app --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &"

sleep 3

# 步骤5：验证部署
echo ""
echo "=========================================="
echo "步骤5：验证部署"
echo "=========================================="

echo "🔍 检查后端服务状态..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "ps aux | grep 'uvicorn.*miniprogram_user_api' | grep -v grep" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  后端服务状态未知，请手动检查${NC}"
fi

echo "🔍 检查端口监听..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "netstat -tlnp | grep 8000" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 端口8000监听正常${NC}"
else
    echo -e "${YELLOW}⚠️  端口8000监听状态未知${NC}"
fi

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=========================================="
echo ""
echo "📝 后续步骤："
echo "   1. 访问 https://${REMOTE_HOST} 验证前端功能"
echo "   2. 进入'考勤异常监控'页面"
echo "   3. 检查'员工违规统计'卡片是否正常显示"
echo "   4. 测试日期筛选和数据显示功能"
echo ""
echo "📋 备份信息："
echo "   前端备份: ${REMOTE_FRONTEND_PATH}/${BACKUP_NAME}"
echo "   后端备份: ${REMOTE_BACKEND_PATH}/miniprogram_user_api/api/routers/${BACKEND_BACKUP}"
echo ""
echo "🔄 如需回滚，请执行："
echo "   前端: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_FRONTEND_PATH} && rm -rf dist && mv ${BACKUP_NAME} dist'"
echo "   后端: ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_BACKEND_PATH}/miniprogram_user_api/api/routers && cp ${BACKEND_BACKUP} attendance.py && supervisorctl restart miniprogram_user_api'"
echo ""



