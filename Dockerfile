# 多阶段Docker构建 - 统一Claude代理服务

# 第一阶段：构建阶段 - 收集和准备文件
FROM node:20-alpine AS builder

WORKDIR /app

# 复制所有必要文件
COPY package.json server.js ./
COPY proxy/ ./proxy/
COPY .env/ ./.env/

# 创建必要的目录结构
RUN mkdir -p /app/.env/config-storage && \
    mkdir -p /app/proxy && \
    touch /app/proxy/.env

# 第二阶段：依赖安装阶段
FROM node:20-alpine AS deps

WORKDIR /app

# 复制依赖定义文件
COPY package.json ./package.json

# 安装生产依赖
RUN npm install --production

# 第三阶段：生产阶段 - 最小化镜像
FROM node:20-alpine

WORKDIR /app

# 从各个阶段复制文件
COPY --from=builder /app/proxy /app/proxy
COPY --from=builder /app/.env /app/.env
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/server.js /app/server.js

# 创建必要的目录
RUN mkdir -p /app/.env/config-storage && \
    mkdir -p /app/proxy && \
    touch /app/proxy/.env

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8788
ENV CONFIG_STORAGE_DIR=/app/.env/config-storage

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 暴露端口
EXPOSE 8788

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8788/health || exit 1

# 启动统一的服务
CMD ["node", "server.js"]
