FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY .env.example .env

# 创建日志目录
RUN mkdir -p /app/logs

EXPOSE 8788

CMD ["node", "src/server.js"]
