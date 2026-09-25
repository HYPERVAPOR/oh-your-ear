---
date: "2026-09-25"
category: "lesson"
tags: ["git", "branching", "vercel", "ci", "process"]
summary: "对集成分支执行 reset --hard main，会悄悄丢掉这期间落在 main 上的 PR：dev 因此在两小时里一直缺着 #139 的配置变更，而当时若把 dev 提升到 main，还会把 #139 回滚掉。"
---

# `reset --hard main` 会吃掉中间落地的 PR

## 经过

`dev` 是集成分支（见 `2026-09-25-dev-is-the-integration-branch-main-is-protected.md`）。它刚建好、还没什么内容时，为了"和 main 保持一致"，做了一次：

```bash
git checkout dev && git reset --hard main && git push --force-with-lease
```

看起来只是把 dev 归位。但**在这之后**，`#139` 才合进 main——而 dev 已经固定在更早的 main 提交上，于是 `#139` 的变更永远不在 dev 的历史里。

后果一：`#139` 加进两个项目 `vercel.json` 的 `git.deploymentEnabled` 配置从 dev 消失了。我后来所有分支都从 dev 切、合并回 dev，所以配置一直是缺的，而 Vercel 读的正是被推送提交里的配置——"dev 推送不创建部署"这件事因此静默失效了很久，我一度以为是 Vercel 的字段不生效。

后果二（当时没发生但更危险）：如果那时直接把 dev 提升到 main，`#139` 的内容会被**回滚**——而它正是当时唯一让 dev 不部署的配置。

## 教训

- **集成分支落后于 main 时，用 `merge main → dev`，不要 `reset --hard`。** merge 保留两边的历史，reset 把 main 上已落地的提交从 dev 的历史里抹掉。
- 集成分支和 main 的差异必须是"dev 有 main 没有的东西"，不能是"dev 没有 main 已有的东西"——后者在下一次提升时会变成一次回滚。
- 发现自己持续在错的层面上找原因（这次是"Vercel 的字段到底读哪一份"）时，回头核对**假设本身是否还成立**：我核对了很多次"配置写在哪"，却没核对过"配置到底在不在被推的那个提交里"。
