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
