---
date: "2026-09-19"
category: "bugfix"
tags: []
summary: "上报不存在的关卡因外键违约返回 500，改为先预检查存在性返回 404"
---

## 背景

`POST /api/v1/me/levels/{id}` 用于按 slug 上报关卡成绩。`level_progress.level_id` 是指向 `levels(slug)` 的外键。

## 经过

用 `curl -X POST .../me/levels/nope-99` 测试时不存在的关卡时，接口返回 **500** 而不是 404——因为请求直达 `RecordLevelResult`，插入 `level_progress` 时触发外键违约（FK violation），错误被统一吞成 500。

实际上 `LevelModule` service 方法早已写好，本意就是做前置检查，但当初没有接到 handler 上（写了没用）。

## 结论

在 handler 里、调用 `RecordLevelResult` 之前先预检查：

```go
// Check the level exists first: the foreign key would otherwise turn a typo into
// a 500.
module, found, err := s.practice.LevelModule(c.Request.Context(), id)
if err != nil {
	c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "failed to look up level"})
	return
}
if !found {
	c.JSON(http.StatusNotFound, ErrorResponse{Error: "level not found"})
	return
}
if ExerciseKind(module) != body.Module {
	c.JSON(http.StatusBadRequest, ErrorResponse{Error: "level does not belong to that module"})
	return
}
```

验证通过：不存在的关卡 → 404；关卡存在但 module 不匹配 → 400。`go build` / `go vet` / `go test ./...` 全绿。

## 原因

- 把「依赖数据库报错兜底」换成「先查再写」，让客户端拿到语义正确的状态码（404 / 400），而不是一律 500。
- 顺带补上 module 一致性校验，防止用任意 module 上报到别的关卡。

## 参考

- 文件：`apps/api/internal/api/practice_handlers.go`
- 验证：`POST /api/v1/me/levels/nope-99` → 404；`POST /api/v1/me/levels/singleNote-1` 配 `module: interval` → 400
