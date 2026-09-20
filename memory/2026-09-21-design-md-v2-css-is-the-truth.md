---
date: "2026-09-21"
category: "decision"
tags: ["design-system", "docs", "process"]
summary: "DESIGN.md 重写为 v2：不再复制 token 数值，开篇声明 tokens.css 是唯一真相；词汇表定位为 geek/terminal/Ableton"
---

# DESIGN.md v2：CSS 是真相，文档只讲词汇

`DESIGN.md` 从 M16 之前一直没动，等到有人去读时，**几乎每一节都是反的**：柔光球当模块身份、胶囊 CTA、圆角 4–16px、标题字重 300、"锐角不属于本系统" —— 而 M16 恰好把这些全部推翻了。同时它还是 `tokens.css` 与 `button-variants.ts` 注释里指向的文件（"Vocabulary of DESIGN.md"）。

**它腐烂的方式值得记住：把 token 数值抄了一遍。** 值改了，抄本不会自己跟着改，于是文档从"参考"变成"误导"。

## v2 的立场

- 开篇第一句：**这份文件不是真相，`packages/shared/src/tokens.css` 才是**；两者冲突以 CSS 为准，并把这份文件当 bug 修掉。
- **不再复制任何数值。** 只讲：什么元素叫什么（`iconKey`/`iconGroup`/压条/色块/热力图三档）、什么时候用哪个、什么永不做。
- 分权写清：`docs/prd.md` §7.1 = 方向与理由；`tokens.css` = 值；`DESIGN.md` = 词汇；`memory/` = 过程。
- 加了「永不做」表，把这一路试过并否决的东西记下来（光晕/粒子/鼠标跟随、玻璃拟态、霓虹、`#7C3AED`、圆角、装饰性大写、衬线+等宽两种声音、Ableton 皮肤、3D 里的发丝线、装饰性波形）。

定位（用户原话）：**geek / terminal / Ableton** —— 要 Ableton 的**词汇**（走带、焊接键、卷帘窗、分析仪），不要它的皮肤。

## 顺带修掉的两处过期断言

- PRD §7.1.3 还写着「停止只停调度与游标，要立刻静音得加 master gain」—— 早已被音频总线方案取代。
- `tokens.css` 里 `font-weight: 500` 正上方写着「Display is the editorial voice: light, never bold」。

## 与本文件相关的旧记录

`memory/2026-09-18-design-system-practice-workbook.md` 描述的是**已废弃的 v1**（柔光球、胶囊、衬线标题），它关于"先读 DESIGN.md"的忠告仍然成立，但其中的设计细节不要再引用。
