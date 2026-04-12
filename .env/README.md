# 环境变量配置管理系统

一个现代化的Vue + Node.js Web应用，用于管理.env配置文件，支持多配置存储和激活功能。

## 功能特点

✅ **多配置管理** - 最多可保存10个不同配置
✅ **激活/未激活分离** - 激活配置存储在.env文件，未激活配置存储在JSON文件
✅ **美观的现代化UI** - 使用Vue 3构建的响应式界面
✅ **配置统计** - 实时显示配置数量和可用槽位
✅ **批量操作** - 激活、编辑、删除配置

## 项目结构

```
项目根目录/
├── .env                     # 激活的配置文件
├── config-storage/          # 配置存储目录
│   └── configs.json        # 所有配置的JSON文件
├── vue-ui/                  # 前端应用
│   ├── public/
│   │   └── index.html      # 前端HTML界面
│   ├── server.js           # Express后端服务
│   └── package.json        # 依赖配置
└── README.md              # 本文档
```


## 快速开始


### 本地开发运行

```bash
cd vue-ui
npm install
npm run dev
```

## API接口

### 获取当前激活配置
```http
GET /api/config
```

### 保存并激活配置
```http
POST /api/config
Content-Type: application/json

{
  "upstreamUrl": "https://example.com",
  "apiKey": "your-api-key",
  "port": 8788,
  "maxSessions": 200,
  "name": "配置名称"
}
```

### 获取所有配置列表
```http
GET /api/configs
```

### 激活特定配置
```http
POST /api/configs/{id}/activate
```

### 删除配置
```http
DELETE /api/configs/{id}
```

## 配置说明

### 环境变量

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `ENV_FILE_PATH` | `/app/.env` | .env文件路径 |
| `CONFIG_STORAGE_DIR` | `/app/config-storage` | 配置存储目录 |
| `NODE_ENV` | `production` | 运行环境 |

### .env文件格式
```env
UPSTREAM_BASE_URL=https://your-upstream.example.com
UPSTREAM_API_KEY=your-upstream-api-key
PORT=8788
MAX_SESSIONS=200
```

## 特性细节

### 配置存储策略
- **激活配置**：保存在根目录的`.env`文件中
- **未激活配置**：保存在`config-storage/configs.json`文件中
- **最大容量**：系统最多保存10个配置，超出时自动删除最早配置

## 开发说明

### 修改前端界面
前端使用Vue 3 CDN版本，所有代码在`vue-ui/public/index.html`中。

### 修改后端逻辑
后端Express服务在`vue-ui/server.js`中，包含所有配置管理逻辑。

### 扩展配置字段
如需添加新的配置字段：
1. 在`server.js`中更新`parseEnvFile`和`generateEnvContent`函数
2. 在前端HTML中添加对应的表单字段
3. 更新API验证逻辑
