# 多阶段Docker构建 - 统一Claude代理服务
# 特点：完整打包 .env 目录(含Web UI)，并保留写入权限

# ==========================================
# 第一阶段：构建与资源收集
# ==========================================
FROM node:20-alpine AS builder

# 安装 git（Alpine需要显式安装）
RUN apk add --no-cache git

# 设置工作目录
WORKDIR /app

# 安装依赖
RUN npm install --omit=dev

# ==========================================
# 第二阶段：生产运行环境
# ==========================================
FROM node:20-alpine

WORKDIR /app

# 1. 【关键】先创建用户组和用户（必须在 chown 之前！）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 2. 从 builder 复制所有必要文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/proxy ./proxy
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/package.json ./package.json

# 3. 权限修复与目录初始化
RUN chown -R nodejs:nodejs /app && \
    mkdir -p /app/.env/config-storage && \
    chmod -R 755 /app/.env

USER nodejs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8788
ENV CONFIG_STORAGE_DIR=/app/.env/config-storage

EXPOSE 8788

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8788/health || exit 1

CMD ["node", "server.js"]
