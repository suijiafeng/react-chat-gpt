# 本地运行与部署

README 里的 `npm ci` 与 `npm run dev` 只起前端。这里是对接后端、环境变量和容器时用到的命令。样例值以仓库里的 `.env.example` 和 `server/.env.example` 为准。

## 前后端一起跑

先用 `node -v` 确认当前终端使用 Node.js 22。服务端的 SQLite 依赖包含原生绑定。切换 Node 版本或在不同平台安装后，请在当前环境重新执行 `npm ci --prefix server`。如果安装日志提示下载不到预编译绑定，请安装 Python 3 和本机 C/C++ 编译工具后重新安装。macOS 可以通过 `xcode-select --install` 安装命令行工具。

```bash
npm ci
npm ci --prefix server
cp .env.example .env.local
cp server/.env.example server/.env
```

`.env.local` 里改为：

```bash
VITE_USE_LOCAL_DATA=false
VITE_WEBUI_BASE_URL=http://localhost:3000
```

`server/.env` 里换掉 `SESSION_SECRET` 和 `ENCRYPTION_KEY`（`openssl rand -hex 32`）。只有需要让服务端访问本机 Ollama 或兼容假上游时，才把 `ALLOW_LOCAL_UPSTREAM` 设成严格的 `true`。

```bash
npm run dev:all
```

前端 `http://localhost:5173`，后端 `http://localhost:3000`。健康检查是 `GET /api/v1/health`。注册账号后，在设置里选「服务器托管」。

## 校验

与 `.github/workflows/ci.yml` 相同的顺序：

```bash
npm ci
npm ci --prefix server
npm run lint
npm test
npm run test:server
npm run build
```

仓库没有单独的 typecheck 脚本。

## 容器

纯前端：

```bash
npm run build
docker build -t react-chat-gpt .
docker run -d -p 8080:80 react-chat-gpt
```

前后端：

```bash
cp .env.docker.example .env
docker compose up -d --build
```

浏览器访问 `http://localhost:8080`。compose 里 `TRUST_PROXY` 默认是 `1`，`ALLOW_LOCAL_UPSTREAM` 默认是 `false`。

## 当前限制

这些都来自现有代码。

- 聊天记录只在浏览器里。换浏览器或换机器登录同一个账号，看不到原来的会话。
- 登录限流、对话限流在进程内存里。多实例不会共享计数。
- 上游地址默认拒绝本机和内网。公网部署应保持 `ALLOW_LOCAL_UPSTREAM` 不是 `true`。
