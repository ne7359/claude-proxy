# --- 阶段 1: 构建阶段 ---
# 此阶段负责安装所有依赖（包括 devDependencies）并构建项目
FROM node:20-alpine AS builder

WORKDIR /app

# 1. 复制所有 package 文件，利用 Docker 缓存
COPY package*.json ./

# 2. 安装所有依赖，包括构建项目所需的 devDependencies
RUN npm ci

# 3. 复制源代码
COPY src/ ./src/

# 4. 执行构建命令（例如编译 TypeScript、打包等）
# 如果您的项目不需要构建步骤，可以注释掉下面这行
RUN npm ci --only=production

# --- 阶段 2: 生产阶段 ---
# 此阶段只负责运行已经构建好的应用
FROM node:20-alpine AS production

WORKDIR /app

# 1. 设置环境变量
ENV NODE_ENV=production

# 2. 复制 package 文件
COPY package*.json ./

# 3. 仅安装生产环境依赖，跳过 devDependencies
RUN npm ci --omit=dev

# 4. 从 builder 阶段复制构建产物
# 如果您的项目无需构建，请将此行改为: COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

# 5. 创建日志目录
RUN mkdir -p /app/logs

# 6. 复制环境变量示例文件
COPY .env.example .env

EXPOSE 8788

CMD ["node", "dist/server.js"]
