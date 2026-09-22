---
date: "2026-09-22"
category: "technique"
tags: ["css", "responsive", "layout"]
summary: "overflow-x-auto 挡不住 grid/flex item 默认的 min-width: auto，内层宽内容会把整页撑宽；给 item 加 min-w-0"
---

# 滚动容器没能拦住溢出

首页重构后，390px 的视口下整页横向溢出到 739px。定位出来是仪表盘那两张卡片，实测 715px：

```
div.rounded-xl border border-hairline bg-surface  right=739
```

罪魁祸首是热力图：365 天日历的固有宽度约 664px（54 列 × 10px + 间隙），它**把 grid item 撑开了**。`overflow-x-auto` 是套在热力图内层的，看着应该能拦，但没拦住。

原因是 **grid / flex item 的 `min-width` 默认是 `auto`** —— 不是 0。它意味着"不小于内容的 min-content"，于是内层那 664px 的 min-content 一路传上去，父卡片、父 grid 都跟着变宽。`overflow-x-auto` 只负责"内容是滚动的"，管不了祖先的 min-content 传播。

**修法**：给 grid / flex item 加 `min-w-0`（必要时 `overflow-hidden`），它才能缩到容器宽度以下，内层的 `overflow-x-auto` 才真正生效。

```tsx
<div className="grid gap-2 lg:grid-cols-2">
  <Card className="min-w-0 ...">   {/* ← 就是这一句 */}
```

验完：scrollWidth 375 ≤ 390，不再溢出；热力图自身 665 / 277 正常滚动。

**下次**：写"能横向滚动的宽表格/日历"时，先问一句它的祖先里有没有 grid/flex —— 有就顺手加 `min-w-0`，别等量出来才发现。
