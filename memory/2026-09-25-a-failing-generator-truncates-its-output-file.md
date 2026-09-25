---
date: "2026-09-25"
category: "lesson"
tags: ["tooling", "openapi", "codegen", "shell"]
summary: "生成命令用 `>` 直写产物：失败时 shell 先清空文件，于是「生成失败」表现为目标文件变成 0 字节；先跑会校验的那一侧（openapi-typescript 报出重复键），脚本改成先写临时文件再 mv"
---

## 背景

给 `openapi.yaml` 加一个新的路径与 schema，然后按 CI 的方式跑两个生成：

```
pnpm --filter @oh-your-ear/web run generate    # openapi-typescript → src/api/schema.d.ts
pnpm --filter @oh-your-ear/api run generate    # oapi-codegen → internal/api/generated.go
```

## 经过

手改 YAML 时把 `SetPasswordRequest.newPassword` 后面的 `description` / `example` 留在了新 schema 里，于是出现了**重复键**。两个生成都失败，但失败的样子完全不同：

- 前端那侧直接报 `YamlParseError: duplicated mapping key (688:11)`，并打印出错的行 —— 一眼就知道问题在哪。
- 后端那侧的命令是 `go run … > internal/api/generated.go`：**shell 在命令跑起来之前就把文件截断了**，所以“生成失败”表现为 `generated.go` 变成 **0 行**（1111 行的文件），而报错信息里没有任何指向 YAML 的线索。`git status` 显示它被修改，`git diff` 是一整篇删除。

也就是说：真正的原因在前端那侧早就报清楚了，而后端只留下一片废墟。

## 教训

1. **改完 openapi 先跑会校验的那一侧**（`openapi-typescript` 走 redocly，会做结构校验并指出行号），再跑只负责生成的那一侧。顺序反了就要靠猜。
2. **`>` 直写产物的生成命令，失败 = 产物被清空**。看到生成物变成 0 字节，先想到这一点，`git checkout -- <file>` 恢复，再去看真正的报错。
3. 已经改掉这个陷阱：`apps/api/package.json` 的 `generate` 现在写 `generated.go.tmp` 再 `mv`，失败只留下一个临时文件，产物原封不动。
