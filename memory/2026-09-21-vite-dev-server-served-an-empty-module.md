---
date: "2026-09-21"
category: "pitfall"
tags: ["vite", "hmr", "dev-server"]
summary: "跑了几个小时的 Vite dev server 可能开始返回空模块：报「does not provide an export named X」而 tsc/build 全绿，重启容器即可"
---

# dev server 会返回空模块，而 tsc / build 全绿

探针页突然报：

```
Uncaught SyntaxError: The requested module '/src/components/piano-roll.tsx?t=…'
does not provide an export named 'PianoRoll'
```

同时 `tsc -b`、`pnpm build`、`lint` 全部通过 —— 代码没问题。`curl` 一下那个模块就看清了：**变换结果是空的**，只剩一个 `sourceMappingURL`，`sourcesContent` 也是空字符串。

原因：这个 dev server 已经连续跑了好几个小时、中间反复 HMR 同一个文件，进了坏状态。与 `memory/2026-09-19-vite-stale-css-vs-direct.md` 是同族问题（dev server 的状态与磁盘不一致）。

## 处理

```
podman restart oh-your-ear-landing-1
```

重启后同一个 `curl` 立刻返回正常模块（`grep -c PianoRoll` = 4）。

## 判据

遇到「模块没有导出 X」但类型检查和构建都过 → **先 `curl` 那个模块看内容**，别看代码。空模块 = dev server 的问题，不是你的问题。

## 同一根因的第二种长相：不是空模块，而是**旧版本**（2026-09-25，一天遇到两次）

症状：页面整片空白（`#root` 里什么都没有），浏览器控制台是

```
Uncaught SyntaxError: The requested module '/src/components/auth/auth-card.tsx?t=…' does not provide an export named 'AuthCard'
```

看起来像我刚改坏了代码，但**模块根本不是空的，是过时的**：`curl http://localhost:5173/src/components/auth/auth-card.tsx` 里连我刚加的参数都不存在。`pnpm typecheck` / `lint` 全绿 —— 因为磁盘上的代码是好的。

判断与处理：
1. 页面白屏 + “模块不提供某个 export”，而本地检查全绿 → **先怀疑 dev server 的缓存，不要怀疑自己刚写的代码**。
2. 一个命令定性：`curl -s http://localhost:5173/src/<那个文件> | grep <你刚加的标识>` —— 没有就是过时。
3. 处理：`podman restart oh-your-ear-web-1`，等 200 再验。
4. 同一天遇到两次，且都发生在连续改多个文件之后 —— 这个 dev server 不该指望它长期正确。
