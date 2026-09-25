---
date: "2026-09-25"
category: "tooling"
tags: ["vercel", "ci", "review", "quota"]
summary: "每次 push 到 PR 都会部署两个 Vercel 项目；一天几十次小提交会把部署配额烧光，而预览链接正是视觉改动的评审入口"
---

# Deployment rate limited — retry in 24 hours

一个交互改动（退出登录加二次确认）的 PR，GitHub 的检查全绿，但两个 Vercel 项目**都挂了**：

```
Vercel – oye-app:      failure  Deployment rate limited — retry in 24 hours.
Vercel – oye-landing:  failure  Deployment rate limited — retry in 24 hours.
```

不是代码问题：同一轮 `Web checks (web)` 和 `Web checks (landing)` 都跑过 `pnpm build` 并且通过。是**部署配额**用光了。

## 为什么会用光

这个仓库有两个 Vercel 项目（landing 一个、app 一个），都从 `main` 自动部署。**每往 PR 分支 push 一次，两个项目各部署一次。** 而今天这种节奏——改一点、跑检查、提交、推送，来回几十轮——等于几十次 push，也就是上百次部署。

## 为什么这件事值得在意

**预览链接是视觉改动的评审入口。** 这一整套流程里，"等你看过预览再合"是好几次的收尾动作；而顶栏、登录页、邮件模板这类改动，用户确实需要看到才算数。配额烧光之后：

- 预览没了 —— 但**本地栈跑的是同一份代码**（工作区就在那个分支上），所以评审可以退到 `localhost:5173`。这不是等价的（手机尺寸、真实部署环境、两个站点之间的跳转都没了），但足以判断"这个改动是不是我想要的样子"。
- **production 部署也会被限**：合并本身没问题，但线上要等 24 小时才会重新部署。所以"合了"和"线上了"在这段时间里是两件事。

## 做法

- **攒着推**：一个分支上把一组改动做完再 push，而不是每改一处推一次（今天的推送里有一半是"修自己上一轮的小错"）。
- 需要预览时，把分支做成 **draft PR** 再一次性推 —— hmm，draft 不减少部署次数；真正省的是 push 次数。
- 用本地栈做**过程中**的检查（DOM 度量、截图、真实接口），把预览留给"最后一次确认"。
- 本地跑检查 = 免费；push = 有成本。`pnpm typecheck / lint / check:i18n / format:check / build / test` 全部可以在本地跑完再决定要不要推。

## 下次

改完先本地跑全套检查再 push；一轮里攒够再推。看到 Vercel 报 `rate limited` 时，先分清"是配额还是构建失败" —— 看同一个 commit 上 `Web checks` 的构建结果，再决定是等 24 小时还是去查代码。
