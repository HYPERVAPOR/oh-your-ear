---
date: "2026-09-19"
category: "lesson"
tags: ["cookies", "cross-origin", "chrome", "dev-environment", "monorepo", "verification"]
summary: "跨站点共享语言/主题：只能写一份父域 cookie（host-only 那份更具体、读在前，会让一侧忽略对侧的修改）；Chrome 拒绝 Domain=localhost，且 Windows Chrome 连不上 WSL IP 的新端口 —— 本机验证要用 --host-resolver-rules + 同一 profile。"
---

# 跨站点偏好 cookie 的三个坑

背景：前端拆成 landing（`xxx.xxx`）与 app（`app.xxx.xxx`）两个站点后，语言和主题要跨站点跟随（PRD 7.1.2）。实现在 `packages/shared/src/prefs.ts`。

## 坑 1：host-only 副本会"赢"过共享副本

最初的写法是**同时写两份**：一份 host-only（本域），一份 `Domain=.example.com`（共享）。

结果（实测）：在 app 侧写了 `dark/en`，landing 读到 `dark/en` ✓，landing 改成 `light/zh-CN` ✓，**但 app 再读还是 `dark/en`** ✗。

原因：`document.cookie` 里同名 cookie 按**具体程度**排序，host-only 的排在前面，读取时先命中它。于是"另一侧改过"的偏好被本侧那份陈旧副本挡掉。没有任何时间戳能判断谁更新，所以正确解法是**只存在一份**：

```ts
// 有共享域就只写共享那份；浏览器拒绝共享域（localhost）时才回退 host-only
document.cookie = `${COOKIE}=${value}; path=/; domain=${domain}${maxAge}`
if (!document.cookie.includes(`${COOKIE}=${value}`)) {
  document.cookie = `${COOKIE}=${value}; path=/${maxAge}`   // 回退
}
```

## 坑 2：Chrome 拒绝 `Domain=localhost`

`document.cookie = 'x=1; Domain=localhost'` 在 Chrome 里**被静默丢弃**（它把 `localhost` 当顶层名字）。所以 dev 下两个站点各存一份，跨站共享在生产域名上才生效。要本机验证这条路径，用生产形状的域名：

```
chrome --host-resolver-rules="MAP oye.test <WSL_IP>, MAP *.oye.test <WSL_IP>"
```

注意两点：
- `MAP *.oye.test <ip>` **不匹配裸域** `oye.test`，必须再写一条 `MAP oye.test <ip>`，否则裸域那侧是 DNS 失败（页面标题会显示成主机名，看起来像"页面没渲染"）。
- Vite 需要 `server.allowedHosts: ['localhost', '.oye.test']`，否则新主机名被拒。

## 坑 3：WSL + Windows Chrome 的端口可达性不一致

- Windows Chrome **连不上 `127.0.0.1:5173`**（WSL 的 localhost 转发只认 `localhost` 这个名字）。
- 用 `--host-resolver-rules` 映射到 WSL IP 后，**只有部分端口通**：5173 通，新起的 5174 / 8080 被 Windows 防火墙挡住。改端口的办法也不稳。
- **可靠做法**：让目标站点用**已经放行的端口**（例如 5173）访问，靠**不同的 Host 头**区分 origin。cookie 的作用域看主机名不看端口，所以 `app.oye.test:5173` 与 `oye.test:5173` 就是两个真正不同的 origin，跨站验证成立。
- 另一个必要细节：**跨站验证必须用同一个 `--user-data-dir`**。每次探针换 profile = 换 cookie jar，看起来"读不到"，其实是自己把实验做坏了。

## 已验证的完整链路

同一浏览器，两个 origin：

1. `app.oye.test` 写 `dark/en` → cookie 只有一份（`Domain=.oye.test`）
2. `oye.test`（localStorage 为空）读到 `dark/en` ✓
3. `oye.test` 写 `light/zh-CN`
4. `app.oye.test` 读到 `light/zh-CN` ✓ —— 尽管它自己 localStorage 里还是 `dark/en`：**cookie 优先于本域存储**（zustand persist 的 `merge` 里按这个顺序覆盖）

## 参考

- 实现：`packages/shared/src/prefs.ts`、`packages/shared/src/cookie-domain.ts`（含 `node --test` 用例）
- 相关：`memory/2026-09-18-wsl-headless-verification-via-windows-chrome.md`
