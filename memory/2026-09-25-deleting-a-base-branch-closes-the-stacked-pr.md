---
date: "2026-09-25"
category: "lesson"
tags: ["git", "github", "pr", "workflow"]
summary: "base 分支被删除时 GitHub 会自动关闭叠在它上面的 PR，且已关闭的 PR 不允许再换 base —— 要么先换 base 再合父 PR，要么用 --delete-branch 之外的办法留下 base"
---

# 合掉栈底那一层，会把栈上面那层 PR 一起关掉

首页 dashboard（#109）叠在登录回跳（#108）上：`base = fix/106-login-returns-where-you-were`，只有 Vercel 在跑，CI 完全不触发（workflow 只在 `pull_request: branches: [main]` 上）。这是当时就知道的、有意接受的代价——单独看没错。

问题出在合并那一刻。我用：

```
gh pr merge 108 --squash --delete-branch
```

父 PR 合进 main，**base 分支被删除**，然后：

```
gh pr view 109  →  state: CLOSED   mergeable: CONFLICTING
gh pr edit 109 --base main   →  GraphQL: Cannot change the base branch of a closed pull request.
gh pr reopen 109             →  GraphQL: Could not open the pull request.
```

两条路都堵死：base 分支一消失，PR 就自动关闭；已关闭的 PR 不允许改 base；而 base 分支不存在时它也不让你重开（重开需要 base 还在）。删除的决定和关闭的后果，都是 GitHub 自动行为，`--delete-branch` 只是扣了扳机。

## 怎么办

**首选：合父 PR 之前，先把子 PR 的 base 换成 main。** 子分支本来就要 rebase 到新的 main（否则它带着一笔已经 squash 进 main 的同内容提交，diff 会重复），顺序是：

```
gh pr edit <child> --base main          # 此刻父 PR 还没合，base 分支还在，允许改
git rebase --onto main <父PR那笔提交> <子分支>   # 丢掉重复的那笔
git push --force-with-lease
gh pr merge <parent> --squash --delete-branch  # 现在删 base 也伤不到子 PR
```

Hmm，顺序上先换 base 更稳：改 base 时父分支必须还在，而 rebase 到 main 需要 main 已经有父 PR 的内容——父 PR 没合时 main 里没有。所以真正的顺序是 **先合父 PR（不加 `--delete-branch`），再 rebase，再让 GitHub 自动 retarget**：

```
gh pr merge <parent> --squash          # 先不删分支
git fetch origin main:main
git rebase --onto main <父PR那笔提交> <子分支>
git push --force-with-lease
gh pr edit <child> --base main         # 父分支还在，这条能成
gh branch -D <父分支> && git push origin --delete <父分支>   # 换完 base 再删，安全
```

**已经关掉之后：重开无望，直接开一条新 PR**（同分支、`--base main`），把旧 PR 的正文搬过去，然后在旧 PR 上留言说明原委。这次就是这么处理的：#109 关闭并留了说明，内容原样进了 #114。

## 附带的教训

- 叠 PR 时，子 PR 的 CI **一次都不会跑**：`pull_request: branches: [main]` 只匹配 base 是 main 的 PR。要它跑就得把 workflow 的触发条件放开，或者接受"合到 main 前后各跑一次"。
- 别用 `cmd | tail -1` 判断 `gh` 是否成功。`gh pr merge` 的输出被截断后看起来像没执行，实际已经合了——判状态要 `gh pr view --json state`。
- rebase 时唯一的真冲突在 `packages/shared/src/tokens.css`：子分支新增的 `--hairline-hover` 插在父/主干已经改写过的浅色块中间。解法是保留主干的整块值，只把新增那一行按新 palette 重算（`#a8a29e` → `#9a948f`，因为结构线已经从 `#d6d3d1` 变成 `#aea9a4`）。
