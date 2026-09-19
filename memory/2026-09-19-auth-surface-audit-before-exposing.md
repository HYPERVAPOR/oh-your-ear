---
date: "2026-09-19"
category: "bugfix"
tags: ["security", "auth", "config", "defaults", "deploy", "cookies"]
summary: "把 API 暴露到公网前审查认证面：开发用的 /auth/mock 无条件注册且配置有默认值 → 任何人一个 POST 就能拿到会话；同类问题还有 cookie 的 Secure 硬编码 false。"
---

# 上线前审查认证面：两个"默认值造成的开放面"

## 1. `/auth/mock` 是开放登录门（严重）

部署到公网前逐条过路由，发现 `apps/api/cmd/server/main.go` 里：

```go
r.POST("/api/v1/auth/mock", func(c *gin.Context) {
    user, _ := authSvc.UpsertMockUser(ctx, cfg.MockAuthEmail, cfg.MockAuthName)
    server.RespondWithSession(c, user)      // ← 直接发会话
})
```

而 `config.go` 里 `MockAuthEmail: getEnv("MOCK_AUTH_EMAIL", "dev@ohyourear.test")` —— **有默认值**。

于是任何公网调用者：

```bash
curl -X POST https://api.example.com/api/v1/auth/mock   # → 200 + access token + refresh cookie
```

**最迷惑人的地方**：前端的 mock 按钮确实有保护（`import.meta.env.DEV`），所以生产构建里看不到它 —— 但**按钮藏起来不等于路由不存在**。前端有无入口和后端是否注册，是两条独立的线，审查时必须分开看。

修法（#83 / PR #84）：配置默认值改空，**路由只在显式配置时才注册**。开发用的 compose 里本来就显式设了它，所以本地不受影响。

**通用教训**：任何"只在开发/测试用"的端点，它的开关必须是**显式 opt-in**（不配就没有），而不是"有默认值 + 希望别人记得关"。凡是给"开发便利"配默认值的环境变量，都要问一句：这个默认值泄漏到生产会怎样？

## 2. cookie 的 `Secure` 硬编码 `false`

刷新 cookie 与 OAuth state cookie 的下发都是：

```go
c.SetCookie(name, value, ttl, "/", "", false /* secure */, true /* httpOnly */)
```

HTTPS 部署上应当为 `true`。修法是**从部署自身推导**，不新增配置项：

```go
secure := strings.HasPrefix(cfg.FrontendURL, "https://")
```

好处是本地 http 开发照旧（Secure cookie 在 http 上会被浏览器丢弃，硬开反而会让本地登录坏掉）。

验证：生产登录响应的 `Set-Cookie` 里应出现 `HttpOnly; Secure` ✓

## 上线后固定检查这两条

```bash
curl -o /dev/null -w '%{http_code}\n' -X POST https://api.<domain>/api/v1/auth/mock   # 必须 404
curl -sD - -X POST https://app.<domain>/api/v1/auth/code -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}' | grep -i set-cookie                              # 应含 Secure
```

## 参考

- issue #83、PR #84
- `docs/deploy.md` §10 认证面的防线
