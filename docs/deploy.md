# 生产部署 Runbook

## 拓扑

两个前端是纯静态产物，放在 Vercel；Go API 与 Postgres 在自己的 VPS 上。**浏览器只跟 `app.<domain>` 说话** —— Vercel 把 `/api` 代理回 VPS，所以认证仍然是同源：cookie 是 host-only、`SameSite` 保持默认、API 不需要 CORS。

```
            ┌──────────────── Vercel ────────────────┐
浏览器 ───→ │ <domain>       落地页（apps/landing）    │
            │ app.<domain>   app（apps/web）          │
            │   └ /api/*  ── rewrite ──┐              │
            └──────────────────────────┼──────────────┘
                                       ↓ HTTPS
                         ┌──────── VPS（podman compose）──┐
                         │ api.<domain>  Caddy（自动证书） │
                         │   └ reverse_proxy → api:8080   │
                         │ api 容器 ── compose 网络 ── db   │
                         └────────────────────────────────┘
```

为什么用 rewrite 而不是 CORS：`apps/api` 里没有任何 CORS 中间件，让浏览器直连 `api.<domain>` 需要新增 CORS、把刷新 cookie 改成跨站可发、给 OAuth 回调找落点。rewrite 把这些全部省掉，代价只是每次 API 调用多经过一次 Vercel 的边缘。Vercel 上的 `/api` 响应带 `Cache-Control: no-store`（`apps/web/vercel.json`），token 响应不会被边缘缓存。

## 1. DNS

| 记录 | 指向 | 用途 |
| --- | --- | --- |
| `A <domain>` | Vercel | 落地页 |
| `CNAME app` | Vercel | app |
| `A api` | VPS 的 IP | API（只需 80/443） |

Vercel 项目面板里绑定域名，按它给的记录填；改完等证书签发。

## 2. Vercel：两个项目

同一个仓库建两个项目，**Root Directory 分别是 `apps/landing` 和 `apps/web`**。Vercel 认 pnpm workspace，会在仓库根目录安装依赖，`packages/shared` 里的设计令牌与偏好包随之可用。

| 项目 | Root Directory | Build Command | Output | 环境变量 |
| --- | --- | --- | --- | --- |
| 落地页 | `apps/landing` | `pnpm --filter @oh-your-ear/landing build` | `apps/landing/dist` | `VITE_APP_URL=https://app.<domain>` |
| app | `apps/web` | `pnpm --filter @oh-your-ear/web build` | `apps/web/dist` | — |

**落地页的 `VITE_APP_URL` 必须配**：它决定「开始练习」跳到哪个 app 域名；不配会退回 `http://localhost:5173`。

**app 项目要改 `apps/web/vercel.json` 里的 API 地址**（仓库里的值只是占位）：

```bash
sed -i 's#https://api.example.com#https://api.<domain>#' apps/web/vercel.json
```

这个文件同时做三件事：把 `/api/*` 代理到 VPS、把其他路径兜回 `index.html`（SPA 深链接刷新需要，例如直接打开 `/exercise/single-note`）、给 `/api/*` 加 `no-store`。

> 落地页不需要 `vercel.json`：它只有一页，没有路由。

## 3. Google OAuth（若启用）

在 Google Cloud Console 的 OAuth 客户端里：

- **已获授权的域名**：`<domain>`
- **已获授权的重定向 URI**：`https://app.<domain>/api/v1/auth/google/callback`

回调**必须走 app 域名**（经 Vercel 代理到 API），不能填 `api.<domain>`：OAuth 的 state cookie 与登录后的刷新 cookie 都要落在 `app.<domain>` 这个 origin 上，填 API 域名会让两者分家，表现为「回调进来但登录不上」。

## 4. VPS：`.env`

写在仓库根目录（**不要提交**，已在 `.gitignore`）：

> ⚠️ 所有 `podman compose` 命令都要带 `--env-file .env`。compose 默认只在 **compose 文件所在目录**（这里是 `compose/`）找 `.env`，不带这个参数的话仓库根目录的 `.env` 会被无视，然后报「POSTGRES_PASSWORD must be set」——变量明明写了却说过没写。

```bash
POSTGRES_PASSWORD=<openssl rand -base64 24>
JWT_SECRET=<openssl rand -base64 48>
FRONTEND_URL=https://app.<domain>
APP_TIMEZONE=Asia/Shanghai

# 启用 Google 登录时填（回调是 app 域名，见上一节）：
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=https://app.<domain>/api/v1/auth/google/callback

# Caddy 自动签证书需要（DOMAIN 是 API 主机名）：
DOMAIN=api.<domain>
ACME_EMAIL=you@example.com

# 邮件验证码投递：MAIL_DRIVER=log 只在开发用，验证码会打在容器日志里
MAIL_DRIVER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=no-reply@<domain>

# 反代所在的网段，默认覆盖 compose 私网。限流按客户端 IP 计数，
# 所以这个必须配，否则所有请求都会算成反代容器的 IP（等于变成全局限流）
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

`MAIL_DRIVER=smtp` 走 STARTTLS（587 常见），不引第三方 SDK：`net/smtp` 直接对话。发信失败只写日志、接口照旧返回 204 —— 否则响应差异会泄漏"这个邮箱存不存在"。

`JWT_SECRET`、`POSTGRES_PASSWORD`、`FRONTEND_URL` **没有默认值，没设就直接拒绝启动**。这是故意的：一个已知的兜底密钥等于任何人都能签发 token。

## 5. 上线

```bash
dnf install -y podman podman-compose   # 或 apt install podman podman-compose
git clone <repo> /srv/oh-your-ear && cd /srv/oh-your-ear
```

```bash
podman compose --env-file .env -f compose/compose.yml -f compose/compose.tls.yml up -d --build
curl -fsS http://127.0.0.1:8080/api/v1/health   # {"status":"ok"}
```

不带 TLS overlay 也可以（`-f compose/compose.yml`），但那样 Vercel 的 rewrite 没有证书可用，必须由你自己的反代或隧道补上。

数据库结构在 api 启动时自动建表（`db.Migrate`），首次启动无需手工初始化。

## 6. 端口与网络

| 服务 | 对外 | 说明 |
| --- | --- | --- |
| `api` | `127.0.0.1:8080` | 只绑回环，公网入口只有 Caddy；这个发布只是为了本机健康检查与升级验证 |
| `db` | 不发布端口 | 只在 compose 网络内可达 |
| `caddy` | `80` / `443` | 只签 `api.<domain>` |

前端不在这个 compose 里：它们是 Vercel 上的静态产物。

## 7. 备份

```bash
./compose/backup.sh                  # 写入 ./backups/ohyourear-<timestamp>.sql，保留最近 14 份
KEEP=30 ./compose/backup.sh
```

定时任务：

```cron
0 4 * * * cd /srv/oh-your-ear && ./compose/backup.sh >> /var/log/oye-backup.log 2>&1
```

恢复（会覆盖同名对象，先确认目标库是空的或可覆盖）：

```bash
podman exec -i oh-your-ear-db-1 psql -U postgres -d ohyourear < backups/ohyourear-2026-09-18-040000.sql
```

备份文件里包含用户邮箱与练习记录，别放进公开的同步目录。

## 8. 升级

```bash
git pull
./compose/backup.sh                                                   # 结构变更前先备一份
podman compose --env-file .env -f compose/compose.yml -f compose/compose.tls.yml up -d --build
```

前端跟着 Vercel 的部署走：`git push` 到主分支后两个项目各自重建，与 VPS 的升级互不影响。

## 9. 日常排查

```bash
podman compose --env-file .env -f compose/compose.yml ps
podman logs --tail 100 oh-your-ear-api-1
podman logs --tail 100 oh-your-ear-caddy-1
curl -fsS http://127.0.0.1:8080/api/v1/health
```

前端出问题先看 Vercel 项目的 build / runtime 日志；接口 502 通常是 VPS 上 `api` 容器没起来（`podman ps`）。

## 10. 认证面的防线

| 机制 | 位置 | 说明 |
| --- | --- | --- |
| 验证码冷却 | `POST /auth/code` | 同一邮箱 60s 内只能发一次（SQL 层原子实现） |
| 验证码锁定 | `POST /auth/login` | 同一验证码错 5 次即作废 |
| IP 限流 | `POST /auth/code` / `POST /auth/login` | 每 IP 每小时 10 次发码、每 15 分钟 30 次登录；进程内计数，单实例有效 |
| token 吊销 | `POST /auth/logout` | refresh token 的 `jti` 写入 `revoked_tokens`，`/auth/refresh` 会拒绝；access token 短命(15m)不吊销 |
| 可信代理 | `TRUSTED_PROXIES` | 决定 `X-Forwarded-For` 是否可信，限流依赖它 |

限流是**进程内**的：多实例部署时每个实例各算各的，届时应换 redis（技术方案里也这么写）。

### Vercel 拓扑下限流会退化（已知，不是 bug）

请求链是：浏览器 → Vercel 边缘 → Caddy → api。`X-Forwarded-For` 的最后一跳是 **Vercel 的边缘 IP**，而它是动态的、不在 `TRUSTED_PROXIES`（默认只含私网段）里，所以 `ClientIP()` 取到的是边缘 IP 而不是真实访客 IP。

结果：**按 IP 的限流变成按边缘节点计数**（一个节点上的所有访客共享配额），而不是按访客。真正兜住滥用的是另外两层按账号/邮箱的规则（发码 60s 冷却、同码错 5 次作废），它们不受影响。

要恢复精确限流，二选一：

- 把 Vercel 的出口 IP 段加进 `TRUSTED_PROXIES`（Vercel 提供可查询的 IP 列表，但会变动，需要定期同步）；
- 或把限流键从 IP 换成邮箱/用户（更贴近真实滥用面，改动在 `middleware/ratelimit.go`）。

现在不动：单实例、有冷却与锁定在，收益小于复杂度。

`api` 容器经 Vercel 的 rewrite 对内网暴露给 Vercel 的边缘网络。绕过 Vercel 直接打 `api.<domain>` 在能力上与从前端打没有区别（同一个 API、同一套鉴权、没有 CORS 所以浏览器无法跨站读取响应），区别只是少了一层边缘。要收紧的话，可以给 API 加一个只由 rewrite 注入的共享密钥头。
