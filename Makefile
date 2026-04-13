# Makefile for Claude Proxy Unified Service

.PHONY: help build start stop logs restart clean setup test

help: ## 显示帮助信息
	@echo "Claude API代理统一服务管理命令"
	@echo ""
	@echo "命令列表："
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

setup: ## 设置环境和构建镜像
	@chmod +x setup.sh
	@./setup.sh

build: ## 构建Docker镜像
	docker-compose build

start: ## 启动服务
	@chmod +x start.sh
	@./start.sh

stop: ## 停止服务
	@chmod +x stop.sh
	@./stop.sh

logs: ## 查看服务日志
	@chmod +x logs.sh
	@./logs.sh

restart: ## 重启服务
	@chmod +x restart.sh
	@./restart.sh

clean: ## 清理容器和镜像
	docker-compose down -v
	docker rmi claude-proxy-unified || true

test: ## 测试服务
	@echo "测试API端点..."
	@curl -s http://localhost:8788/api/config | jq . || echo "请先启动服务"

deploy: ## 部署到生产环境
	@echo "构建生产镜像..."
	docker build --no-cache -t claude-proxy-unified:prod .

status: ## 检查服务状态
	@docker-compose ps
	@echo ""
	@echo "访问地址："
	@echo "  UI管理界面: http://localhost:8788/ui"
	@echo "  API代理端点: http://localhost:8788/v1/messages"
	@echo "  调试页面: http://localhost:8788/debug"

default: help