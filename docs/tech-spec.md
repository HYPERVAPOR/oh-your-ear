# 技术选型确认

> 已拍板方案，作为后续开发依据。所有工具链版本均已锁定。

## Monorepo

- **包管理器**：pnpm 10.15.0
- **工作区**：pnpm workspaces
- **任务编排**：Turborepo 2.10.13
- **Node 版本**：24.16.0

## 前端

- **框架**：React 19.3.0 + Vite 8.3.0 + TypeScript 5.7.2
- **状态管理**：Zustand 5.0.15（本地状态）+ TanStack Query 5.102.8（服务端状态）
- **UI / CSS**：Tailwind CSS 4.3.3 + 自研组件（shadcn/ui 风格）
- **路由**：React Router 7.18.3
- **图标**：Lucide React 1.46.0

## 音频

- **引擎**：Tone.js 15.1.22
- **采样**：Salamander Grand Piano（钢琴）+ 打击乐采样/合成器（节奏）
- **策略**：按音域懒加载采样，首次播放由用户点击触发

## 乐理

- **库**：tonal 6.4.3

## 国际化

- **方案**：i18next 26.4.2 + react-i18next 17.0.14
- **首期语言**：简体中文、英文

## 主题

- **方案**：Tailwind CSS v4 自定义 `@theme` + 自研 ThemeProvider
- **模式**：浅色 / 深色 / 跟随系统

## 后端

- **语言 / 框架**：Go 1.26.4 + Gin 1.12.0
- **数据库**：PostgreSQL 17.4（pgx 5.11.0）
- **认证**：
  - JWT Access Token + Refresh Token（Refresh Token 存 httpOnly Cookie）
  - Google OAuth
  - 邮箱验证码（SMTP / Resend）
- **主要能力**：用户认证、练习记录、错题本、学习计划、统计报表、成就/打卡、设置同步

## 离线 / PWA

- **PWA**：Vite PWA plugin 1.3.0
- **本地缓存**：IndexedDB（Dexie.js）
- **策略**：离线时写本地，联网后批量同步到后端

## 部署

两个前端是纯静态产物，放在 Vercel；后端与数据库自托管在一台 VPS 上。

- **前端**：Vercel 两个项目，Root Directory 分别为 `apps/landing` 与 `apps/web`（Vercel 认 pnpm workspace，会从仓库根安装依赖，因此 `packages/shared` 可用）
- **后端**：`golang:1.26.4-bookworm` 构建 → `gcr.io/distroless/static-debian12` 运行，二进制无外部依赖
- **数据库**：`postgres:17.4-alpine`，只在 compose 网络内可达
- **网关 / HTTPS**：Caddy 只为 API 主机签证书（Vercel 负责前端的证书）
- **同源策略**：app 的 `/api` 由 Vercel 的 rewrite 代理回 VPS（`apps/web/vercel.json`），浏览器只与 app 域名交互 —— 刷新 cookie 保持 host-only、`SameSite` 用默认值、**API 不需要 CORS**，OAuth 回调也注册在 app 域名上

容器组成只剩两个（`api`、`db`），加可选的 `caddy`。部署细节见 [`docs/deploy.md`](./deploy.md)。

## 本地开发

- **环境**：Podman Compose
- **开发服务**：
  - `install`：一次性安装工作区依赖（两个前端共享同一份 `node_modules`，避免并发安装）
  - `web`：`node:24.16.0-slim` + pnpm，跑 Vite 热更新（5173）
  - `landing`：同上，落地页（5174）
  - `api`：`golang:1.26.4-bookworm`，跑 `go run`（8080）
  - `db`：`postgres:17.4-alpine`
- **工作流**：编辑器在宿主机，服务在容器，源码通过 bind mount 同步

## 目录结构

```
oh-your-ear/
├── apps/
│   ├── landing/            # 落地页（独立站点，可单独部署）
│   ├── web/                # app：练习、进度、题单
│   └── api/                # Golang 后端
├── packages/
│   └── shared/             # 设计令牌、字体、偏好、i18n 引导（两个站点共用）
├── scripts/
│   └── check-i18n.mjs      # 两个站点的 i18n key 检查
├── compose/
│   ├── compose.yml         # 生产：api + db
│   └── compose.dev.yml     # 本地开发
├── docs/
│   ├── prd.md
│   ├── tech-spec.md
│   └── deploy.md
├── package.json            # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## 关键决策理由

| 选型 | 理由 |
| --- | --- |
| React + Vite | 生态成熟，Tone.js 示例多，构建快 |
| Zustand + TanStack Query | 分工清晰：本地状态简单，服务端状态自动缓存同步 |
| Tailwind CSS v4 | 新版 CSS-first 配置，减少配置文件，主题切换方便 |
| Tone.js + Salamander | 真实钢琴采样，音质好，社区验证 |
| Golang + Gin + PostgreSQL | 自研后端可控，性能稳定，适合长期维护 |
| Podman Compose | 后端+数据库一次拉起，部署和本地开发一致 |
| Vercel 托管两个前端 | 静态产物交给 CDN，省掉自建静态托管与证书；`/api` 用 rewrite 保同源，API 与 cookie 逻辑不用为跨源做任何妥协 |
| landing 与 app 拆成两个应用 | 落地页不该为练习引擎付出首屏代价，两边的设计与文案演进节奏也不同（PRD 7.1.2） |
