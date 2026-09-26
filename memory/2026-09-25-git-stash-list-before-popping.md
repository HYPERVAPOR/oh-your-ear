---
date: "2026-09-25"
category: "lesson"
tags: ["git", "stash", "recovery"]
summary: "批量 git stash 循环中打印/弹出不全会丢失改动，恢复前应先 git stash list 全量枚举而不是只列前三个"
---

## 背景

为了在干净工作区里验证命令行为，写了一个循环，每次迭代 `git add -A` + `git stash -q`，循环跑了 4 次，产生 4 个 stash。

## 经过

事后只打印了 `stash@{0}`、`@{1}`、`@{2}` 三个并 pop 了这三个，于是最老的一个 `stash@{3}`（里面装着本次真正要保留的 `vercel.json` 改动）没有被弹出。同时工作区被 `git checkout --` 清空，看起来改动「凭空消失」，差点误判为编辑丢失并重做。

## 结论

排查时先 `git stash list` 全量枚举，再对每个 stash 用 `git stash show --name-only` 确认内容，最后逐个 pop；确认 `stash@{0}` 装着 `apps/web/vercel.json` + `apps/landing/vercel.json` 后 pop 成功，改动完整恢复。

## 原因

stash 是栈，`@{N}` 数字会随 pop 变化；用固定下标、只列前几个，很容易漏掉最老（也是最初）的那笔。恢复前一定要按内容而非按序号确认。

## 参考

```bash
git stash list | sed 's/^/  /'
for s in $(git stash list --format=%gd); do
  echo "$s:"; git stash show --name-only "$s"
done
git stash pop
```

更稳妥的做法：不要用「反复 stash」来制造干净工作区，改用 `git clone` 到临时目录做验证（本次最终就是这么做的）。
