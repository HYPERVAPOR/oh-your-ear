---
date: "2026-09-26"
category: "lesson"
tags: ["testing", "node:test", "paths", "aliases", "vite", "tsconfig"]
summary: "web 包的单元测试是 `node --test src/lib/*.test.ts` 直接跑 TS，没有 Vite 的路径别名：被测试的 lib 文件内部只要 import 了 `@/...`，测试就 ERR_MODULE_NOT_FOUND。lib 之间用相对路径（带 .ts）。"
---

# 被测试的 lib 不能在内部用 `@/` 别名

## 背景

给「每日练习」新加的 `apps/web/src/lib/daily.ts` 里写了一句 `import { shuffle } from '@/lib/utils'`
（跟仓库里其它地方一致），配套的 `daily.test.ts` 立刻炸：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib' imported from
  /home/hv/projs/oh-your-ear/apps/web/src/lib/daily.ts
```

`check:i18n`、`typecheck`、`build` 全绿 —— **只有测试跑不过**，因为：

- 测试脚本是 `node --test src/lib/*.test.ts`（Node 24 直接 strip types 跑 `.ts`），走的是
  Node 的模块解析；
- `@/*` 是 Vite/tsconfig 里的别名，Node 不认。

已有的 `heatmap.test.ts` 之所以没事，是因为 `heatmap.ts` 谁也没 import。

## 处理

被测试的 lib，在 lib 内部导入兄弟模块时用**相对路径 + `.ts` 后缀**（仓库里
`heatmap.test.ts` 就是这么 import 的，`allowImportingTsExtensions` 已开）：

```ts
// apps/web/src/lib/daily.ts
import { shuffle } from './utils.ts'
```

类型导入可以照旧 `import type { X } from '@/components/...'` —— `import type` 会被擦掉，
运行时不会去解析它。

## 判据

- 只要一个 lib 可能被 `node --test` 覆盖，就**别在它内部用 `@/`**（对该 lib 内部 import 而言）。
- 加完测试先单独跑一次 `node --test src/lib/<name>.test.ts`，不要只信 `typecheck`。
