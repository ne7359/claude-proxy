#!/bin/bash

# 启动Claude Proxy服务

echo "🚀 启动Claude API代理服务..."
docker-compose up -d

echo ""
echo "✅ 服务已启动！"
echo ""
echo "访问地址："
echo "  - 配置管理UI: http://localhost:8788/ui"
echo "  - API代理: http://localhost:8788/v1/messages"
echo "  - 调试页面: http://localhost:8788/debug"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo ""