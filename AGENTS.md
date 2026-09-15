# Oh Your Ear - Agent Project Guide

## Project Overview

Oh Your Ear is a responsive web-based ear training application. It covers five core exercise modules: single notes, intervals, chords, melodies, and rhythms.

- Guest mode allows practicing all basic exercises without signing in.
- Signed-in users unlock study plans, progress statistics, a mistake notebook, streaks, and achievements.
- Initial login methods: email verification code + Google OAuth.
- Supports multiple languages (Chinese and English) and light/dark theme switching.

## Core Documents

| Document                | Path                                     | Description                                                        |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Product Requirements    | [docs/prd.md](./docs/prd.md)             | Feature requirements, user stories, module definitions, milestones |
| Tech Stack Confirmation | [docs/tech-spec.md](./docs/tech-spec.md) | Final tech stack, deployment approach, development environment     |

## Tech Stack at a Glance

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **State**: Zustand + TanStack Query
- **Audio**: Tone.js + Salamander piano samples
- **Music Theory**: tonal
- **i18n**: i18next
- **Backend**: Golang + Gin + PostgreSQL (pgx + sqlc)
- **Auth**: JWT + Google OAuth + email verification code
- **Deployment**: Self-hosted server + Podman Compose
- **Local Dev**: Podman Compose

## Agent Working Principles

### 1. 遵循开发流程与计划

所有需求、bug 先建 GitHub Issue，用 GitHub Project 看板管理。开发从 `main` 切新分支，CI 通过后提 PR 合并。分支名、commit、PR 遵循常规规范（如 `feature/12-tonejs-playback`、`feat: ...`、`Closes #12`）。

开发进度参照 [docs/dev-plan.md](./docs/dev-plan.md)，每个条目状态只能是 `todo` / `doing` / `done` 三者之一，开发前后更新。

小改动（错别字、文档微调等）可直接 push 到 `main`，无需走分支和 PR。

### 2. 维护长期记忆系统

项目知识沉淀保存在根目录 `memory/`，格式为 **YAML frontmatter + Markdown**。只记录真正值得沉淀的内容。

#### 应该记录（正面案例）

| 类别               | 例子                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| 棘手 bug           | 某个浏览器下音频上下文无法自动恢复，需要特定时机调用 `resume()`         |
| 工具链踩坑         | ESLint v10 与 React/TS 插件 peer dependency 冲突，改用 oxlint           |
| 环境陷阱           | Podman 下 volume 权限导致 PostgreSQL 启动失败                           |
| 用户反复强调的偏好 | 「不要 ESLint v10」「容器只跑服务，编辑器在 host」「README 保持用户向」 |
| 关键架构决策       | 为什么用 OpenAPI 而不是 tRPC/proto；为什么选 Zustand 而不是 Redux       |
| 性能/安全教训      | 音频采样文件过大导致首屏加载慢；JWT 不要存 localStorage                 |
| 非官方方案         | Stack Overflow 上某个高赞答案在这个项目里不生效，真正解法是什么         |

#### 不应该记录（反面案例）

| 类别                 | 例子                                    |
| -------------------- | --------------------------------------- |
| 简单语法错误         | 拼错了 import 路径、漏了分号            |
| 官方文档已有         | React `useEffect` 依赖数组怎么写        |
| 一次性失误           | 临时打错命令，下次不会复现              |
| 易搜索问题           | npm 某个常见报错，Google 第一条就是答案 |
| 立刻被替换的临时方案 | 已经 rollback，没有参考价值             |
| 纯个人喜好           | 与项目无关的代码风格争论                |

#### 文件命名与模板

- bugfix/踩坑：`YYYY-MM-DD-short-title.md`
- 偏好/约定：`preference-short-title.md`
- 决策记录：`decision-short-title.md`
  新增条目时复制 `memory/.template.md`。
