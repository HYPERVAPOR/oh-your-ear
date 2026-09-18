---
date: "2026-09-18"
category: "bugfix"
tags: ["gin", "middleware", "jwt", "oapi-codegen", "openapi", "json-marshal"]
summary: "两个静默失效的认证陷阱：Gin 的 engine.Use() 对已注册路由无效（/auth/me 永远 401）；oapi-codegen 的 openapi_types.Email 零值 marshal 报错让 /auth/refresh 返回体炸掉。"
---

# 两个静默失效的认证陷阱（Gin 中间件顺序 + openapi_types.Email）

## 背景

实现 M7.1 邮箱验证码登录、补齐 M7.3 受保护路由时，发现 `/auth/me` 和 `/auth/refresh` 其实一直是坏的：前者永远 401，后者状态码 200 但响应体 panic。

## 经过

### 陷阱一：`r.Use()` 写在路由注册之后

`cmd/server/main.go` 里原本是这样：

```go
api.RegisterHandlersWithOptions(r, server, api.GinServerOptions{BaseURL: "/api/v1"})
// ...
// Apply JWT middleware to generated /auth/me and future protected routes.
r.Use(middleware.AuthMiddleware(cfg.JWTSecret))
```

看起来"给后面所有路由挂中间件"，实际什么都没做。Gin 在注册路由时就把 handler chain 固定下来了，`engine.Use()` 只影响之后注册的路由，而 oapi-codegen 生成的路由全部注册在它之前。

更坑的是：如果把 `r.Use()` 挪到生成路由之前，`/auth/login`、`/auth/register` 这些公开路由也会被一起保护 —— 因为生成器只提供全局中间件，没有 per-route 选项。

日志里的表现是 `/auth/me` 一直 401，前端"已登录"状态永远恢复不了。

### 陷阱二：`openapi_types.Email` 零值 marshal 直接报错

`/auth/refresh` 的日志：

```
Error #01: json: error calling MarshalJSON for type types.Email: email: failed to pass regex validation
[GIN] 200 | POST "/api/v1/auth/refresh"
```

原因是刷新接口复用了 `api.AuthResponse`（契约里 `user` 是 required），但没有填 `User` 字段：

```go
accessTTL, _ := ... // 只有 access token，没有 user
c.JSON(http.StatusOK, api.AuthResponse{AccessToken: accessToken})
```

`UserResponse.Email` 是 `openapi_types.Email`，它的 `MarshalJSON` 会做邮箱格式校验，空字符串过不了 → marshal 失败 → gin 捕获 panic，返回体不是合法 JSON。状态码还是 200，所以前端 `!res.ok` 判断不出来，只能读到 `data.accessToken === undefined`。

顺带发现前端读的是 `data.access_token`（snake_case），而 Go 侧 json tag 是 `accessToken`，两边都错，session 恢复从来没有真正工作过。

## 结论

1. Gin 中间件改成**在受保护 handler 内部显式调用**，不再依赖 engine 级 `Use()`：

```go
// middleware/auth.go
// Auth 校验 access token，自己写 401，返回是否放行
func Auth(c *gin.Context, secret string) bool { ... }

// handlers.go
func (s *Server) GetMe(c *gin.Context) {
	if !middleware.Auth(c, s.cfg.JWTSecret) {
		return
	}
	...
}
```

2. 刷新接口不再借 `AuthResponse`，改为返回最小体 `gin.H{"accessToken": accessToken}`，前端同步改成 `data.accessToken`。

3. OAuth CSRF state 和 `FRONTEND_URL` 一并补上，回跳不再硬编码 `http://localhost:5173`。

## 原因

- Gin 的路由表在注册时就冻结了 handler chain，`Use()` 不是"全局钩子"，只是"之后注册的路由的默认链"。
- oapi-codegen 生成的结构体字段有校验型 `MarshalJSON`，**部分填充的响应体不是"少个字段"，而是直接报错**。契约里标了 required 的字段，返回时必须真的有值。
- 这两个都是类型检查/编译期查不出来的错：第一个表现为权限问题，第二个表现为"状态码 200 但 body 是空的"，必须靠实际请求 + 看日志才能发现。

## 参考

- `apps/api/internal/middleware/auth.go`：`Auth(c, secret) bool`
- `apps/api/internal/api/handlers.go`：`GetMe` / `RespondWithSession`
- `apps/api/cmd/server/main.go`：refresh handler
- 验证命令：`curl -s -c jar -X POST localhost:8080/api/v1/auth/refresh`
