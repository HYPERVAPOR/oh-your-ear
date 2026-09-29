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

## 「上线几小时，GSC 里 0 次点击」怎么读

不要把这个数字当成对 SEO 工作的判决 —— 它描述的是**这段时间里站点是什么**。本仓库的时间线（实测记录）：

| 时刻 | 状态 |
| --- | --- |
| 2026-09-27 18:23 之前 | 落地页对爬虫是 **42 字节、0 个 `<h1>`** 的空文档（JS 才渲染内容）。这段时间的可索引内容 = 0，点击的期望值**本来就是 0** |
| 2026-09-27 18:23 | 批次 1：URL 唯一、缓存分层、app 去索引、结构化数据 |
| 2026-09-28 22:10 | 批次 2：**落地页第一次成为有正文的文档**（Bingbot 拿到 11839 字节 + 1 个 `<h1>`） |
| 2026-09-29 00:09 | 批次 3：`/learn` 管线（1 篇样例 + 索引页，在闸门内） |
| 2026-09-29 21:45 | 用户看 GSC：0 次点击 —— 距「落地页变成文档」不到 **24 小时** |

这 24 小时里可以索引的页面**只有 2 个**（`/` 与 `/zh`），而且都是品牌名页面。没有人搜「oh you ear」这个词，所以非品牌词的排名面是 0。

**该看的数是曝光（impressions）与「已编入索引」的 URL 数，不是点击。** 有曝光没点击 = 排得太靠后；零曝光 = 还没进池子。

### 两个容易看错的地方

- **别读 app 那个资源的数字**：`app.ohyourear.com` 是**故意** `X-Robots-Tag: noindex, nofollow` 的（应用要登录、内容对搜索无意义），在它身上永远是 0 点击。要看的是 `ohyourear.com`。
- **性能报告最近几天的数据本身是不完整的**（覆盖率的「已发现 / 已编入索引」也有几天滞后）。刚发布的改动不可能反映在当天的数字里。

### 这个品类的对手（2026-09 实测搜索结果）

`useyourear.com`、`earmaster.com`、`perfectear.app`、`tonedear.com`、`myeartraining`（应用商店）、`et-eartrainer.com` —— 都是多年老站，带应用商店页面与外链。新站无外链，非品牌词要出现在结果里通常以**周**计。要加速只有两条路：**内容量**（9 篇是起步，吃到长尾要几十篇）与**外链**。技术面（可抓取、canonical、hreflang、预渲染、sitemap）已经做到没有可省的了 —— 剩下的不是技术活。
