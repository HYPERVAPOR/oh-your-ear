---
date: "2026-09-21"
category: "lesson"
tags: ["fonts", "css", "layout-shift"]
summary: "字体没到时拉丁字符会先落到 CJK 字体里的比例字形：等宽设计必须把等宽回退排在 CJK 之前，并把度量对齐"
---

# 等宽字体站点的回退面必须是等宽的

首次访问时文字"跳一下"的根因不是 `font-display: swap` 本身，也不只是度量差异 —— 是**回退到了比例字体**。

`--font-sans` 原为 `"JetBrains Mono", "Sarasa Mono SC", …, "Microsoft YaHei", …, sans-serif`，而 JBM 的 `@font-face` 只声明拉丁 `unicode-range`。字体未就绪时，浏览器**逐字符**回退：拉丁字母于是交给栈里第一个**拥有该字符**的字体 —— 雅黑/苹方，一个比例字体。

本机（Windows Chrome）实测每字符 advance：

| 面 | advance | 相对 JBM |
| --- | --- | --- |
| JetBrains Mono | 0.6000em | — |
| 原回退（Microsoft YaHei） | 0.9771em | 宽 **63%** |
| Consolas | 0.5498em | 窄 8% |
| Courier New | 0.6001em | 一致 |

所以不是几像素的抖动，是**整段文字先宽 63% 再缩回去**。

## 修法

1. **等宽回退排在 CJK 字体之前**：拉丁用系统等宽，中文仍走平台字体（逐字符回退会跳过没有 CJK 字形的等宽面）。
2. 给每个平台的回退面写 `@font-face { src: local(...) }` + `size-adjust` + `ascent-override` + `descent-override`（+ JBM 自己的 `unicode-range`）。**`local()` 解析失败的面会被跳过**，所以可以一个平台一个面地堆在栈里。
3. **`size-adjust` 里的 override 是相对"调整后"的 em**：要让最终 ascent 等于 102%，`size-adjust: 109.13%` 时 `ascent-override` 应为 `102 / 1.0913 = 93.5%`（不是 102%）。

## 验证方式

除逐面测 advance/asc/desc 外，跑一次整条栈的对比：同一段文字在"含 JBM"与"去掉 JBM"的栈下取 `getBoundingClientRect().width`。修完是 936.00px 对 935.97px（**0.03px**）；修前是 63% 的差。
