---
date: "2026-09-19"
category: "lesson"
tags: ["vite", "dev-server", "css", "cache", "tailwind", "fonts"]
summary: "Vite 开发服务器会把 CSS 模块缓存在内存里，切分支/脚本写文件后可能继续提供旧内容 —— 浏览器看起来像改动"没生效"或"改回去了"。判断方法：对比 /src/index.css 与 /src/index.css?direct 的输出。"
---

# Vite dev server 提供旧 CSS：`?direct` 一测就知道

## 背景

换字体（Inter → JetBrains Mono）并合并 PR 之后，用户在 `localhost:5173` 看到的还是旧字体，以为改动被回退了。源码、字体文件、构建产物全部正确。

## 判断方法（关键）

```bash
# 浏览器实际拿到的（HMR 模块，走缓存）
curl -s http://localhost:5173/src/index.css | grep -c "JetBrains Mono"
# 现场重新编译的（读磁盘当前内容）
curl -s "http://localhost:5173/src/index.css?direct" | grep -c "JetBrains Mono"
```

结果：前者 0（里面还是 `--font-sans: 'Inter', ...`），后者 4。**同一时刻两次请求内容不同 = 缓存过期**，不是代码问题。

副作用很难自己发现：旧栈里写的 `'Inter'` 没有 `@font-face`，于是浏览器回落到系统字体 —— 看起来就是"字体风格变了/变回去了"。

## 处理

```bash
touch apps/web/src/index.css        # 多数情况够
podman restart oh-your-ear-web-1    # 上面不够时，重启 dev server
```

用户侧则要**硬刷新**（Ctrl+Shift+R 或 DevTools 里 Disable cache），因为浏览器自己也缓存了那份 CSS 模块。

## 原因

- Vite 按 mtime 失效转换缓存；脚本批量写文件、`git checkout` 切分支都可能让 mtime 变化不显著或发生在 watcher 注意不到的时刻。
- 这个项目的前端跑在容器里（`compose/compose.dev.yml`），宿主改文件 → 容器内 watcher 的时序又多一层。
- 教训：**凡是改 CSS/样式后用户说"没生效"，先做 `?direct` 对比**，别急着改代码。同类坑之前也踩过（prettier 重排导致补丁静默失效）。

## 参考

- `apps/web/src/index.css`
