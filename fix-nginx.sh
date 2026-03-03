#!/bin/bash

# 修复 admin.hodaruner.cn Nginx 配置脚本
# 添加 /api 反向代理到后端服务

set -e

echo "🔧 开始修复 Nginx 配置..."

SERVER="47.108.135.142"
USER="admin"

# 1. 备份现有配置
echo "📦 备份现有 Nginx 配置..."
ssh ${USER}@${SERVER} << 'EOF'
# 查找配置文件
if [ -f "/www/server/panel/vhost/nginx/admin.hodaruner.cn.conf" ]; then
    CONFIG_FILE="/www/server/panel/vhost/nginx/admin.hodaruner.cn.conf"
elif [ -f "/etc/nginx/sites-enabled/admin.hodaruner.cn" ]; then
    CONFIG_FILE="/etc/nginx/sites-enabled/admin.hodaruner.cn"
elif [ -f "/etc/nginx/conf.d/admin.hodaruner.cn.conf" ]; then
    CONFIG_FILE="/etc/nginx/conf.d/admin.hodaruner.cn.conf"
else
    echo "❌ 未找到 admin.hodaruner.cn 的 Nginx 配置文件"
    exit 1
fi

echo "找到配置文件: $CONFIG_FILE"

# 备份
sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ 已备份到 ${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# 检查是否已有 /api 配置
if sudo grep -q "location /api/" "$CONFIG_FILE"; then
    echo "⚠️  配置文件中已存在 /api 配置，跳过添加"
else
    echo "📝 添加 /api 反向代理配置..."
    
    # 在 location / 之前插入 /api 配置
    sudo sed -i '/location \/ {/i \    # API 反向代理到后端服务\n    location /api/ {\n        proxy_pass http://127.0.0.1:8100/api/;\n        proxy_http_version 1.1;\n        \n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        \n        proxy_connect_timeout 60s;\n        proxy_send_timeout 60s;\n        proxy_read_timeout 60s;\n    }\n' "$CONFIG_FILE"
    
    echo "✅ 已添加 /api 配置"
fi

# 测试 Nginx 配置
echo "🧪 测试 Nginx 配置..."
if sudo nginx -t; then
    echo "✅ Nginx 配置测试通过"
    
    # 重载 Nginx
    echo "🔄 重载 Nginx..."
    sudo nginx -s reload || sudo systemctl reload nginx
    echo "✅ Nginx 已重载"
else
    echo "❌ Nginx 配置测试失败，恢复备份..."
    sudo cp "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)" "$CONFIG_FILE"
    exit 1
fi

# 检查后端服务状态
echo "🔍 检查后端服务状态..."
if sudo systemctl is-active --quiet miniprogram-user-api; then
    echo "✅ 后端服务正在运行"
else
    echo "⚠️  后端服务未运行，尝试启动..."
    sudo systemctl start miniprogram-user-api
fi

# 测试 API 连接
echo "🧪 测试 API 连接..."
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8100/api/v1/system-config | grep -q "200\|401"; then
    echo "✅ 后端 API 响应正常"
else
    echo "⚠️  后端 API 可能未正常响应"
fi

EOF

echo ""
echo "✅ Nginx 配置修复完成！"
echo ""
echo "📝 下一步："
echo "  1. 运行 ./deploy.sh 重新部署前端"
echo "  2. 在浏览器中强制刷新（Ctrl+F5 或 Cmd+Shift+R）"
echo "  3. 检查 Network 中请求是否变为 admin.hodaruner.cn/api/v1/*"
echo ""
