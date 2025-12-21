#!/bin/bash

# Web管理后台部署前备份脚本
# 用法: ./backup-before-deploy.sh

set -e

BACKUP_DIR="/var/www/admin_backup_$(date +%Y%m%d_%H%M%S)"

echo "📦 创建备份..."
ssh admin@47.108.135.142 "sudo cp -r /var/www/admin $BACKUP_DIR && echo '✅ 备份已创建: $BACKUP_DIR'"

echo ""
echo "现在可以安全地运行部署脚本："
echo "./deploy.sh"
