#!/bin/bash
# 自动部署 web-admin 前端
# ⚠️ 注意：请确保您已配置好 SSH 免密登录，或在提示时输入密码

SERVER_USER="admin"
SERVER_IP="47.108.135.142"
# 默认猜测的路径，如果部署失败，请修改此处
REMOTE_DIR="/var/www/admin"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 开始部署 web-admin...${NC}"

# 1. 进入项目目录
cd "$(dirname "$0")"

# 2. 构建
echo -e "${GREEN}📦 执行本地构建 (npm run build)...${NC}"
# 如果没有 node_modules，先安装
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

npm run build

if [ $? -ne 0 ] || [ ! -d "dist" ]; then
    echo -e "${RED}❌ 构建失败，请检查错误日志${NC}"
    exit 1
fi

# 3. 打包
echo -e "${GREEN}🗜️  打包构建产物...${NC}"
tar -czf web-dist.tar.gz -C dist .

# 4. 上传
echo -e "${GREEN}u001b 上传到服务器 ${SERVER_IP}...${NC}"
scp web-dist.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 上传失败${NC}"
    rm web-dist.tar.gz
    exit 1
fi

# 5. 远程部署
echo -e "${GREEN}🔄 在服务器执行替换...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} << EOF
    # 自动探测目录逻辑
    TARGET_DIR="${REMOTE_DIR}"
    if [ ! -d "\$TARGET_DIR" ]; then
        echo "⚠️  默认目录不存在，尝试搜索 /www/wwwroot 下的 admin 目录..."
        FOUND=\$(find /www/wwwroot -maxdepth 1 -type d -name "*admin*" | head -n 1)
        if [ -n "\$FOUND" ]; then
            TARGET_DIR="\$FOUND"
            echo "✅ 自动定位到: \$TARGET_DIR"
        else
            echo "❌ 无法找到部署目录，请手动修改脚本 REMOTE_DIR 变量"
            exit 1
        fi
    fi

    echo "📂 部署目标: \$TARGET_DIR"
    
    # 备份
    if [ ! -d "\$TARGET_DIR/backup" ]; then
        sudo mkdir -p \$TARGET_DIR/backup
    fi
    echo "Creating backup..."
    sudo tar -czf \$TARGET_DIR/backup/pre_deploy_\$(date +%Y%m%d_%H%M%S).tar.gz -C \$TARGET_DIR . --exclude=backup
    
    # 解压覆盖
    echo "Extracting files..."
    sudo tar -xzf /tmp/web-dist.tar.gz -C \$TARGET_DIR
    
    # 权限修正 (尝试 www 或 nginx 用户)
    if id "www" &>/dev/null; then
        sudo chown -R www:www \$TARGET_DIR
    elif id "www-data" &>/dev/null; then
        sudo chown -R www-data:www-data \$TARGET_DIR
    fi
    
    # 清理
    rm /tmp/web-dist.tar.gz
    echo "🎉 服务器操作完成"
EOF

# 6. 清理本地
rm web-dist.tar.gz
echo -e "${GREEN}✅ 部署脚本执行完毕！请刷新浏览器查看效果。${NC}"
