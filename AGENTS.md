# Oh Your Ear - Agent Project Guide

响应式 Web 练耳应用，五个模块：单音、音程、和弦、旋律、节奏。游客可练基础题；登录后解锁学习计划、进度统计、错题本、连续打卡、成就。登录方式：邮箱验证码 + Google OAuth。中英双语 + 明暗主题。

## 核心文档

| 文档 | 路径 | 内容 |
| --- | --- | --- |
| PRD | [docs/prd.md](./docs/prd.md) | 需求、用户故事、模块定义、里程碑 |
| 技术方案 | [docs/tech-spec.md](./docs/tech-spec.md) | 最终技术栈、部署方式、开发环境 |
| 开发计划 | [docs/dev-plan.md](./docs/dev-plan.md) | 进度，条目状态仅 `todo`/`doing`/`done`，开发前后更新 |

## 技术栈

前端 React 19 + Vite + TS + Tailwind v4 · 状态 Zustand + TanStack Query · 音频 Tone.js + Salamander 钢琴采样 · 乐理 tonal · i18n i18next · 后端 Go + Gin + PostgreSQL（pgx + sqlc）· 认证 JWT + Google OAuth + 邮箱验证码 · 部署自托管 + Podman Compose（本地开发同）

## 开发流程

1. 需求/bug 先建 GitHub Issue，GitHub Project 看板管理。
2. **从 `dev` 切分支开发，CI 通过后提 PR 合进 `dev`**；`dev` 攒够了再提一个 PR 合进 `main`。命名遵循常规：`feature/12-tonejs-playback`、`feat: ...`、`Closes #12`。
3. **推 `dev` 不部署任何东西**：Vercel 被显式忽略（`git.deploymentEnabled`），API 只在「CI 在 main 上通过」时才部署。合进 `main` 才是上线。这条是为了省 Vercel 每天 100 次部署的额度——详见 `docs/deploy.md` §7。
4. 小改动（错别字、文档微调）直接 push `dev`，无需分支和 PR。
5. **PR 里的 `Closes #N` 只在验收条件全部满足时才写**；没满足就写 `Refs #N`，让 issue 开着。踩过：一个核心验收还没通过的 issue 被 `Closes` 关掉，还得手工 reopen —— 而那个 issue 开着正是为了记住"这件事还没验"（#136）。

## 长期记忆系统

历史决策、踩坑、用户偏好沉淀在 [`memory/`](./memory/)（格式、分类、命名、模板见 [memory/README.md](./memory/README.md)）。**按需读取，不要当热上下文反复注入。**

记：棘手 bug、工具链/环境踩坑、用户反复强调的偏好、关键架构决策及原因、性能/安全教训、非官方方案及真实解法。

不记：简单语法错误、官方文档已有、一次性失误、易搜索的常见报错、已 rollback 的临时方案、纯个人喜好。

Compact 或开新对话前，回顾本轮是否有值得沉淀的内容并写入 `memory/`。
