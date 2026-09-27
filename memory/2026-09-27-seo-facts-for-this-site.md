---
date: "2026-09-27"
category: "lesson"
tags: ["seo", "vercel", "robots", "caching", "structured-data", "baidu", "prerender"]
summary: "两个站点的 SEO 事实：llms.txt 被 Google 忽略、robots 挡爬取时 noindex 读不到、sitemap 的 lastmod 宁可不写、Vercel headers 的负向断言必须包进捕获组、入口文档用 no-cache 而非 no-store、40KB 等宽字体的 preload 是对的"
---

## 官方立场（Google《Optimizing your website for generative AI features》，页面标注 2026-07-10）

- **`llms.txt` 被 Google 忽略**：原文「Google Search itself doesn't use them. It doesn't mean the file is treated in a special way — Google Search ignores them」。保留给其他 AI 客户端可以，**但不要当 SEO 手段**。
- 不需要为 AI 切块、不需要为 AI 改写文案、不需要「AI 专用 markup」；结构化数据「isn't required for generative AI search」，它只影响 rich result 资格。
- 「server-side or pre-rendering is still a great idea because it makes your website faster for users and crawlers, **and not all bots can run JavaScript**」—— 我们做预渲染的官方依据。
- 站点必须**先进入 Search Console 的「生成式 AI 性能报告」**，才可能出现在 AI 概览 / AI 模式里。

## 去索引：`Disallow` 与 `noindex` 会互相抵消

`robots.txt` 的 `Disallow: /` 让爬虫**根本不发请求**（官方：「Googlebot skips making an HTTP request to this URL」、「Google Search won't render JavaScript … on blocked pages」），于是页面里的 `<meta name="robots" content="noindex">` 永远读不到 —— 两条一起用等于只有半条。正确姿势：`Disallow` 留着（省抓取预算）**加上**全站响应头 `X-Robots-Tag: noindex, nofollow`（头随直接访问返回）。已经被收录的 URL 只能靠 Search Console 的 Removals。

## sitemap 的 `lastmod` 宁可不写

写死的日期一旦落后于真实改动就会被忽略（我们的写 `2026-09-19`，而落地页最后一次改动是 `2026-09-26`），而且错误是**整个字段**作废。要么由构建注入，要么不写。

## Vercel 的 `headers`/`rewrites` 按 path-to-regexp 解析

- 负向先行断言必须**包进捕获组**：`/((?!assets/).*)`；裸写法（`/(?!maintenance)`）只在 `routes` 里成立。Vercel 自己的报错文档也点名「normal RegExp syntax like negative lookaheads without following path-to-regexp's syntax」是常见错误。
- 部署前可以离线验：`npm i path-to-regexp@6`，然后 `match('/assets/(.*)')` 打一批真实路径（`/`、`/login`、`/assets/x.js`、`/api/v1/me`…）确认规则互不重叠。失败模式是**静默不匹配**（头没加上），不会把站点弄挂 —— 所以必须验，不能靠「应该是这样」。

## 缓存头：入口文档用 `no-cache`，不用 `no-store`

`no-store` 会把页面**踢出 bfcache**，前进/后退都要重新下载；`no-cache`（每次回源确认）同样不会陈旧，还保住 bfcache。带内容 hash 的 `/assets/*` 反过来给 `max-age=31536000, immutable`。线上实测两者此前都被 Vercel 默认的 `public, max-age=0, must-revalidate` 覆盖，等于浪费了 hash 命名。

## 两个别乱动的实测结论

- **40KB 的 `jetbrains-mono-latin.woff2` preload 是对的**：`--font-sans` 就是 JetBrains Mono（h1 也用 `--font-display` = 同一个字族），它不是装饰性字体，别当成「无用 preload」删掉。
- **交互组件没必要拆包**：三个一起改 `React.lazy` 只省 9.07KB gzip（100.45 → 91.38），而最大的一块是首屏并排显示的卷轴，拆出去会在首屏弹入。等预渲染（dev-plan 18.4）一并解决。

## 中文市场

ICP 备案**不是**排名的必要条件（它只是「在大陆境内托管」的法律要求）；真门槛是从大陆访问的速度（百度把慢站判为低质量），以及百度对 JS 渲染的支持远弱于 Google —— 所以预渲染对百度是**必需**而非优化。

## 相关

- dev-plan M39（批次 1）、M18 / 18.4（预渲染仍是待办）
- PRD 7.5 搜索与分享元数据
