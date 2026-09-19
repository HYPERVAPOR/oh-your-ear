---
date: "2026-09-19"
category: "lesson"
tags: ["postgres", "migrations", "schema", "db"]
summary: "本项目没有迁移版本机制：schema.go 全是 CREATE TABLE IF NOT EXISTS，因此**改动已存在的表**（加列、加约束、改类型）必须写成幂等 DO 块，否则线上库不会变、新代码却以为约束存在。"
---

# 没有迁移工具时，改已有表结构只能用幂等 DO 块

## 背景

题单目录进数据库（M14.4）时，需要给已存在的 `level_progress.level_id` 加外键指向新的 `levels(slug)`。

## 经过

在 `schema.go` 里把 `level_progress` 的定义改成了带外键的版本 —— 但**线上库里什么都没发生**：`CREATE TABLE IF NOT EXISTS` 对已存在的表是空操作。于是表里没有外键，代码却以为有引用完整性（验证时上报不存在的关卡返回的是外键违约 500，说明约束确实不在）。

## 结论

改已有表结构必须写成幂等块，例如：

```sql
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'level_progress_level_id_fkey') THEN
		ALTER TABLE level_progress
			ADD CONSTRAINT level_progress_level_id_fkey
			FOREIGN KEY (level_id) REFERENCES levels(slug) ON DELETE CASCADE;
	END IF;
END $$;
```

加列同理：`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。判断条件写在 `pg_constraint` / `information_schema.columns` 上。

## 原因

- `db.Migrate` 是所有语句顺序执行 + 幂等语句的组合，没有版本表，**没有回滚**，也没有"只跑一次"的语义。
- 这个模式对"新表"够用，对"改表"不够用，而它不会报错 —— 是静默失效，跟本项目踩过的另外几个坑同一类型。

## 参考

- `apps/api/internal/db/schema.go`（外键那段 DO 块就是范例）
- 如果以后要频繁改表，应该引入迁移工具（golang-migrate / goose / atlas）；届时把现有 schema 作为基线迁移。
