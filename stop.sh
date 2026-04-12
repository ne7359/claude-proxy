#!/bin/bash

# 停止Claude Proxy服务

echo "🛑 停止Claude API代理服务..."
docker-compose down

echo ""
echo "✅ 服务已停止！"
echo ""