# claude-proxy

```

  ┌─────────────┬─────────────────────┬──────────────────────┐
  │   配置项    │        文件         │         状态         │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ 局域网访问  │ src/server.js       │ 已修改为监听 0.0.0.0 │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ PM2 配置    │ ecosystem.config.js │ 已创建               │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ Docker 部署 │ Dockerfile          │ 已创建               │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ Docker 编排 │ docker-compose.yml  │ 已创建               │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ 镜像忽略    │ .dockerignore       │ 已创建               │
  ├─────────────┼─────────────────────┼──────────────────────┤
  │ 日志目录    │ logs/               │ 已创建               │
  └─────────────┴─────────────────────┴──────────────────────┘
  ```

# claude-raw-proxy

Minimal local proxy for Claude Code with a raw in-memory inspector.

It accepts Claude Code's `Anthropic /v1/messages` requests, forwards them to an upstream chat-completions endpoint, and exposes a local debug page so you can inspect the exact forwarded request and the exact upstream response for each session.

## Features

- Local `POST /v1/messages` endpoint for Claude Code
- Streaming support
- Raw inspector at `GET /debug`
- In-memory session storage only
- Zero runtime dependencies

## Requirements

- Node.js 20+ recommended

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your upstream settings
3. Start the proxy

```powershell
cd C:\Users\014600003120\claude-raw-proxy
copy .env.example .env
npm start
```

## Environment Variables

Create a `.env` file in the project root:

```env
UPSTREAM_BASE_URL=https://your-upstream.example.com
UPSTREAM_API_KEY=your-upstream-api-key
PORT=8788
MAX_SESSIONS=200
```

Required:

- `UPSTREAM_BASE_URL`
- `UPSTREAM_API_KEY`

Optional:

- `PORT`
- `MAX_SESSIONS`

## Claude Code Configuration

Point Claude Code at the local proxy by editing your Claude settings file:

`C:\Users\014600003120\.claude\settings.json`

Example:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8788",
    "ANTHROPIC_AUTH_TOKEN": "anything"
  },
  "includeCoAuthoredBy": false
}
```

Then restart Claude Code.

## Debug Inspector

Open:

```text
http://127.0.0.1:8788/debug
```

For each session, the page shows only two raw artifacts:

- the forwarded upstream request
- the upstream response received by the proxy

JSON session data is also available at:

```text
http://127.0.0.1:8788/debug/api/sessions
```

## Scripts

```powershell
npm start
npm test
```

## Notes

- Session data is kept in memory only and is cleared on restart.
- `.env` is ignored by git.
- This project does protocol adaptation between Claude Code's message API and an upstream chat-completions API. It is not a byte-for-byte transparent TCP relay.


++++++++++++++++++++++++++++++++++++++++++++++++

您好！在 Windows 上有几种让服务在后台运行的方式：

  方法 1：使用 PM2（推荐）
  npm install -g pm2
  pm2 start server.js --name claude-raw-proxy
  优点：可自动重启、日志管理、方便查看状态

  方法 2：使用 node-forever
  npm install -g forever
  forever start src/server.js

  方法 3：Windows 服务（最稳定）
  使用 node-windows 或 nssm 将其注册为系统服务，开机自启

  方法 4：PowerShell 后台运行（临时）
  Start-Process node -ArgumentList "src/server.js" -WindowStyle Hidden

  ---
  推荐使用 PM2，管理最方便。需要我帮您配置吗？

✻ Churned for 5m 8s

❯ 需要您给我写一份PM2配置，谢谢

● 好的，我来为您创建一个 PM2 配置文件。

● Write(ecosystem.config.js)
  ⎿  Wrote 25 lines to ecosystem.config.js
       1 module.exports = {
       2   apps: [
       3     {
       4       name: 'claude-raw-proxy',
       5       script: './src/server.js',
       6       instances: 1,
       7       autorestart: true,
       8       watch: false,
       9       max_memory_restart: '1G',
      10       env: {
     … +15 lines (ctrl+o to expand)

● Bash(mkdir -p "C:\Users\Administrator\Desktop\claude-raw-proxy-main\logs")
  ⎿  Done

● 配置文件已创建完成！

  使用步骤：

  1. 安装 PM2（如果还没安装）：
  npm install -g pm2
  2. 启动服务：
  pm2 start ecosystem.config.js
  3. 查看状态：
  pm2 status
  pm2 logs claude-raw-proxy
  4. 重启/停止/删除：
  pm2 restart claude-raw-proxy
  pm2 stop claude-raw-proxy
  pm2 delete claude-raw-proxy
  5. 开机自启（可选）：
  pm2 startup
  pm2 save

  配置说明：
  - 单实例运行（instances: 1）
  - 崩溃自动重启（autorestart: true）
  - 内存超过 1GB 自动重启
  - 日志输出到 logs/ 目录
  - 10 秒内最多重启 10 次（防止重启循环）


  1. 能否 Docker 化？

  可以，这个项目完全可以 Docker 化。

  2. 流量路径问题

  您的理解是对的，会有两种情况：

  【方案 A：本地运行】
  本地 → Claude API（直接）

  【方案 B：服务器中转】
  本地 → 服务器 Docker → Claude API
         ↑ 多一跳，增加网络延迟

  流量走向：
  - 您的请求：本地 → 服务器（走网络）
  - 服务器转发：服务器 → Claude API（走网络）
  - 响应返回：Claude API → 服务器 → 本地（原路返回）

  影响：
  - ✅ 数据确实会多经过一次服务器
  - ✅ 会增加一点延迟（通常几十到几百毫秒）
  - ✅ 如果您的本地 IP 和服务器 IP 都被封，那就无法使用了
  - ✅ 如果只有本地 IP 被封，服务器 IP 正常，那这个方案就有效

  ---
  3. 如果您需要，我可以创建 Docker 配置

  如果您确定需要 Docker 部署（比如服务器在海外、需要固定 IP 等场景），我可以帮您创建：
  - Dockerfile
  - docker-compose.yml
  - .dockerignore


  文件说明
```
  ┌────────────────────┬────────────────────────────┐
  │        文件         │            作用            │
  ├────────────────────┼────────────────────────────┤
  │ Dockerfile         │ 定义镜像构建规则            │
  ├────────────────────┼────────────────────────────┤
  │ docker-compose.yml │ 容器编排配置（推荐用这个） │
  ├────────────────────┼────────────────────────────┤
  │ .dockerignore      │ 排除不需要的文件           │
  └────────────────────┴────────────────────────────┘
```
  ---
  部署到服务器的步骤

  1. 上传到服务器

  # 方式 1：使用 git clone
  git clone <your-repo> /path/to/claude-raw-proxy

  # 方式 2：使用 scp 上传
  scp -r ./* root@server:/path/to/claude-raw-proxy

  2. 配置环境变量

  cd /path/to/claude-raw-proxy
  cp .env.example .env
  # 编辑 .env 填入你的配置

  3. 启动服务

  # 使用 docker-compose（推荐）
  docker-compose up -d

  # 查看日志
  docker-compose logs -f claude-raw-proxy

  # 停止
  docker-compose down

  ---
  关于网络流量的说明

  【当前架构】
  本地浏览器 → 服务器 Docker(8788) → Claude API
                  ↑                    ↑
              这程段走网络          这段也走网络

  结论：
  - 如果您的 .env 中 ANTHROPIC_BASE_URL 填的是服务器地址，那么流量路径是：本地 → 服务器 → Claude API
  - 请求会经过服务器中转，增加一次网络往返
  - 但如果您的本地 IP 被限制，而服务器 IP 正常，这个方案就有效
