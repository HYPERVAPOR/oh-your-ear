---
date: "2026-09-21"
category: "pitfall"
tags: ["verification", "headless-chrome", "webaudio"]
summary: "自建探针页能验证接线，但验证不了音频与 rAF：headless 不渲染 Web Audio，rAF 被饿死——画面逻辑要抽成纯函数用假 ctx 测"
---

# 探针页的边界：能验接线，验不了音频与动画

这台机器上（WSL + Windows Chrome）够不到 CDP ✗，所以验证浏览器行为用的是一个土办法：**写一个临时页面，让它自己驱动被测代码，把结论写进 DOM，再 `--dump-dom` 读回来**。这个办法很好用（抓 MIDI、验音频接线都靠它），但有两处硬边界，这次各踩了一次：

1. **headless 不渲染 Web Audio**：`AudioContext` 建得出来、`AnalyserNode` 也拿得到（`frequencyBinCount=256`），但 `getByteFrequencyData` **全是 0** —— 没有输出设备就没有渲染线程。所以"频谱会不会亮"用探针**测不了**。
2. **rAF 被饿死**：`--virtual-time-budget` 会把定时器快进，页面跑完只过了几个真实帧（实测 `frames=6`）。任何靠 rAF 驱动的画面（游标、频谱）在探针里几乎不会执行，于是"画布退回默认 300×150"这种假失败很容易被当成真 bug 去查。

## 结论

- 接线层面（节点建没建、谁连到谁、`playNote` 的参数有没有传对）→ 探针页好用，继续用。
- 画面/动画层面 → **把绘制抽成接收 `ctx` 的纯函数**，用假 canvas + 假 ctx 在 `node --test` 里测（记录 `fillRect` 调用，断言落地点、1px 间隙、高度）。无需浏览器，也不受这两个边界影响。
- 剩下那点胶水（rAF 唤醒与停止）交给眼睛，一次点击就能确认。

## 顺带

手写的探针 HTML 如果 import 了 React，必须自己补 `@vitejs/plugin-react` 的 Fast Refresh preamble，否则报 `can't detect preamble`；或者别在 HTML 里写裸导入（静态 HTML 不过 Vite 变换，`react` 这类裸包名解析不了），改成一个 `.tsx` 探针文件、由 `<script type="module" src="/src/...">` 加载。
