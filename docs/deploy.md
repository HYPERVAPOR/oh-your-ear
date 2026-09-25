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

### 前端不用 Docker

Vercel 用的是它自己的构建镜像（装依赖 → 跑 build → `dist` 作为静态产物上 CDN），**前端项目里不需要也不应该放 Dockerfile/Containerfile**。

Vercel 确实支持容器，但那条路是给 **Functions** 用的：项目根目录放 `Dockerfile.vercel` 或 `Containerfile.vercel`，Vercel 会构建镜像并作为函数运行。对纯静态 SPA 用它只会更差 —— 每个请求都经过计算（Active CPU 计费）而不是走静态 CDN。普通名字的 `Containerfile` 会被 Vercel 直接忽略。

### 两个会咬人的构建前提

- **Node 版本只支持主版本**（24.x / 22.x / 20.x）。仓库根 `package.json` 原本把 `engines.node` 精确到 `24.16.0`，Vercel 上没有这个 patch 版本 → 已改成 `24.x`（pnpm 的精确版本可以保留，corepack 支持）。
- **`.npmrc` 指定了 `registry.npmmirror.com`**（国内镜像）。Vercel 的构建机不在国内，从镜像装依赖会更慢、偶尔会抽风。构建失败时这是第一个怀疑对象，可以用项目环境变量 `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` 覆盖。

## 2. Vercel：两个项目

同一个仓库建两个项目，**Root Directory 分别是 `apps/landing` 和 `apps/web`**。Vercel 认 pnpm workspace，会在仓库根目录安装依赖，`packages/shared` 里的设计令牌与偏好包随之可用。

| 项目 | Root Directory | Build Command | Output Directory | 环境变量 |
| --- | --- | --- | --- | --- |
| 落地页 | `apps/landing` | `pnpm build`（见 `apps/landing/vercel.json`） | `dist` | `VITE_APP_URL=https://app.<domain>` |
| app | `apps/web` | `pnpm build`（见 `apps/web/vercel.json`） | `dist` | — |

构建与安装命令写在各自的 `vercel.json` 里而不是点面板，配置跟代码一起走版本：

```json
{ "installCommand": "pnpm install --frozen-lockfile", "buildCommand": "pnpm build" }
```

`--frozen-lockfile` 和 CI 一致：lockfile 不是最新的就让部署失败，而不是在构建机里偷偷改依赖。Output Directory 是**相对 Root Directory** 的，所以是 `dist` 而不是 `apps/web/dist`。

**落地页的 `VITE_APP_URL` 必须配**：它决定「开始练习」跳到哪个 app 域名；不配会退回 `http://localhost:5173`。

**app 的 `VITE_LANDING_URL` 不用配**：它决定顶栏铭牌跳到哪个落地页，默认就是真实域名，比落地页那边安全。只在想把 app 指向别的落地页（本地联调、预发）时才设，开发环境由 `compose.dev.yml` 设成 `http://localhost:5174`。

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

### 邮件投递（`MAIL_DRIVER=smtp`）

不引第三方 SDK：`net/smtp` 直接对话。两个端口都支持：

| 端口 | 模式 | 说明 |
| --- | --- | --- |
| 587 | STARTTLS | 明文起手、`EHLO` 之后升级，最常见 |
| 465 | 隐式 TLS | 握手即加密。国内厂商常把这个叫「SSL」，只给这一个口的情况很常见 |

本仓库实际在用的中继（hypervapor.org 的 Spacemail）长这样，可以照抄：

```bash
MAIL_DRIVER=smtp
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_USERNAME=me@hypervapor.org   # Spacemail 的用户名是完整地址，不是 @ 前面那截
SMTP_PASSWORD=...
SMTP_FROM=me@hypervapor.org       # 裸地址，且必须是这个域允许发出的地址（SPF）
```

该域名的 SPF（`include:spf.spacemail.com`）与 DKIM（选择子 `spacemail`）由 Spacemail 建邮箱时自动配好；**DMARC 是手动加的**，放在 Spaceship 的 DNS 里：

```
_dmarc   TXT   "v=DMARC1; p=none; rua=mailto:me@hypervapor.org"
```

`p=none` 只收报告、不处置，是标准的第一步：先确认自己所有正常邮件都通过 SPF/DKIM，再收紧成 `quarantine`（可疑进垃圾箱）或 `reject`。`rua=` 那个邮箱每周会收到几封 XML 报告，不看也没事 —— 它是发现域名被冒充的唯一途径。

**465 是隐式 TLS，所以不要去等 STARTTLS。** 465 的连接从第一个字节就是加密的，中继不会在 `EHLO` 里再宣告一个升级 —— 第一版代码把"必须升级"的规则也套在 465 上，于是把只给 465 的中继（比如 Spacemail）判成"不提供 STARTTLS"拒掉。现在的规则是：465 直接按加密会话走；非 465 才看扩展。

**公网中继必须提供 STARTTLS**，不提供就**拒绝发信**：中继不升级、我们又照发，等于让路上的中间人把验证码剥成明文。只有中继落在**私网 / loopback / link-local**（例如自建中继、或 podman 的 `host.containers.internal`，它解析成 169.254.1.2）时才允许明文 —— 那种情况下两端之间没有别的网络，没人能来剥。

`SMTP_FROM` 必须是**裸地址**（`no-reply@example.com`），**不要**写 `Oh Your Ear <no-reply@example.com>`：同一个值还会被用作 SMTP 信封的发件人（`MAIL FROM`），带尖括号会让信封非法。

送达率上，给发信域名配好服务商给的 **SPF 与 DKIM** 记录，`SMTP_FROM` 用该域名下的地址；DMARC 可以先 `p=none` 看报告。验证码邮件是中英双语的（同一封里两段）。

**发信是后台的，接口立刻返回**：`POST /auth/code` 把邮件丢给一个 goroutine 就回 204（实测 4.7ms，改之前是 3.0–3.5s）。这个 204 从来不表示"已投递"，它表示"这个接口不会告诉你那个地址存不存在" —— 所以让调用方等中继没有任何收益，坏处倒是有：中继慢就慢到用户脸上，中继只接连接不说话就把请求挂到 20 秒超时。现在中继挂掉时接口依然是 3.6ms。

代价是**配置错了的症状是"接口正常、邮件不来"**，而且 204 更不可能代表投递成功，所以：

```bash
# 启动时就会打一行，写清用的哪个中继（不含密码）
podman logs oh-your-ear-api-1 | grep 'mail:'
#   mail: driver=smtp host=smtp.example.com port=587 from=no-reply@example.com auth=true

# 每次投递失败都在日志里
podman logs oh-your-ear-api-1 | grep 'failed to deliver'
```

`JWT_SECRET`、`POSTGRES_PASSWORD`、`FRONTEND_URL` **没有默认值，没设就直接拒绝启动**。这是故意的：一个已知的兜底密钥等于任何人都能签发 token。

## 5. 上线

**独占的机器**（80/443 空着）用 Caddy 自动签证书：

```bash
dnf install -y podman podman-compose   # 或 apt install podman podman-compose
git clone <repo> /srv/oh-your-ear && cd /srv/oh-your-ear
podman compose --env-file .env -f compose/compose.yml -f compose/compose.tls.yml up -d --build
curl -fsS http://127.0.0.1:8080/api/v1/health   # {"status":"ok"}
```

### 变体：跑在已有 nginx 的共享服务器上（当前实际部署就是这样）

如果这台机器已经在用宿主的 **nginx + certbot** 服务别的站点（80/443 被占），**不要用 TLS overlay** —— Caddy 会和 nginx 抢端口，把别的站点一起搞挂。改用宿主 nginx 顶在 API 前面：

```bash
git clone <repo> /opt/oh-your-ear && cd /opt/oh-your-ear   # 与机器上其他项目并排
podman compose --env-file .env -f compose/compose.yml up -d --build   # 只起 api + db
```

`compose.yml` 里 api 已经只绑 `127.0.0.1:8080`、db 不发布端口，所以和别的站点不会撞端口（注意别和机器上已有的 5432/9090/3000 之类冲突）。

然后加一个**独立**的 vhost（`/etc/nginx/sites-available/api-<domain>`），照这个形状：

```nginx
server {
    listen 80;
    server_name api.<domain>;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name api.<domain>;
    ssl_certificate     /etc/letsencrypt/live/api.<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.<domain>/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

顺序（每步都要安全）：

```bash
tar czf /root/nginx-backup-$(date +%s).tgz /etc/nginx          # 先备份整个 nginx 配置目录
# 先只写 80 那块，让 ACME 挑战可达
nginx -t && systemctl reload nginx
certbot certonly --nginx -d api.<domain> --non-interactive --agree-tos   # certonly：只签发，不改你的配置
# 再补上 443 那块
nginx -t && systemctl reload nginx
```

要点：

- **`certonly`，不是 `certbot --nginx`**：后者会去改 server block。签发和改配置分开，出问题好定位。
- **每次 `reload` 前先 `nginx -t`**（`reload` 是平滑的，失败的配置不该有机会生效）；先有备份，出问题直接还原。
- 续期复用机器上已有的 certbot 定时任务（`systemctl status certbot.timer` 或 `/etc/cron.d/certbot`），不需要额外配置。
- `.env` 里**不要**填 `DOMAIN` / `ACME_EMAIL`（那是 Caddy overlay 用的）。

**reload 后立刻用 curl 验证可能撞上窗口**：第一次可能会碰到旧 worker 还在服务（表现为证书不匹配）。等几秒再打一次即可，不是配置错。

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

### 上线后必查的两项（都是「默认值造成的开放面」）

```bash
curl -o /dev/null -w '%{http_code}\n' -X POST https://api.<domain>/api/v1/auth/mock
```

**必须是 404。** `/auth/mock` 是开发用的免验证登录口，历史上它无条件注册、且 `MOCK_AUTH_EMAIL` 有默认值 —— 那样任何公网调用者一个 POST 就能拿到会话。现在它只在显式配置了该变量时才注册（见 issue #83），`.env` 里**不要设 `MOCK_AUTH_EMAIL`**。

另一项看登录响应的 `Set-Cookie`：`refresh_token` 应当带 **`Secure`**（`FRONTEND_URL` 是 https 就自动带上）。

### Vercel 拓扑下限流会退化（已知，不是 bug）

请求链是：浏览器 → Vercel 边缘 → Caddy → api。`X-Forwarded-For` 的最后一跳是 **Vercel 的边缘 IP**，而它是动态的、不在 `TRUSTED_PROXIES`（默认只含私网段）里，所以 `ClientIP()` 取到的是边缘 IP 而不是真实访客 IP。

结果：**按 IP 的限流变成按边缘节点计数**（一个节点上的所有访客共享配额），而不是按访客。真正兜住滥用的是另外两层按账号/邮箱的规则（发码 60s 冷却、同码错 5 次作废），它们不受影响。

要恢复精确限流，二选一：

- 把 Vercel 的出口 IP 段加进 `TRUSTED_PROXIES`（Vercel 提供可查询的 IP 列表，但会变动，需要定期同步）；
- 或把限流键从 IP 换成邮箱/用户（更贴近真实滥用面，改动在 `middleware/ratelimit.go`）。

现在不动：单实例、有冷却与锁定在，收益小于复杂度。

`api` 容器经 Vercel 的 rewrite 对内网暴露给 Vercel 的边缘网络。绕过 Vercel 直接打 `api.<domain>` 在能力上与从前端打没有区别（同一个 API、同一套鉴权、没有 CORS 所以浏览器无法跨站读取响应），区别只是少了一层边缘。要收紧的话，可以给 API 加一个只由 rewrite 注入的共享密钥头。

## 6. 持续部署

前端两个 Vercel 项目从 `main` 自动部署；**后端（api + db）由 `.github/workflows/deploy.yml` 部署**。它等 CI 那一轮跑完**并且通过**（`workflow_run`，不是和它并行），再 SSH 到 VPS 执行 `compose/deploy.sh`。

**部署脚本进仓库，workflow 只负责触发。** 修部署流程和修代码因此是同一个 PR，而不是一份只活在某台机器上的 shell 历史。

脚本按顺序做四件事：**先 dump 数据库** → `podman compose up -d --build` → 等健康检查（默认 30 次 × 2 秒）→ **不健康就 checkout 上一个提交重建**。这条回滚有测试：`bash compose/deploy.test.sh`，用假的 podman/curl 在临时克隆里跑，覆盖"健康"、"不健康 → 回滚成功"、"回滚也不健康"三条路；CI 里也会跑。

### 一次性配置

1. 在 VPS 上生成一把**专用**部署密钥（不要用你日常登录那把）：

```bash
ssh-keygen -t ed25519 -C "oye-deploy" -f ~/.ssh/oye-deploy -N ""
```

2. 公钥追加进 `~/.ssh/authorized_keys`，**并用 forced command 把它锁死**：这把钥匙只能"签出某个提交并跑部署脚本"，拿不到 shell，也转发不了端口。

```
command="cd /opt/oh-your-ear && git fetch --quiet origin && git checkout --quiet "$SSH_ORIGINAL_COMMAND" && bash compose/deploy.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA… oye-deploy
```

3. 在自己机器上取一次 VPS 的 host key 并**核对**再存下来 —— 不要用 `ssh-keyscan` 现场取然后直通，那等于在同一根线路上问对方"你是不是你"：

```bash
ssh-keyscan -H <deploy-host>
```

4. 仓库 → Settings → Secrets and variables → Actions，加四个 secret：

| Secret | 值 |
| --- | --- |
| `DEPLOY_HOST` | VPS 的 SSH 主机 |
| `DEPLOY_USER` | 部署用的系统用户（第 1 步那个） |
| `DEPLOY_SSH_KEY` | 私钥全文（`~/.ssh/oye-deploy`） |
| `DEPLOY_KNOWN_HOSTS` | 第 3 步的输出 |

**没配 `DEPLOY_HOST` 时 workflow 会明确说"未配置"并跳过**，不会因为少三个 secret 就每次推 main 都红一片。

### 手动触发与回滚

```bash
gh workflow run deploy.yml            # 部署当前 main
cd /opt/oh-your-ear && git checkout <某个旧提交> && bash compose/deploy.sh   # 手动回滚
```

### 数据库：没有迁移步骤，但有一条硬规矩

schema 在 API 启动时幂等地跑（`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`），所以"更新数据库"就是重启 api，不需要单独的迁移阶段。代价是：**schema 变更只许增，不许改或删。** 改列名、删列、改类型都需要真的迁移工具（还没做），真要做的时候别指望这条幂等路径。

### 已知的粗糙处

部署期间有几秒不可用：`up -d --build` 要重建 api 容器。要做到零停机得两个容器加一次代理切换，现在不值得。

## 7. Vercel 的部署额度

免费计划每天 **100 次部署**，而且 **Vercel 的 Git 集成不认 GitHub 的 `paths-ignore`** —— 往分支推一次就是一次部署，哪怕只改了一个字的文档。2026-09-25 那天推了几十次（改一处、跑检查、推送、再改），额度被烧光，两个项目都返回 `Deployment rate limited — retry in 24 hours.`，于是**再推 main 前端也不会更新**，直到窗口恢复。被跳过的部署不会自动补：要补就在面板对最新提交点一次 Redeploy。

三个手段，按可靠程度排：

### 1. 分支策略：`dev` 优先（最可靠）

`dev` 是集成分支：从它切功能分支，PR 合进 `dev`，`dev` 攒够了再一个 PR 合进 `main`。目标是**推 `dev` 不创建任何部署**，靠官方字段：

```json
{ "git": { "deploymentEnabled": { "dev": false } } }
```

**这个字段现在写在三个地方**：仓库根的 `vercel.json`，以及 `apps/web/vercel.json` 和 `apps/landing/vercel.json`。三处同值，不会冲突。为什么都写：Git 集成到底读哪一份，在**额度耗尽的窗口内无法验证**——那个窗口里它给每个提交都挂一条 `Deployment rate limited`，分不清是"配置生效所以没创建"还是"创建了但被额度挡下"。（我先只写在子项目里、观察到一个提交没有状态，就下了"必须放根目录"的结论并写进文档；等再验一次，同一个实验给出了相反的现象，所以那个结论收回了。）

**怎么最终确认**（等额度恢复之后）：

- 往 `dev` 推一个提交，然后在 Vercel 面板看这个项目的部署列表：**里面没有对应条目**才是真的没创建部署；如果出现一条 `Canceled` 或 `rate limited` 的记录，说明部署还是被创建了。
- 顺带能看清第二个问题：**被 `ignoreCommand` 跳过的构建是否仍计入每天 100 次**。社区在问，Vercel 没明确答复，而面板上的计数是准的。

### 2. 每个项目各自判断该不该构建

文件改动和项目无关时，那个项目的构建直接跳过。两个 `vercel.json` 都是：

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ../../packages/shared"
```

`ignoreCommand` 的语义是**退出码 0 → 跳过构建**，非 0 → 构建，而 `git diff --quiet` 在没有差异时正好退出 0。`.` 是项目自身目录（Vercel 以项目根为工作目录），`../../packages/shared` 把共享包算进去——它改了，两个前端都该重建。

实测（在真实仓库里逐个跑过）：

| 改了什么 | web 项目 | landing 项目 |
| --- | --- | --- |
| 只改 `apps/api` 或文档 | 跳过 | 跳过 |
| `apps/web` | **构建** | 跳过 |
| `apps/landing` | 跳过 | **构建** |
| `packages/shared` | **构建** | **构建** |

**这条能省多少额度官方没说清楚**：社区在问「被忽略的构建是否仍计入 100 次/天」，Vercel 没有明确答复。所以它至少省下构建时间和构建次数，但**不要拿它当额度问题的唯一解法** —— 真正确定的是第 1 条。

### 3. 别把零碎提交直接推 `main`

`main` 上的每一次推送都是一次生产部署。修错别字、调文档、改后端脚本，先推 `dev`，等一次提升 PR 一起带上 `main`。
