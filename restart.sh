#!/bin/bash

# 重启Claude Proxy服务

echo "🔄 重启Claude API代理服务..."

echo "🛑 停止服务..."
docker-compose down

echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "✅ 服务已重启！"
echo ""
echo "查看日志: docker-compose logs -f"
echo ""