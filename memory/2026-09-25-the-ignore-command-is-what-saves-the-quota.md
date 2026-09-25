---
date: "2026-09-25"
category: "lesson"
tags: ["vercel", "ci", "quota", "deployment"]
summary: "真正省 Vercel 额度的是 vercel.json 的 ignoreCommand（跳过的构建在 API 里是 CANCELED，实测不计数），不是 git.deploymentEnabled 分支规则（fix/*、dev、feat/* 都照常部署）"
---

## 背景

Hobby 计划每天 100 次部署，一度被一天的零碎推送烧光。当时上了三层治理：`git.deploymentEnabled` 关掉 dev 与各特性分支、`ignoreCommand` 跳过不改前端的提交、CI 只跑 main 与 dev。

## 事实（2026-09-25 UTC 全天，从 Vercel API 逐条查，不看 GitHub 状态）

- 两个项目合计 **111 条部署记录**，其中 **READY 99 条、CANCELED 12 条**；额度正是在 READY 逼近 100 时开始被拒。
- 被 `ignoreCommand` 跳过的构建记作 **CANCELED**（不是没有记录）→ **跳过的构建不计数**，`ignoreCommand` 确实在省额度。
- 而**分支规则没有拦住任何东西**：`dev`、`feat/118-avatar`、`feat/107-home-dashboard`、`refactor/122-login-ui`、`fix/115-*`、`fix/159-*` 各自都有部署记录（两个项目各一份），尽管配置里写着这些分支为 `false`。`fix/159-*` 那次是在额度恢复、且提交树里**确实带着**该配置的情况下仍然部署的。
- 配置位置已核过：两个项目的 `Root Directory` 分别是 `apps/web` / `apps/landing`，配置就在那两个 `vercel.json` 里（`git.deploymentEnabled`）；仓库根那份已删除（它从来没被读过）。

## 结论 / 怎么做

1. **省额度靠 `ignoreCommand`**：`git diff --quiet HEAD^ HEAD -- . ../../packages/shared` —— 没改到这个项目就跳过构建，跳过不计数。注意相对路径是相对**项目根**（Root Directory）算的。
2. **不要指望 `git.deploymentEnabled` 拦住分支**（至少在这两个项目上、这个计划下没有拦住）。真要一条预览都不建、只在发布时部署，可靠的路子是把 Git 集成的自动部署关掉，改由 CI 用 Vercel CLI + token 在 main 上部署。
3. **判断"规则有没有生效"必须在额度可用时做**，并且去看 Vercel API 的部署记录数，而不是 GitHub 上有没有状态（额度耗尽时两者都没有状态）。

## 补充（同日更晚）：`dev: false` 是**有效**的，无效的是 `fix/*` 这类模式

在那条 `fix/159-*` 之后又推了一次 `dev`（`4608d6c`，改的是 `apps/web`，额度当时可用），这次：

- Vercel API 里**找不到这个 sha 的部署记录**（两个项目都没有）；
- GitHub 上**没有任何 Vercel 状态**。

所以 `dev: false` 确实拦住了 —— 这一条从此可以当成立。回看 UTC 当天仅有的两条 `dev` 记录（13:30:30、13:53:30），它们的提交正是在「`dev` 被 reset 到 #139 之前」的那段时间推的，**提交树里没有这份配置**，所以那两条不算反例。

于是结论收紧成：**`dev: false` 有效；`fix/*`（在提交树里带着配置的情况下）没拦住**。同一个 `git.deploymentEnabled` 对象里两种模式表现不一致，可能的原因是 PR 与分支推送走了不同的判定路径（对 PR 可能按 base/生产分支的配置判），但这一点我没有验到底 —— 要下结论得在额度可用时再推一个 `fix/*`（不带 PR）看记录，而每验一次就烧一次额度，不值得常态化做。

实践含义：**别指望特性分支的模式能省额度**。特性分支上改了 `apps/web` 的推送仍会各建一条（`ignoreCommand` 只在「该项目文件没改」时才跳过）。要彻底干净，就把 Git 自动部署关掉、只在 CI 里部署 main。
