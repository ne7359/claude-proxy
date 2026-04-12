# Claude API代理 + 环境变量管理统一服务

一个集成的解决方案，将Claude API代理服务和环境变量Web管理工具结合在一个统一的应用中。

## 功能特性

✅ **Claude API代理** - 将Anthropic API格式转换为OpenAI兼容格式
✅ **环境变量Web管理** - 通过Web界面管理配置，支持多配置存储
✅ **统一服务** - 单个服务同时处理API代理和配置管理
✅ **Docker支持** - 多阶段构建的Docker镜像
✅ **配置持久化** - 配置数据持久化存储
✅ **健康检查** - 自动健康监控
✅ **调试界面** - 内置调试页面监控API调用

## 项目结构

```
.
├── server.js              # 统一服务入口
├── package.json           # 依赖配置
├── Dockerfile            # 多阶段Docker构建
├── docker-compose.yml    # Docker Compose配置
├── proxy/                # Claude代理核心代码
│   ├── src/
│   │   ├── app.js       # 代理应用逻辑
│   │   ├── env.js       # 环境变量加载
│   │   └── debug-page.js # 调试页面
├── .env/                 # 环境变量管理UI
│   ├── vue-ui/
│   │   └── public/      # Vue前端界面
│   └── config-storage/  # 配置存储目录
└── data/                 # 数据持久化目录（由Docker创建）
```

## 快速开始

### 使用Docker Compose（推荐）

1. 创建`.env`文件设置API密钥：
```bash
echo "ANTHROPIC_API_KEY=your-actual-api-key" > .env
```

2. 启动服务：
```bash
docker-compose up -d
```

3. 访问服务：
   - API代理: `http://localhost:8788/v1/messages`
   - 配置管理UI: `http://localhost:8788/ui`
   - 调试页面: `http://localhost:8788/debug`

### 手动构建Docker镜像

```bash
# 构建镜像
docker build -t claude-proxy-unified .

# 运行容器
docker run -d \
  -p 8788:8788 \
  -e ANTHROPIC_API_KEY=your-api-key \
  -v $(pwd)/data/.env:/app/.env/.env \
  -v $(pwd)/data/config-storage:/app/.env/config-storage \
  --name claude-proxy \
  claude-proxy-unified
```

### 本地开发运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 或开发模式
npm run dev
```

## API使用

### Claude API代理端点

```http
POST http://localhost:8788/v1/messages
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 1000,
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

### 配置管理API

- `GET /api/config` - 获取当前激活配置
- `POST /api/config` - 保存并激活新配置
- `GET /api/configs` - 获取所有配置列表
- `POST /api/configs/{id}/activate` - 激活特定配置
- `DELETE /api/configs/{id}` - 删除配置

## 配置说明

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `PORT` | `8788` | 服务监听端口 |
| `UPSTREAM_BASE_URL` | `https://api.anthropic.com` | Claude API上游地址 |
| `UPSTREAM_API_KEY` | - | Claude API密钥（必需） |
| `MAX_SESSIONS` | `200` | 最大会话记录数 |
| `ENV_FILE_PATH` | `/app/.env/.env` | .env文件路径 |
| `CONFIG_STORAGE_DIR` | `/app/.env/config-storage` | 配置存储目录 |

### .env文件格式

```env
UPSTREAM_BASE_URL=https://api.anthropic.com
UPSTREAM_API_KEY=your-api-key-here
PORT=8788
MAX_SESSIONS=200
```

## 配置管理特性

- **多配置存储** - 最多保存10个不同配置
- **激活/未激活分离** - 激活配置存储在.env文件，未激活配置存储在JSON文件
- **批量操作** - 支持激活、编辑、删除配置
- **实时同步** - 配置更新后立即生效，无需重启服务

## Docker镜像优化

- **多阶段构建** - 减少镜像体积
- **最小化基础镜像** - 使用node:20-alpine
- **非root用户运行** - 增强安全性
- **健康检查** - 自动监控服务状态
- **数据持久化** - 配置数据存储在卷中

## 构建和部署

### 构建镜像

```bash
# 使用默认配置
docker build -t claude-proxy-unified .

# 带构建参数
docker build \
  --build-arg NODE_ENV=production \
  -t claude-proxy-unified:v1.0.0 .
```

### 推送到容器注册表

```bash
docker tag claude-proxy-unified your-registry/claude-proxy-unified:v1.0.0
docker push your-registry/claude-proxy-unified:v1.0.0
```

## 故障排除

### 常见问题

1. **服务无法启动**
   - 检查API密钥是否正确设置
   - 检查端口8788是否被占用
   - 查看Docker日志：`docker logs claude-proxy-unified`

2. **配置不生效**
   - 确保.env文件可写入
   - 检查配置存储目录权限
   - 重启服务使配置生效

3. **健康检查失败**
   - 等待启动完成（首次启动可能需要10秒）
   - 检查服务是否正常运行
   - 验证网络连接

### 日志查看

```bash
# Docker Compose日志
docker-compose logs -f

# 单个容器日志
docker logs -f claude-proxy-unified
```

## 开发

### 修改代理逻辑

编辑 `proxy/src/app.js` 文件。

### 修改配置管理逻辑

编辑 `server.js` 中的配置管理函数。

### 修改UI界面

编辑 `.env/vue-ui/public/index.html` 文件。

### 添加新配置字段

1. 在 `server.js` 中更新 `parseEnvFileContent` 和 `generateEnvFileContent` 函数
2. 在UI中添加对应的表单字段
3. 更新API验证逻辑

## 许可证

MIT License