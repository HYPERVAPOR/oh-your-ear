---
date: "2026-09-20"
category: "lesson"
tags: ["headless-chrome", "verification", "responsive"]
summary: "Windows 上 Chrome 窗口最小宽度约 526px：--window-size=390 会静默按 526 布局再裁图，导致所有“手机版”测量失真"
---

# `--window-size=390` 并不是 390

在 WSL 里用 Windows 版 Chrome 做窄屏验证时踩到的坑：

```bash
chrome --headless=new --window-size=390,844 --screenshot=phone.png http://localhost:5174/
```

截图确实是 390×844，**但页面是按 526px 布局的**（Windows 上 Chrome 窗口有个 ~526px 的最小宽度），截图只是把 526 宽的版面裁掉右边。

后果：任何"手机上溢出/偏移"的像素测量都是假的。实测中看到 `document.documentElement.clientWidth = 511~526`、图表在 390 宽的图里"贴到右边缘"，于是花了好几轮去修一个**根本不存在的布局 bug**（改尺寸、改透视、减偏航角）。

## 怎么发现

在页面里打印真实宽度，而不是相信截图：

```
请求 380 → 实际布局宽 526
请求 460 → 实际布局宽 526
请求 520 → 实际布局宽 526
```

## 以后怎么做

- 需要真机宽度时用 CDP 的 `Emulation.setDeviceMetricsOverride`，**不要**用 `--window-size`。
- 只用 `--window-size` 时，先在页面里读一次 `document.documentElement.clientWidth` 作为可信度检查；它和请求值不一致就说明被 clamp 了。
- 窄屏（<526）的布局，宁可**按 CSS 推**：固定 px 尺寸 + 已知容器宽度（`100vw - 48px`）就能算出来，别拿裁出来的截图当证据。
