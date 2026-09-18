---
date: "2025-06-10"
category: "lesson"
tags: []
summary: "Define auth helpers before useEffect and avoid shadowing `user` to satisfy strict lint rules."
---

---
date: "2025-06-10"
category: "lesson"
tags: ["react", "lint", "auth", "useeffect"]
summary: "Define auth helpers before useEffect and avoid shadowing `user` to satisfy strict lint rules."
---

# Frontend auth initialization ordering

## 背景

在 `App.tsx` 中实现 Google OAuth 回调解析与会话恢复时，Linter 报出三类错误：
- 嵌套作用域中的 `user` 变量遮蔽了外层组件的 `user` 状态。
- `useEffect` 在声明完成前就访问了 `fetchUser` / `refreshAccessToken`。
- `useEffect` 依赖数组缺少 `accessToken`、`setAccessToken`、`setUser`。

## 经过

初始实现把 `useEffect` 放在组件前部，而 `fetchUser` 和 `refreshAccessToken` 以函数声明形式写在更下方。虽然函数声明会被提升，但 Linter 的读取顺序检查仍将其视为在初始化期间读取。此外，`useEffect` 内部用 `const user = await fetchUser(token)` 遮蔽了组件作用域的 `user`。

## 结论

- 将 `fetchUser` 和 `refreshAccessToken` 移动到 `useEffect` 之前定义。
- 在 `useEffect` 内部把用户信息变量重命名为 `profile`，避免遮蔽 `user` 状态。
- 补全依赖数组：`[accessToken, setAccessToken, setUser]`。

## 原因

严格的 ESLint/oxlint 规则会检查变量读取顺序和 hooks 依赖完整性。即使函数声明在运行时提升，静态分析仍然要求引用点不早于声明的可见范围；同时 React hooks 规则要求 effect 中使用的所有响应式值都必须出现在依赖数组中。

## 参考

- `apps/web/src/App.tsx`
- Branch `feature/17-google-oauth-and-mock-login`
