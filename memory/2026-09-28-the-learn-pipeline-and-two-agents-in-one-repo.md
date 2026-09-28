---
date: "2026-09-28"
category: "decision"
tags: ["seo", "content", "markdown", "prerender", "i18n", "github-pages", "coordination"]
summary: "教程区管线：markdown 只在构建期渲染（marked 是 devDependency）、内容页靠页面里的 JSON props hydrate、i18n 是单例所以渲染必须串行；以及两个 agent 共用一个仓库时要怎么不互相踩"
---

## 为什么是「构建期 markdown + 页面里带 JSON」

教程区（`/learn`）的 18 个文件是 markdown，但**浏览器永远不解析 markdown**：

1. `scripts/learn.mjs` 在构建期读 `content/learn/*.md`（frontmatter 三个平铺键用十行手写解析，不值得为它买一个 YAML 依赖），用 `marked` 转 HTML；`marked` 是 **devDependency**，不进任何产物。
2. `prerender.mjs` 把结果喂给 `renderPage()`（React 19 的 `prerenderToNodeStream`），渲染进第二个 Vite 入口 `learn.html` 的外壳。
3. 页面里同时写入 `<script id="oye-page" type="application/json">` —— 客户端 `learn-main.tsx` 从它读回 props 再 `hydrateRoot`。**预渲染的页面必须能重新拿到 props，否则 hydrate 不出同一棵树**：markdown 是构建期的事，所以 props 得随页面一起走。JSON 里要把 `<` 转义成 `\u003c`，否则内容里出现 `</script>` 就闭合了标签。

## 三个容易踩的实现细节

- **i18next 是单例**：一个进程里渲染多语言页面必须**串行**（每页 `changeLanguage` 之后才能渲染），所以那一处 `await` 是刻意的，其余读取全部并行。lint 的 `no-await-in-loop` 会报，注释里写明理由再 `oxlint-disable-next-line`。
- **`META` 和 `OG` 要分开**：把 title/description 和 og:locale 打成一个对象展开到页面对象上，会**静默覆盖**文章自己的 title（我先写错了一次，靠产物里的 `<title>` 才发现）。页面对象里谁写 title 只能有一处。
- **`<title>` 里的品牌后缀由管线追加**（`title | Oh Your Ear`）：作者只管写自己的标题，18 篇不会各写一个样。

## 教程区的两道闸门

- 索引页的列表由管线从**已存在的文件**生成（不是从冻结清单生成），所以索引页永不指向未写的文章。
- 9 篇（索引 + 8 篇）双语齐备前，整块区域**不进 sitemap、不从首页链接**；CI 直接断言 sitemap 条数。这样「链接白名单允许指向计划内但尚未写完的文章」不会变成用户可点的 404。
- 索引文件缺失时该语言整个区块不构建（**不是**构建失败）：管线先落地、内容后到也能跑通。

## 从这条线上学到的协作规则

两个 agent 在同一个仓库上干活时：

- **共用工作树 = 危险**。`git worktree list` 只有一条时，A 切分支会把 B 的未跟踪文件带过去，`git add .` 会把 B 的半成品提交进去。搬到独立 worktree（`herdr worktree`）之后，各自的分支互不相干。
- **未提交的成果等于没有**。124KB 散文曾经只以未跟踪文件形态存在一个临时 worktree 里，被清理就没了。所以「等管线合了再提交」这种约定要改成「**先在自己的分支上提交，不 push、不提 PR**」。
- **对方读的是工作区，不是线上**。隔壁 agent 拿工作区里的 `vercel.json`（含我当天加、尚未部署的重定向）去解释线上行为，于是把「没部署」误诊成「Vercel 规则被静态文件抢先」。跨 agent 交接时要指明「这个文件在哪条分支、部署了没有」。
