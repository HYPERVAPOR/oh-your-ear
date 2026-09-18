---
date: "2026-09-18"
category: "lesson"
tags: ["wsl", "chrome", "headless", "screenshot", "theme", "verification", "tailwind"]
summary: "WSL 里没有可用的 headless 浏览器（缺 libnspr4、sudo 要密码），但可以直接调用 Windows 侧 Chrome 做 dump-dom / 截图；加 --force-dark-mode 可模拟 prefers-color-scheme: dark，用同源页面写 localStorage 再跳转可以验证持久化状态。"
---

# 在 WSL 里做前端可视化验证：借 Windows Chrome

## 背景

前端改动（主题色、布局）需要"看一眼"才算验证过。M11.2 改明暗主题时没有可视验证手段：

- `~/.cache/ms-playwright/chromium-1234` 有 Chromium 二进制，但启动报 `libnspr4.so: cannot open shared object file`；
- `sudo -n true` 返回 `interactive authentication is required`，装不了依赖；
- WSL 里也没有别的浏览器。

## 经过

试出三条可用路径（都在 WSL 里直接调用 Windows 可执行文件）：

**1. 基本验证（dump-dom / 截图）**

```bash
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless=new --disable-gpu --no-first-run \
  --dump-dom http://localhost:5173/login
```

Windows 侧能直连 WSL 的 `localhost:5173`（WSL2 localhost 转发）。截图写成 Windows 路径：

```bash
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1100,900 \
  --screenshot='C:\Users\hv\AppData\Local\Temp\shot.png' http://localhost:5173/
# 再从 WSL 读：/mnt/c/Users/hv/AppData/Local/Temp/shot.png
```

**2. 模拟深色模式**

`--force-dark-mode` 会让页面看到 `prefers-color-scheme: dark`。注意它会写进 Chrome 的默认 profile，所以后续"浅色"验证必须带 `--user-data-dir=<独立目录>`，否则会串味（第一次就踩了：两次运行都返回 `class="dark"`）。

**3. 预置 localStorage（验证持久化状态）**

zustand persist 的主题存在 `oye-app-storage`，headless 每次都是干净 profile，没法直接设。做法是在 `apps/web/public/__seed.html` 放一个同源小页面：

```html
<script>
  localStorage.setItem('oye-app-storage',
    JSON.stringify({ state: { theme: 'light', language: 'zh-CN' }, version: 0 }))
  location.replace('/')
</script>
```

访问 `/__seed.html`，它写完就跳转，于是能验证"预置 light + 系统深色 → 首屏保持 light"。顺带证明 zustand 的存储结构假设是对的。**用完记得删掉**（Vite 的 `public/` 会被打进产物）。

## 结论

- 可视化验证：Windows Chrome headless（截图 + dump-dom）。
- 深色模式：`--force-dark-mode`，且每次给独立 `--user-data-dir`。
- 持久化状态：同源 seed 页面写 localStorage 后跳转。
- 颜色对比度这种"看不见也能算"的东西，直接写脚本按 WCAG 公式算 `color-mix` 后的比值，比肉眼看更靠谱。

## 原因

- WSL 的 Linux 侧没有浏览器依赖，但 Windows 应用可以通过 `/mnt/c/...` 直接执行，且网络互通。
- 当前模型不能读图，所以截图只能给用户看；对模型自己能判断的部分（DOM、contrast 比值、构建产物里的 CSS 类）优先用文本手段验证。

## 参考

- `apps/web/src/index.css`（token 定义）、`apps/web/index.html`（首屏主题脚本）
- 对比度计算：relative luminance + `(L1+0.05)/(L2+0.05)`，浅色下 10% 药丸底需要按 `color-mix` 与背景混合后再算
