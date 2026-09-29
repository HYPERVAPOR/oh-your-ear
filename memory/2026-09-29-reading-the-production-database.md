---
date: "2026-09-29"
category: "environment"
tags: ["ops", "postgres", "deploy", "privacy"]
summary: "怎么读生产库：ssh 别名 + docker exec + psql；以及为什么这个路径只该用来查、以及别把行数据写进仓库"
---

## 生产库怎么读

`docs/deploy.md` 只写了「`DEPLOY_HOST` 是 GitHub secret」，本机没有文档记录实际地址。实际路径：

```bash
ssh ohyourear                       # 别名在 ~/.ssh/config，密钥 id_ed25519_ohyourear
docker exec oh-your-ear-db-1 psql -U postgres -d ohyourear -P pager=off -c "<只读 SQL>"
```

- 这台是**共享服务器**，前面还有 nginx（`apps/api` 之外别人的容器也在跑：`infra-relay-1`、`infra-postgres-1`）—— **只读、只查自己的容器**，别碰别人。
- 运行时是 `docker`，不是 podman（`compose/deploy.sh` 会按 `command -v` 自动选；这台机器只有 docker）。非交互 ssh 的 PATH 里没有 podman，所以 `ssh ... podman ...` 会报 `command not found`。
- 代码在 `/opt/oh-your-ear`。
- 表：`users`、`practice_records`、`mistakes`、`level_progress`、`level_sets`/`levels`、`collections`/`collection_items`、`study_plans`、`daily_goals`、`user_avatars`、`email_codes`、`revoked_tokens`。
- 快速概览行数：`SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;`

## 两条规矩

1. **不查 `password_hash`**：即使库是自己的，把哈希带进终端/日志没有任何好处（要对一个账号做判断，看 `google_id` / `password_hash` 是否为 NULL 就够了）。
2. **行数据不进仓库**：真实用户邮箱属于个人信息，一次查询的结果留在终端里就行，不写进 `memory/`、不写进 issue、不进提交。仓库是公开的。
