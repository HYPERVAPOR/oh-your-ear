---
date: "2025-05-16"
category: "decision"
tags: ["api", "openapi", "go", "typescript", "contract"]
summary: "前后端采用 OpenAPI 3.0 作为唯一契约，oapi-codegen 生成 Go 接口，openapi-typescript + openapi-fetch 生成 TS 客户端。"
---

# 前后端 API 契约采用 OpenAPI

## 背景

团队需要一种机制保证前后端对 REST API 的字段、类型、路径保持一致，避免「口头约定」导致运行时错误。

## 经过

考虑过三种方案：

1. **OpenAPI + 代码生成**：先写 `openapi.yaml`，后端用 `oapi-codegen`，前端用 `openapi-typescript`/`openapi-fetch`
2. **tRPC**：仅适合全 TypeScript 栈，Go 后端支持差
3. **Protobuf / gRPC**：契约更严格，但浏览器端需要 gRPC-Web 或 Connect，增加复杂度

## 结论

采用方案 1：OpenAPI 3.0 + REST/JSON。

- 唯一事实来源：`openapi.yaml`
- 后端生成：Gin server 接口、request/response struct
- 前端生成：TypeScript 类型 + 类型安全的 fetch 客户端
- CI 漂移检查：重新生成代码后 `git diff --exit-code`

## 原因

- Web 应用最自然，浏览器原生支持 JSON over HTTP
- 工具链成熟，生成代码质量可靠
- 比 proto/gRPC 工具链轻，适合当前项目规模
- TypeScript 编译器和 Go 编译器会在契约不一致时直接报错

## 参考

- `openapi.yaml`
- `apps/api/internal/api/generated.go`
- `apps/web/src/api/schema.d.ts`
- `apps/web/src/api/client.ts`
- `.github/workflows/ci.yml` `openapi-drift` job
