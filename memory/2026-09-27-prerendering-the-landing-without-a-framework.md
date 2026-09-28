---
date: "2026-09-27"
category: "decision"
tags: ["prerender", "ssr", "react19", "vite", "i18n", "hreflang", "hydration", "seo"]
summary: "落地页预渲染：不用框架，Vite 自带 SSR 构建 + React 19 的 prerenderToNodeStream；语言进 URL；交互件客户端渲染；createRoot 会清空预渲染内容，必须 hydrateRoot；产物由 CI 断言"
---

## 决定与数据

Bing 报「缺少 h1」是那根压死骆驼的稻草：Bingbot 抓到 `HTTP 200 · 5781 bytes`，`<body>` 里只有 42 个字符（`<div id="root"></div>`）、`<h1>` 0 个。不执行 JS 的爬虫（Bing、Copilot、GPTBot、ClaudeBot、PerplexityBot、百度）看到的就是这个。

选**自研**，理由是可查的数据而不是偏好：vike `0.4.266`（1633 KB / 861 文件，12 个月 315 次发版，还要 `react-streaming`）、vite-react-ssg `0.9.2`（108 KB，单页可用 `vite-react-ssg/single-page` 不需要 router）。落地页是**单页、无路由、无数据获取**，且用 Tailwind（构建期抽 CSS、无 CSS-in-JS）—— 框架的路由/数据/样式抽取三个卖点全都用不上；而真正的工作量（**语言进 URL** + hreflang + hydration 一致）三个方案都得自己写。官方 API 已经齐全：`react-dom/static` 暴露 `prerender` / `prerenderToNodeStream`，`react-dom/client` 有 `hydrateRoot`，Vite 自带 `vite build --ssr`。**新增依赖 0**。

实际形状（`apps/landing`）：

```
tsc -b && vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr
       && node scripts/prerender.mjs && rm -rf dist-ssr
```

`entry-server.tsx` 导出 `render(locale)`（`changeLanguage` 后 `prerenderToNodeStream`），`scripts/prerender.mjs` 把结果填进模板的 `#root`，并按语言改写 `lang` / title / description / OG / canonical + 注入三条 hreflang。

## 五个非显然的坑

1. **`createRoot` 会清空预渲染进去的内容**。必须换 `hydrateRoot`，否则预渲染白做：React 把 `#root` 抹掉重建，LCP 元素闪一下再出现。这是整件事的前提，不是选项。
2. **语言必须进 URL，否则 hydration 必然对不上**。预渲染的是英文，客户端按 `navigator` 选中文 → mismatch。`/` 永远英文、`/zh` 永远中文之后，服务器和浏览器渲染同一棵树；`navigator` 只用来「首次访问时要不要跳一次」，而且只从 `/` 往 `/zh` 跳、不往回弹，已选过语言就不跳。这一改同时把 hreflang 需要的东西做好了 —— 两件事是同一个改动。
3. **交互组件不进预渲染**。读 query string / 画布尺寸 / 音频时钟的东西（卷轴、二维图、声音自检）留给挂载后渲染：预渲染的 HTML 里只留内容，hydration 就没有可对不上的东西。代价是它们的位置要预留高度，否则手机上挂载时会把下面的内容推下去。
4. **`prerenderToNodeStream` 分块吐字节**：多字节字符会跨 chunk，逐块 `toString()` 会吐出替换字符 —— 收集 `Buffer` 再 `Buffer.concat().toString('utf8')`。
5. **Vercel 里不带尾斜杠才是不过重定向的形式**：`/zh/` 会被 308 到 `/zh`，所以 canonical / hreflang / sitemap 都要写 `/zh`，别把 canonical 指到一个重定向上。

## 服务端安全（不改就是白屏或崩溃）

- `createI18n` 的 `LanguageDetector` 只在 `typeof window !== 'undefined' && !lng` 时挂：它读 localStorage/navigator。给了 `lng` 就完全不挂。
- `languageChanged` 里写 `document.documentElement.lang` 要 `typeof document` 守卫；写进去的是 `zh-CN` 而不是资源键 `zh`，否则 hydrate 之后的文档与服务器发的那份 `lang` 不一致。
- `prefs.ts` 模块顶层的 `const shared = read()` 读 `document.cookie` —— 服务端直接炸。`read()` 开头加 `typeof document === 'undefined'` 返回 `{}`。
- zustand 的 `persist` 在服务端是安全的（`createJSONStorage` 会 catch 掉 `localStorage` 不存在的异常）。
- 落点：这个仓库真正需要加的守卫只有三处（`App.tsx` 里读 `window.location.search`、i18n 的 `lang`、prefs 的 cookie），其余浏览器 API 都在事件回调或 effect 里。

## 怎么验（浏览器里看不出来）

预渲染和客户端渲染的**最终 DOM 一模一样**，所以浏览器骗得了你，只有构建产物和 CI 骗不了：

- `apps/landing/scripts/check-prerender.mjs`（挂在 CI `Web checks (landing)`、`pnpm build` 之后）：断言 `<h1>` 有文案且等于 tagline、`#root` 非空、`lang`、canonical、三条 hreflang、两份文档不同、模板 meta 与英文 JSON 一致。剥掉预渲染即失败。
- hydration 是否干净：本地起静态服务器（服务 `dist`）并在 HTML 里注入探针，捕 `console.error` / `onerror` / `unhandledrejection`，2.5 秒后把「h1 文本、`document.documentElement.lang`、交互件节点数（`[role=group]` / canvas / svg）、错误数」写进隐藏的 `<pre id="RESULT">`，然后用 Windows Chrome headless `--dump-dom` 读。**交互件节点数是最有说服力的一条**：它出现说明 effect 跑过、hydration 成功；错误数为 0 说明没有 mismatch。想测英文文档又不被首次访问跳转干扰，就请求 `/index.html` 而不是 `/`。

## 遗留

批次 3（内容页）还没做：预渲染只是让内容**可被读到**的前提，本身不带来排名。`ear training` 这类通用词要靠专题页去争。
