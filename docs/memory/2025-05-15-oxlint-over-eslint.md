---
date: "2025-05-15"
category: "lesson"
tags: ["linting", "frontend", "toolchain", "eslint"]
summary: "ESLint v10 与 React/TypeScript 插件存在 peer dependency 冲突，项目改用 oxlint + Prettier。"
---

# ESLint v10 导致 peer dependency 冲突

## 背景

项目前端使用 React 19 + TypeScript 5.7 + Vite 6，尝试引入 ESLint v10 进行代码检查。

## 经过

安装 ESLint v10 后，`eslint-plugin-react`、`eslint-plugin-unicorn`、`@typescript-eslint` 等插件出现 peer dependency 不兼容或版本冲突：

- 部分插件尚未声明支持 ESLint v10
- React 19 相关规则包版本滞后
- `pnpm install` 虽能强制安装，但运行时规则加载失败或报 `Rule not found`

尝试降级 ESLint 到 v8 后，@typescript-eslint v8 又要求 ESLint v9+，形成死锁。

## 结论

放弃 ESLint，改用：

- **oxlint**：负责 correctness / suspicious / perf 规则
- **Prettier**：负责代码格式化

## 原因

- oxlint 零配置、速度快、与 React/TS 无 peer dependency 冲突
- Prettier 已经覆盖格式一致性
- 项目当前阶段不需要 ESLint 生态的海量插件

## 参考

- `apps/web/package.json` lint 脚本
- `apps/web/.oxlintrc.json`
- `apps/web/.prettierrc`
