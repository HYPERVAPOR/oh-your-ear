---
date: "2026-09-17"
category: "preference"
tags: ["agent-skills", "gitignore", "project-setup"]
summary: "Agent skill 安装到项目级别；用 skills-lock.json 记录已安装 skill，.agents/ 目录加入 .gitignore 不提交。"
---

# Agent skill 项目级安装约定

## 背景

用户要求安装 `frontend-design` skill，并且明确要“装到项目级别，不是全局”。

## 经过

使用 `npx skills add https://github.com/anthropics/skills --skill frontend-design` 后，skill 被安装到：

```
~/projs/oh-your-ear/.agents/skills/frontend-design/
```

同时生成了 `skills-lock.json`。

`.agents/` 默认没有被 `.gitignore` 忽略，Git 会把它当成未跟踪文件。skill 本身只是 prompt 指引文件，不需要提交到仓库；只要保留 `skills-lock.json`，其他人就能通过 `npx skills experimental_install` 恢复。

## 结论

- `.gitignore` 加入 `.agents/`
- 提交并跟踪 `skills-lock.json`
- skill 重新安装的命令：

```bash
npx skills experimental_install
```

## 原因

- `.agents/` 是第三方 skill 的本地副本，可重新生成。
- `skills-lock.json` 是轻量的锁定文件，适合版本控制。
- 与 `node_modules` + `package-lock` / `pnpm-lock` 的分离思路一致。

## 参考

- Commit: `chore: ignore .agents skill directory, track skills-lock.json`
- `.gitignore`
- `skills-lock.json`
