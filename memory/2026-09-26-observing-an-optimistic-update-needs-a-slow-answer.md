---
date: "2026-09-26"
category: "verification"
tags: ["browser", "probe", "optimistic-update", "openapi-fetch"]
summary: "要看「乐观更新」，得先让回答变慢：一个只延迟单条路由的本地代理；另外 openapi-fetch 在创建时就抓走了 fetch，探针里改 window.fetch 拦不住它"
---

# 乐观更新看不见，是因为回答太快

给用户名做乐观更新时，要证明的是「请求还没回来，界面已经改了」。本机 API 3ms 就答，那个窗口根本观察不到 —— 探针里量到的永远是「已经改好了」，等于什么也没证明。

## 办法：只延迟一条路由的代理

30 行 Python：监听另一个端口（5180），原样转发到 dev server（5173），只在 `PUT /api/v1/me/name` 上 `sleep(2.5)`。**探针和 app 都从代理端口取**，这样仍然同源（跨端口就不是了），DOM 照样能访问。

结果干净：300ms 时卡片上已经是新名字、输入框已收起，刷新后服务端也真的存了。

## 三个会白折腾的坑

**`openapi-fetch` 创建时就把 `fetch` 抓走了。** `createClient({ baseUrl })` 用当时的全局 fetch，所以探针里事后写 `window.fetch = 桩` **拦不住** app 的请求。我因为这个把「没有请求」读成了「代码走了提前返回」，其实请求发出去了、只是打到一个还不存在的路由上 404 了。要拦就得在模块加载前拦住，而 iframe 换页会换掉整个 realm —— 做不到。结论：想控制响应，改服务端（代理），别改 `window.fetch`。

**React 不认 `input.value = x`。** 得走原型上的 setter 再派发 `input` 事件：
```js
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, text)
input.dispatchEvent(new w.Event('input', { bubbles: true }))
```

**打字和回车别放同一个 tick。** React 的 state 还没落地，`keydown` 里读到的还是旧值，于是代码走了「跟原来一样，不用保存」的提前返回。中间 `await sleep(200)` 就好。

## 顺手暴露的一个真设计问题

原来输入框是**等服务器答完才收起**的。那等于没有乐观：读者看到的只是自己刚敲的字。改成**立刻收起 + 先把新名字显示出来 + 被拒再回滚并给原因** —— 乐观只有看得见才算数。
