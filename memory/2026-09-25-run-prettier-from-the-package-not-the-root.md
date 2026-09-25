---
date: "2026-09-25"
category: "tooling"
tags: ["prettier", "turbo", "ci", "formatting"]
summary: "根目录没有 .prettierrc，从根跑 pnpm exec prettier 用的是默认 printWidth 80；格式要在包内跑（pnpm run format:write）"
---

# 我明明格式化过，format:check 还是失败

改完登录页跑 `pnpm exec prettier --write apps/web/src/pages/login.tsx`，然后 `pnpm run format:check` —— 失败：

```
@oh-your-ear/web:format:check: [warn] src/pages/login.tsx
@oh-your-ear/web:format:check: [warn] Code style issues found in the above file.
```

**原因：仓库根目录没有 `.prettierrc`。** 从根跑 `pnpm exec prettier` 用的是 Prettier 的默认值（`printWidth: 80`），而 `apps/web/.prettierrc` 写的是 `printWidth: 100`：

```json
{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

于是"格式化"把文件按 80 列重排了一遍（JSX 属性被折成两行），**然后**用 100 列的标准去检查 —— 当然失败。更糟的是它看起来像是"检查错了"，会让人怀疑 check 脚本，而不是怀疑自己跑错命令。

**修法：格式永远走包内的脚本。** 根目录的 `format:write` / `format:check` 是 `turbo run`，turbo 在**每个包自己的目录里**执行，于是各自读到自己的 `.prettierrc`：

```bash
pnpm run format:write    # 不要 pnpm exec prettier --write <file>
pnpm run format:check
```

**下次**：`format:check` 说一个**刚格式化过**的文件有问题，第一个要怀疑的不是检查脚本，而是"我用的格式化器和检查器不是同一个配置"。这类信号（"我刚做过这件事，它说没做"）在命令与配置分层的地方（turbo / nx / 多 tsconfig / 多 prettier）几乎总是同一个成因：**在错误的层级上调用了正确的工具**。
