---
date: "2026-09-21"
category: "technique"
tags: ["github", "readme", "verification"]
summary: "README 的渲染结果能本地验——用 GitHub 自己的 markdown API；另外表格和列表在 GitHub 上没法真居中"
---

# README 渲染：推之前就能验

改 README 排版时不要靠肉眼猜（推上去、刷新、看，一轮好几分钟，而且 CDN/缓存会骗你）。**GitHub 自己的渲染管线有 API**：

```bash
gh api --method POST /markdown -f text="$(cat README.md)" -f mode=gfm \
  -f context="OWNER/REPO" | tee /tmp/rendered.html
```

返回的就是仓库页会渲染出的 HTML，同样的 sanitizer、同样的 markdown 解析器。`context` 要给，相对路径才会按仓库解析。可以断言的东西：标签有没有被 sanitizer 剥掉、markdown 有没有在 HTML 块里被解析、图片路径是否保留。

## 居中：HTML 块里的 markdown

`sanitizer` 会保留 `<div align="center">`，而**块级 HTML 后面的 markdown 仍会被解析**（HTML 块在空行处结束的前提），同时 HTML 解析器因为 `</div>` 未闭合而把内容留在 div 里 —— 两者叠加就是"居中 + 照常用 markdown"：

```html
<div align="center">

### 标题会被解析成 h3

**粗体也是**

</div>
```

这条假设不成立整页就退化成左对齐加一堆没解析的 `###`，所以值得花一次 API 调用确认，而不是推上去才发现。

## 但表格和列表没法真居中

- `<table>`、`<ul>` 是**块级盒**，`text-align: center` 不会移动它们
- GitHub **剥掉 `style` 属性**，所以 `margin: auto` 这条路也不通

留着它们的下场是：一个居中页面里几块东西固执贴左，比不居中更难看。要整页居中就得换成**一行一段的居中文本**（`**A** — 说明<br />`），扫描体验一样，代价是丢掉表格的列对齐。
