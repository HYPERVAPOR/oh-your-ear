---
date: "2026-09-17"
category: "bugfix"
tags: ["react-router", "vite", "white-screen", "runtime-error"]
summary: "React Router 嵌套 <BrowserRouter> 会导致运行时错误并白屏；添加路由前要先检查是否已有 Router 包裹。"
---

# React Router 嵌套 BrowserRouter 导致白屏

## 背景

为项目加入 `react-router-dom`，把首页和各练习页改成独立路由，并让浏览器后退/前进可用。

## 经过

实现后在 `App.tsx` 里包了一层 `<BrowserRouter>`：

```tsx
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
```

但 `main.tsx` 里已经有一层：

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

打开 http://localhost:5173 后白屏，Vite 服务端日志没有任何编译错误，浏览器控制台里 React Router 抛运行时错误。

## 结论

React Router 不允许嵌套 `<Router>`。修复方式：让 `App.tsx` 只负责 `<Routes>`，把 `<BrowserRouter>` 保留在 `main.tsx`。

```tsx
// App.tsx
export default function App() {
  const navigate = useNavigate()
  // ...
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      ...
    </Routes>
  )
}
```

## 原因

- 路由上下文由最近的 `<Router>` 提供，嵌套会冲突。
- 因为不是语法/类型错误，tsc 和 oxlint 都检查不出来，只能靠运行时测试或人眼检查入口文件。

## 参考

- PR #22: `fix(web): remove nested BrowserRouter causing white screen`
- `apps/web/src/main.tsx`
