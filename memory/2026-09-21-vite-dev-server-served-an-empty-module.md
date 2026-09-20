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
