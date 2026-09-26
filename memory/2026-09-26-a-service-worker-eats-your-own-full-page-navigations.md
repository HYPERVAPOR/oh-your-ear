---
date: "2026-09-26"
category: "bugfix"
tags: ["service-worker", "pwa", "vite-plugin-pwa", "workbox", "oauth", "verification", "cache-misdiagnosis", "hard-reload"]
summary: "线上 Google 登录点了落到应用自己的 404 页：vite-plugin-pwa 生成的 Service Worker 注册了无白名单的导航兜底，把 /api/v1/auth/google 与 OAuth 回调这两条整页导航都回成了 index.html。curl 永远看不到它（SW 只存在于浏览器里），dev 也永远看不到它（VitePWA 只在生产构建注册），而 Ctrl+Shift+R 因为绕过 SW 所以「一刷就好」—— 于是它一路被误判成缓存问题。"
---

# Service Worker 会吃掉你自己的整页导航

## 现象

线上 `app.ohyourear.com` 点「Continue with Google」：**立刻**落到应用自己的 404 页（`404` + 「页面不存在」），地址栏停在 `/api/v1/auth/google?next=%2F`。在那个页面上按 Ctrl+Shift+R 就正常跳 Google、能登进去；退出登录后再点，又 404。换浏览器、隐私模式一样，清缓存无效。而 curl 打同一个 URL（带 `Accept: text/html` + `Sec-Fetch-Mode: navigate` + 真实 UA + cookies + 拿 SPA 的 ETag 做条件请求）**永远是 307 跳 Google**。

## 根因

`apps/web` 的 VitePWA 生成的 `sw.js` 里有一条**没有白名单**的导航兜底：

```js
e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))
// 修好后：…,{denylist:[/^\/api\//]}))
```

`NavigationRoute` 接管作用域内**所有 `mode: navigate` 的请求**并回 precache 里的 `index.html`，于是：

- 登录起点 `/api/v1/auth/google` 与 Google 送人回来的 `/api/v1/auth/google/callback` 都是整页导航 → 请求**根本没到 API** → SPA 起来、React Router 找不到路由 → 应用自己的 404 页。所以抓来抓去都是「我们自己的页面」，服务端日志里干干净净。
- `self.skipWaiting()` + `clientsClaim()` 让它装上就接管 → 用户第二次打开页面起必然中招。
- **Ctrl+Shift+R 在 Chrome 里会绕过 Service Worker** → 直连网络 → 307 → 一切正常。「硬刷新就好」本来是判断**缓存**的经典信号，这次却指向 SW。

## 为什么查了这么久

三个「看不见」叠在一起：

1. **curl 里没有 SW。** 服务 Worker 是浏览器内的一个请求层，命令行怎么打都看不到它。前面所有 A/B（浏览器头、cookies、条件请求、Accept-Encoding）都在证明「网络侧没问题」——都没证明对，也都没证明错，只是**问错了层**。
2. **`pnpm dev` 里没有 SW。** VitePWA 默认 `devOptions.enabled: false`，本地开发服务器根本不注册。所以本地测一百遍都是好的（读者也回了「localhost 没这个 bug」——那是预期的，不是对照证据）。
3. **「同一个 URL，普通导航 404 / 硬刷新 307」** 在缓存这一层是自洽的，于是连续两轮都收了「是缓存」的结论（浏览器缓存 → 边缘缓存），直到「换了浏览器 + 隐私模式还是 404」把缓存整个排除掉。

## 规矩

- **症状是「浏览器里不对、curl 里对」时，先问有没有 Service Worker**（用户在 DevTools → Application → Service Workers 里一眼能看；本地用构建产物 + 真实浏览器复现）。别先造缓存理论。
- **VitePWA / 任何 PWA 导航兜底默认什么都不排除**：只要应用里有整页导航到**非应用路径**（OAuth 起点、OAuth 回调、支付回跳、`/api/...` 的下载），就必须给 `workbox.navigateFallbackDenylist` 加白名单。
- **验收要用生产构建**：`pnpm build` 的产物才有 SW 与 manifest。
- 修复后的防复发检查：`apps/web/scripts/check-sw-navigation-fallback.mjs`（CI web-checks，`pnpm run build` 之后）。它把生成的 `sw.js` 与**真实** workbox bundle 载进 node，直接问那条 route「这条导航你接不接」，断言 `/api/...` 判给网络、其余仍走兜底。

## 想在本地验证 SW 时踩到的坑

- `--virtual-time-budget` 下 `navigator.serviceWorker.ready` **不会 resolve**（SW 的安装/激活不推进虚拟时钟）；改成轮询 `navigator.serviceWorker.controller` 或干脆别用虚拟时间。
- **两个 `chrome --user-data-dir=同一个profile --dump-dom` 进程不是两次加载**：第二个会把 URL 转交给第一个然后立刻退出，stdout 是 0 字节。要用同一个 profile 让 SW 生效，就得在两次之间把上一次的进程真正杀干净（PowerShell 按 `CommandLine -like '*<profile>*'` 精准杀，别碰用户自己的 Chrome）。
- 这套 headless 两段式能复现（`id="root"` + 「页面不存在」），但 SW 激活与进程交接会让结果抖动 —— 别拿它当验收，用上面那个确定性检查 + 部署后真点一次。
- 在 node 里跑生成的 `sw.js` 需要的最小 stub：`self`（自指）、`location`（AMD 前导用 `location.href` 解析模块名）、`importScripts`（把 workbox bundle 读进同一 realm）、`caches`/`clients`/`registration`/`addEventListener`/`skipWaiting`。前导的 AMD 加载是 promise 链 → 载完要 `await new Promise(setImmediate)`。`route.match({request, url})` 里 `request` 传 `{ mode: 'navigate' }` 就够（Node 的 `Request` 拒绝 `mode: 'navigate'`）。

## 参考

- dev-plan M35 / issue #196；`apps/web/vite.config.ts`；`docs/tech-spec.md` 的「离线 / PWA」
- 相关：`2026-09-19-verifying-a-live-domain-behind-layers.md`（另一个「中间层骗人」的例子）
