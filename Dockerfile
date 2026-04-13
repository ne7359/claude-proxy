# 多阶段Docker构建 - 统一Claude代理服务
# 特点：完整打包 .env 目录(含Web UI)，并保留写入权限

# ==========================================
# 第一阶段：构建与资源收集
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. 安装依赖
COPY package*.json ./
RUN npm install --omit=dev

# 2. 复制核心代码
COPY server.js ./
COPY proxy/ ./proxy/

# 3. 【关键】复制 .env 目录
# 这会包含你的 Vue UI 和 config-storage 结构
# 注意：Docker 会保留目录结构，但可能会重置权限
COPY .env/ ./app-env/

# ==========================================
# 第二阶段：生产运行环境
# ==========================================
FROM node:20-alpine

WORKDIR /app

# 1. 复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 2. 复制代码
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/proxy ./proxy

# 3. 【关键】从 builder 复制 .env 目录
# 必须使用 --from=builder，否则如果本地 .env 在 .dockerignore 里会复制失败
COPY --from=builder /app/app-env /app/.env

# 4. 权限修复与目录初始化
# 因为是从 builder 复制过来的，所有者可能是 root
# 我们需要确保 nodejs 用户有权限读写 config-storage
RUN chown -R nodejs:nodejs /app && \
    # 确保配置存储目录存在且可写
    mkdir -p /app/.env/config-storage && \
    chmod -R 755 /app/.env

# 5. 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
