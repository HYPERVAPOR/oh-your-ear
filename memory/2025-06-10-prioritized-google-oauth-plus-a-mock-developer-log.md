---
date: "2025-06-10"
category: "decision"
tags: []
summary: "Prioritized Google OAuth plus a mock developer login over email verification for the first auth milestone."
---

---
date: "2025-06-10"
category: "decision"
tags: ["auth", "oauth", "mock", "roadmap"]
summary: "Prioritized Google OAuth plus a mock developer login over email verification for the first auth milestone."
---

# Next feature choice: Google OAuth + mock login

## 背景

完成 M1–M6 后，下一步原本计划是 M7.1 邮箱验证码登录，以解锁 M8–M10 的登录后功能。但开发过程中需要一种无需真实第三方凭证即可快速验证登录态的方式。

## 经过

用户决定先实现 Google 登录，并同时增加一个代表开发者自己的 mock 测试用户，用于本地和无凭证环境下测试已登录功能。为此创建了 GitHub Issue #17 和分支 `feature/17-google-oauth-and-mock-login`。

后端完成了 `users` 表迁移、JWT helper、Google OAuth helper、`AuthService`、真实 Bearer JWT 中间件，以及 `/auth/google`、`/auth/google/callback`、`/auth/mock`、`/auth/refresh`、`/auth/me`、`/auth/logout` 等路由。前端完成了 auth store、API client 自动附加 token、i18n 文案以及 `App.tsx` 的登录/登出入口。

## 结论

将 M7 的首次交付范围调整为 **Google OAuth 登录 + mock 开发者登录**，邮箱验证码登录延后处理。

## 原因

- 更快地获得可工作的登录态，便于并行开发 M8–M10。
- Mock 用户让 CI/本地测试无需真实 Google 凭据即可覆盖登录流程。
- Google OAuth 是用户明确偏好的登录方式，符合实际使用场景。

## 参考

- `docs/dev-plan.md`
- GitHub Issue #17
- Branch `feature/17-google-oauth-and-mock-login`
- `apps/api/internal/auth/jwt.go`
- `apps/api/internal/auth/oauth.go`
- `apps/api/internal/services/auth.go`
- `apps/web/src/stores/auth-store.ts`
- `apps/web/src/App.tsx`
