# 技术选型确认

> 已拍板方案，作为后续开发依据。

## 前端

- **框架**：React 18 + Vite + TypeScript
- **状态管理**：Zustand（本地状态）+ TanStack Query（服务端状态）
- **UI / CSS**：Tailwind CSS + shadcn/ui
- **路由**：React Router v6
- **图标**：Lucide React

## 音频

- **引擎**：Tone.js
- **采样**：Salamander Grand Piano（钢琴）+ 打击乐采样/合成器（节奏）
- **策略**：按音域懒加载采样，首次播放由用户点击触发

## 乐理

- **库**：tonal

## 国际化

- **方案**：i18next + react-i18next
- **首期语言**：简体中文、英文

## 主题

- **方案**：Tailwind CSS dark mode + 自研 ThemeProvider
- **模式**：浅色 / 深色 / 跟随系统

## 后端

- **语言 / 框架**：Golang + Gin
- **数据库**：PostgreSQL（pgx + sqlc）
- **认证**：
  - JWT Access Token + Refresh Token（Refresh Token 存 httpOnly Cookie）
  - Google OAuth
  - 邮箱验证码（SMTP / Resend）
- **主要能力**：用户认证、练习记录、错题本、学习计划、统计报表、成就/打卡、设置同步

## 离线 / PWA

- **PWA**：Vite PWA plugin
- **本地缓存**：IndexedDB（Dexie.js）
- **策略**：离线时写本地，联网后批量同步到后端

## 部署

- **方式**：服务器自建 + Docker Compose
- **容器组成**：
  - `frontend`：Nginx 托管构建后的静态页面
  - `api`：Golang 后端服务
  - `db`：PostgreSQL
  - （可选）`redis`：Refresh Token 黑名单 / 限流
- **网关 / HTTPS**：Caddy 或 Nginx 反向代理 + 自动 SSL

## 本地开发

- **环境**：VS Code Dev Container
- **组成**：前端 Vite 热更新 + Golang 后端 + PostgreSQL，统一用 Docker Compose 拉起

## 目录结构

```
oh-your-ear/
├── apps/
│   ├── web/                # React 前端
│   └── api/                # Golang 后端
├── packages/
│   └── shared/             # 共享类型/工具（可选）
├── docker/
│   ├── docker-compose.yml  # 生产部署
│   └── docker-compose.dev.yml  # 本地 Dev Container
├── docs/
│   ├── prd.md
│   └── tech-spec.md
└── README.md
```

## 关键决策理由

| 选型 | 理由 |
| --- | --- |
| React + Vite | 生态成熟，Tone.js 示例多，构建快 |
| Zustand + TanStack Query | 分工清晰：本地状态简单，服务端状态自动缓存同步 |
| Tailwind + shadcn/ui | 快速响应式开发，组件源码可控 |
| Tone.js + Salamander | 真实钢琴采样，音质好，社区验证 |
| Golang + Gin + PostgreSQL | 自研后端可控，性能稳定，适合长期维护 |
| Docker Compose | 前后端+数据库一次拉起，部署和本地开发一致 |
| Dev Container | 团队开发环境统一，避免「我电脑上能跑」 |
