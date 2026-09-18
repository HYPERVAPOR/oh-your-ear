# 生产部署 Runbook

生产与本地开发共用一套 Podman Compose，差别只在变量与入口：开发用 `compose/compose.dev.yml`，生产用 `compose/compose.yml`（+ 可选 `compose/compose.tls.yml`）。

## 1. 服务器准备

```bash
dnf install -y podman podman-compose   # 或 apt install podman podman-compose
systemctl enable --now podman.socket   # 需要 docker 兼容 socket 时才要
git clone <repo> /srv/oh-your-ear && cd /srv/oh-your-ear
```

## 2. 配置 `.env`

写在仓库根目录（**不要提交**，已在 `.gitignore`）：

> ⚠️ 所有 `podman compose` 命令都要带 `--env-file .env`。compose 默认只在 **compose 文件所在目录**（这里是 `compose/`）找 `.env`，不带这个参数的话仓库根目录的 `.env` 会被无视，然后报「POSTGRES_PASSWORD must be set」——变量明明写了却说过没写。

```bash
POSTGRES_PASSWORD=<openssl rand -base64 24>
JWT_SECRET=<openssl rand -base64 48>
FRONTEND_URL=https://ear.example.com
APP_TIMEZONE=Asia/Shanghai

# 启用 Google 登录时填：
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=https://ear.example.com/api/v1/auth/google/callback

# 只用 TLS overlay（Caddy 自动签证书）时需要：
DOMAIN=ear.example.com
ACME_EMAIL=you@example.com

# 邮件验证码投递：MAIL_DRIVER=log 只在开发用，验证码会打在容器日志里
MAIL_DRIVER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=no-reply@ear.example.com

# 反代所在的网段，默认覆盖 compose 私网。限流按客户端 IP 计数，
# 所以这个必须配，否则所有请求都会算成反代容器的 IP（等于变成全局限流）
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

`MAIL_DRIVER=smtp` 走 STARTTLS（587 常见），不引第三方 SDK：`net/smtp` 直接对话。发信失败只写日志、接口照旧返回 204 —— 否则响应差异会泄漏"这个邮箱存不存在"。

这三个变量**没有默认值，没设就直接拒绝启动**（`JWT_SECRET`、`POSTGRES_PASSWORD`、`FRONTEND_URL`）。这是故意的：一个已知的兜底密钥等于任何人都能签发 token。

## 3. 上线

```bash
# 裸 80 端口（前面已有自己的反向代理 / 隧道时）
podman compose --env-file .env -f compose/compose.yml up -d --build

# 或者带 Caddy 自动 TLS（需要 80 与 443 都对公网开放，DOMAIN 的 A 记录已指向本机）
podman compose --env-file .env -f compose/compose.yml -f compose/compose.tls.yml up -d --build

curl -fsS http://127.0.0.1:8080/api/v1/health   # {"status":"ok"}
```

数据库结构在 api 启动时自动建表（`db.Migrate`），首次启动无需手工初始化。

## 4. 端口与网络

| 服务 | 对外 | 说明 |
| --- | --- | --- |
| `web` | `127.0.0.1:8080` → nginx:80 | 只绑回环，公网入口交给 Caddy 或你自己的代理；nginx 内部把 `/api` 转给 `api:8080` |
| `api` | 不发布端口 | 只在 compose 网络内可达 |
| `db` | 不发布端口 | 只在 compose 网络内可达 |

## 5. 备份

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

## 6. 升级

```bash
git pull
./compose/backup.sh                                                   # 结构变更前先备一份
podman compose --env-file .env -f compose/compose.yml up -d --build   # 用了 tls 就再带上 -f compose/compose.tls.yml
```

## 7. 日常排查

```bash
podman compose --env-file .env -f compose/compose.yml ps
podman logs --tail 100 oh-your-ear-api-1
podman logs --tail 100 oh-your-ear-web-1
podman logs --tail 100 oh-your-ear-caddy-1        # 用了 TLS overlay 时
```

## 8. 认证面的防线

| 机制 | 位置 | 说明 |
| --- | --- | --- |
| 验证码冷却 | `POST /auth/code` | 同一邮箱 60s 内只能发一次（SQL 层原子实现） |
| 验证码锁定 | `POST /auth/login` | 同一验证码错 5 次即作废 |
| IP 限流 | `POST /auth/code` / `POST /auth/login` | 每 IP 每小时 10 次发码、每 15 分钟 30 次登录；进程内计数，单实例有效 |
| token 吊销 | `POST /auth/logout` | refresh token 的 `jti` 写入 `revoked_tokens`，`/auth/refresh` 会拒绝；access token 短命(15m)不吊销 |
| 可信代理 | `TRUSTED_PROXIES` | 决定 `X-Forwarded-For` 是否可信，限流依赖它 |

限流是**进程内**的：多实例部署时每个实例各算各的，届时应换 redis（技术方案里也这么写）。
