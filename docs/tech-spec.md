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

- **方式**：服务器自建 + Podman Compose
- **容器文件**：`Containerfile`（Podman 原生，兼容 Docker）
- **基础镜像**：
  - 构建：`node:24.16.0-slim`、`golang:1.26.4-bookworm`
  - 运行：`nginx:1.27.5-alpine`、`gcr.io/distroless/static-debian12`
  - 数据库：`postgres:17.4-alpine`
- **容器组成**：
  - `web`：Nginx 托管构建后的静态页面
  - `api`：Golang 后端服务
  - `db`：PostgreSQL
  - （可选）`redis`：Refresh Token 黑名单 / 限流
- **网关 / HTTPS**：Caddy 或 Nginx 反向代理 + 自动 SSL

## 本地开发

- **环境**：Dev Container（通过 `@devcontainers/cli`）
- **基础镜像**：`mcr.microsoft.com/devcontainers/go:1.26-bookworm`
- **组成**：前端 Vite 热更新 + Golang 后端 + PostgreSQL，统一用 Podman Compose 拉起
- **容器运行时**：Podman

## 目录结构

```
oh-your-ear/
├── apps/
│   ├── web/                # React 前端
│   └── api/                # Golang 后端
├── compose/
│   ├── compose.yml      # 生产部署
│   └── compose.dev.yml  # 本地 Dev Container
├── .devcontainer/
│   ├── Containerfile
│   └── devcontainer.json
├── docs/
│   ├── prd.md
│   └── tech-spec.md
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
| Podman Compose | 前后端+数据库一次拉起，部署和本地开发一致 |
| Dev Container | 团队开发环境统一，避免「我电脑上能跑」 |
