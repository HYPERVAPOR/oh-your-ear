---
date: "2026-09-25"
category: "decision"
tags: ["git", "branching", "vercel", "ci", "deployment", "security"]
summary: "dev 是集成分支（所有分支从它切、所有 PR 提向它，且推它不创建部署）；只有明确要求才把 dev 合进 main。main 开了 ruleset 保护，没有 bypass。"
---

# dev 集成分支，main 受保护

## 背景

两条压力同时到来。Vercel 免费额度每天 100 次部署，而它的 Git 集成不认 GitHub 的 `paths-ignore`——推一次就是一次部署，一天几十次小推送就把额度烧光，之后两个前端都不再更新。同时 `compose/deploy.sh` 进了仓库，而它在生产机上以 root 执行，所以「谁能推 main」实际上等于「谁能在生产机上跑代码」，而 main 当时是 `Branch not protected`。

## 决定

- **`dev` 是集成分支**：所有分支从 `dev` 切，所有 PR 提向 `dev`。推 `dev` 不部署 API（部署 workflow 只在「CI 在 main 上通过」时触发）。
- **只有明确要求时才从 `dev` 提 PR 到 `main`**。「合进 main = 上线」，它是一个动作，不是习惯。不要自己提升。
- **`main` 用 ruleset 保护**（`main: PR only`，id 23998975）：`deletion` + `non_fast_forward` + `pull_request`（0 个批准，个人项目）+ 六个必过 CI 检查，**`bypass_actors` 为空**，管理员也拦。`dev` 不设保护。
- 判据看 GitHub 实际生效的规则，不看我的配置意图：
  `gh api repos/HYPERVAPOR/oh-your-ear/rules/branches/main`

## 代价与注意

- 必过检查是**按 job 名**匹配的：以后改 `.github/workflows/ci.yml` 里的 job 名，必须同步改 ruleset，否则提升 PR 永远等一个不会出现的检查。`deploy`（CD 那个）**不要**列进去——它只在 main 上跑，列上去会让提升 PR 死锁。
- 保护是「必须走 PR」，不是「必须有人批准」：0 个批准意味着自己提自己合没问题，但**推不上去**。
