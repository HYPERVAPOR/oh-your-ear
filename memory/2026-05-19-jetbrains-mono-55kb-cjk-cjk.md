---
date: "2026-05-19"
category: "decision"
tags: []
summary: "字体家族统一为 JetBrains Mono（拉丁子集 55KB），中文不打包 CJK 字体，走等宽 CJK 回退栈"
---

## 背景

产品设计要求「一套极客、终端风格、工业质感字体家族」，即 display 与 UI 使用同一字体，层级只由字号/字重承载。

## 经过

- 选择 JetBrains Mono：自托管可变字体，拉丁子集 55KB 覆盖全部字重，比原本未生效的 Inter 文件还小，且无第三方运行时请求、可离线工作。
- 中文问题：一个完整的中文 webfont 有数 MB，不能打进包里。
- 字体栈在 display / ui 两处都改为：`'JetBrains Mono', 'Sarasa Mono SC', 'Noto Sans Mono CJK SC', 'Maple Mono CN', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`。
- 结果：Mac/Linux 上装有 Sarasa Mono SC 等的开发者可得到全等宽中文；Windows Chrome 没有这些字体，中文会回退到平台比例字体，与等宽的拉丁字符混排。

## 结论

- 拉丁与数字 100% 等宽终端风格已交付。
- 中文暂不打包 CJK webfont。若要真正实现「一套字体家族」的中文等宽，方案是**子集化**：UI 文案有限（约 212 个 i18n key），把 Sarasa Mono SC / Noto Sans Mono CJK SC 按实际用到的字形子集化，体积约 250–400KB，并配一个构建脚本 + CI 检查在文案变更时重新生成。

## 原因

完整 CJK 字体体积不可接受（数 MB）；子集化是唯一能兼顾中文等宽视觉与包体积的诚实方案。当前的回退栈是折中：不牺牲体积，但中文视觉不完整，需要向使用者明确说明。

## 参考

- 字体栈见 `DESIGN.md` 第 66–67 行
- i18n key 数量：212 keys，170 referenced（`pnpm run check:i18n`）
