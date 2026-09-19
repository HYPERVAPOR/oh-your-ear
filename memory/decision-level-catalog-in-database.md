---
date: "2026-09-19"
category: "decision"
tags: []
summary: "关卡目录从 lib/levels.ts 迁到数据库（level_sets/levels + slug），由公开 API 提供、客户端只留类型与纯逻辑"
---

## 背景

关卡原本硬编码在客户端 `lib/levels.ts`。关卡是需要长期增补与策展的产品内容，不该锁在前端代码里。

## 经过

- 新建 `level_sets` / `levels` 两张表：`config` 用 jsonb，标题支持双语，`slug` 作为稳定 URL/上报标识，另有 `position` 排序。
- 官方目录由 Go 端从数据库做幂等 seed（`db.SeedLevels`），避免手工 SQL。
- 新增公开只读接口 `GET /levels/sets`；登录时附带进度。
- `level_progress.level_id` 改为存关卡 slug（并补上指向 `levels(slug)` 的外键）。
- 客户端改为从 API 拉取目录，自己只保留类型定义与纯决策逻辑（如通关判定）。

## 结论

端到端验证通过（浏览器探针检查 `/levels` 页面）：

```
RESULT: levelLinks=6 first=/exercise/single-note?level=singleNote-1
| text=题单 每个模块一条链，从易到难… 单音基础 单音 白键起步 最好 100% 整个八度 10 题 加入黑键 10 题 …
```

关卡名（白键起步 / 整个八度 / 加入黑键 / 更宽音域）、题量、进度、链接全部来自 API；上报用 slug（`singleNote-1`），进度按 slug 持久化并回显。dev-plan 中 14.4「Level catalog in the database」标记为 🟢 done。

## 原因

- 关卡是产品内容：放进数据库才能增长、策展、支持双语与排序。
- `slug` 而非自增 id，保证 URL 稳定、上报键稳定，便于 seed 幂等。
- 公开读 + 登录附进度，前端无需复制目录数据，只保留类型与纯决策逻辑，避免内容与逻辑纠缠。

## 参考

- 迁移与幂等 seed：`apps/api/internal/db/`（`db.SeedLevels`）
- 接口：`GET /api/v1/levels/sets`（公开），`POST /api/v1/me/levels/{slug}`，`GET /api/v1/me/levels`
- 前端：`apps/web` 的 `/levels` 页从 API 渲染
