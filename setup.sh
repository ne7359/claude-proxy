#!/bin/bash

# Claude Proxy统一服务设置脚本

set -e

echo "🎉 Claude API代理 + 环境变量管理统一服务设置脚本"
echo "=================================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker和Docker Compose已安装"

# 创建数据目录
mkdir -p ./data/.env
mkdir -p ./data/config-storage

echo "✅ 数据目录已创建"

# 询问是否设置API密钥
read -p "是否要设置Claude API密钥？(y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入您的Claude API密钥: " API_KEY

    if [[ -n "$API_KEY" ]]; then
        echo "ANTHROPIC_API_KEY=$API_KEY" > .env
        echo "✅ API密钥已保存到 .env 文件"
    else
        echo "⚠️  未输入API密钥，请在启动前手动设置"
        echo "ANTHROPIC_API_KEY=your-api-key-here" > .env.example
        echo "✅ 已创建 .env.example 模板文件"
    fi
else
    echo "ANTHROPIC_API_KEY=your-api-key-here" > .env.example
    echo "✅ 已创建 .env.example 模板文件"
    echo "⚠️  请在使用前编辑 .env 文件设置您的API密钥"
fi

# 构建Docker镜像
echo "🚀 开始构建Docker镜像..."
docker-compose build

echo ""
echo "🎊 设置完成！"
echo ""
echo "下一步操作："
echo "1. 如果需要，编辑 .env 文件设置您的API密钥"
echo "2. 启动服务: docker-compose up -d"
echo "3. 查看日志: docker-compose logs -f"
echo "4. 停止服务: docker-compose down"
echo ""
echo "访问地址："
echo "  - 配置管理UI: http://localhost:8788/ui"
echo "  - API代理: http://localhost:8788/v1/messages"
echo "  - 调试页面: http://localhost:8788/debug"
echo ""
echo "快速命令："
echo "  ./start.sh       # 启动服务"
echo "  ./stop.sh        # 停止服务"
echo "  ./logs.sh        # 查看日志"
echo "  ./restart.sh     # 重启服务"
echo ""