# Oh Your Ear - Agent Project Guide

## Project Overview

Oh Your Ear is a responsive web-based ear training application. It covers five core exercise modules: single notes, intervals, chords, melodies, and rhythms.

- Guest mode allows practicing all basic exercises without signing in.
- Signed-in users unlock study plans, progress statistics, a mistake notebook, streaks, and achievements.
- Initial login methods: email verification code + Google OAuth.
- Supports multiple languages (Chinese and English) and light/dark theme switching.

## Core Documents

| Document | Path | Description |
| --- | --- | --- |
| Product Requirements | [docs/prd.md](./docs/prd.md) | Feature requirements, user stories, module definitions, milestones |
| Tech Stack Confirmation | [docs/tech-spec.md](./docs/tech-spec.md) | Final tech stack, deployment approach, development environment |

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

### 1. 严格遵循开发流程

所有需求、bug、技术债务都必须先建立 **GitHub Issue** 进行追踪，并通过 **GitHub Project（看板）** 组织状态。

- 开发前：确认当前任务对应的 Issue 和 Project 状态
- 开发时：必须基于 `main` 切出**新分支**，禁止直接在 `main` 上提交
- 开发后：通过 **Pull Request** 合并到 `main`，CI 通过后方可合并

**分支命名规范**：

```text
feature/<issue-number>-short-description
bugfix/<issue-number>-short-description
refactor/<issue-number>-short-description
docs/<issue-number>-short-description
chore/<issue-number>-short-description
```

示例：`feature/12-tonejs-playback`

**Commit 信息规范**（遵循 Conventional Commits）：

```text
feat: add Tone.js sampler wrapper
fix: resolve audio context suspend on iOS Safari
refactor: move piano hook to features/piano
docs: update development setup guide
chore: bump pnpm to 10.16.0
```

**PR 描述规范**：

- 关联 Issue：`Closes #12`
- 说明改动内容、原因、影响范围
- 列出测试方式或验证截图

### 2. 以开发计划为开发依据

项目开发路线记录在 [docs/dev-plan.md](./docs/dev-plan.md)。

- 每个任务条目只能是三种状态之一：
  - `todo` / 🔴 没做
  - `doing` / 🟡 在做
  - `done` / 🟢 做完了
- 每次开发前查看 `dev-plan.md`，确认当前模块优先级和依赖关系
- 每次开发后更新 `dev-plan.md` 中相关条目的状态
- 不存在的任务先补充到计划中，再开始开发

### 3. 维护长期记忆系统

项目知识沉淀保存在 `docs/memory/` 目录，采用 **YAML frontmatter + Markdown** 格式，便于 Git diff 和后续检索。

每次遇到以下情况，必须创建或更新记忆条目：

- 棘手的 bug 及其解决方案
- 踩坑教训（工具链、部署、跨端兼容性等）
- 用户反复强调的偏好、约定或禁止事项
- 重要的架构决策及其取舍原因

**文件命名**：

- 踩坑/bugfix：`YYYY-MM-DD-short-title.md`
- 偏好/约定：`preference-short-title.md`
- 决策记录：`decision-short-title.md`

新增条目时，先复制 `docs/memory/.template.md`。

### 4. 其他实施约束

1. 新增功能前先阅读 [docs/prd.md](./docs/prd.md) 确认范围。
2. 实现必须符合 [docs/tech-spec.md](./docs/tech-spec.md) 中的技术栈约束。
3. 优先使用已有依赖；引入新依赖时必须说明原因，并记录在 PR 中。
4. 保持代码简单，关键逻辑用英文或中文注释说明。
