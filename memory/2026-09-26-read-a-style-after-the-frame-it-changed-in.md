---
date: "2026-09-26"
category: "lesson"
tags: ["dom", "probe", "verification", "css", "dialog", "transition", "getComputedStyle"]
summary: "改动样式的同一个 tick 里读回来的是旧值：刚 showModal() 的 dialog 读 :modal 会是 false，刚设 opacity:1 的元素 getComputedStyle 还是 0（过渡的动画值）。探针里一连误报三次，都不是代码问题；其中一次是无头 Chrome 的虚拟时钟根本不推进过渡，sleep 也救不了。"
---

# 刚改完样式就读，读到的是旧值

## 背景

一天里两次被自己的探针骗了，都发生在"设置样式/状态之后立刻读回来"这个动作上：

1. `AvatarPreview` 打开后立刻读 `dialog.matches(':modal')` → `false`，看起来像 `showModal()` 没进入模态。但同一个 dialog 有背景层、Esc 的 `cancel` 也会触发、角落 `elementFromPoint` 命中的就是 dialog 本体 —— 全是模态的特征。
2. 探针为了量悬浮卡片的几何，先 `el.style.opacity = '1'`，紧接着 `getComputedStyle(el).opacity` → `0`。

两次单独对照实验都说代码是对的（顶层文档与 iframe 里的 `:modal` 都是 `true`）。

## 原因

- 模态状态、样式变更都不是立刻反映到**同步读取**上：浏览器要在下一帧（甚至过渡的下一帧）才把它们落地。
- 有 `transition` 时更明显：`getComputedStyle` 返回的是**当前动画值**，而刚改成 `1` 的那一瞬间动画值仍是 `0`。

## 处理

```js
// 读 :modal / 读几何之前，先让出一帧
await new Promise((r) => requestAnimationFrame(r))
```

- 有过渡的元素：要么先 `el.style.transition = 'none'`，要么隔一帧（探针里 `await sleep(300)` 也够）。
- 断言"用户能看见什么"时，**先等，再读**；读到的可疑值不要直接下结论，先做个最小对照实验（同一个动作，单独一个页面/元素）再判断。

## 追加（同日）：无头 Chrome 里 `sleep` 也救不了过渡

同一个坑换了个面孔又咬了一次。练习页的"听过一遍之前选项锁着"改成 `opacity-50` 后，探针里**播放前**读 `0.5`、播放后仍然读 `0.5`，我据此去查是不是有别的 CSS 规则在设 `opacity` —— 白查一场：

- 元素的 `className` 里已经没有 `opacity-50` 了，`document.styleSheets` 里没有任何匹配该元素且设 `opacity` 的规则，inline style 也是空的；
- 手动 `classList.remove('opacity-50')` 之后立刻读，还是 `0.5`。

原因是探针用 `--headless=new --dump-dom --virtual-time-budget=N`：**虚拟时钟下 CSS 过渡不推进**，`await sleep(2500)`（虚拟时间）也不行，`getComputedStyle` 永远停在过渡的起始值。`transition: 0.15s` 就是那个"永远"的长度。

所以在这套探针里验证状态切换，**别读被过渡驱动的属性**：

```js
// 1) 读类名（React 已经把它摘掉了）
t.className.includes('opacity-50')   // → false

// 2) 或者把过渡关掉，再读最终值
t.style.transition = 'none'
getComputedStyle(t).opacity           // → '1'
```

判据：虚拟时钟探针里，**能用类名/属性断言的，就别用计算样式断言**；非要用计算样式，先 `transition: none`。

## 参考

- `apps/web/src/components/avatar.tsx`（`AvatarPreview`）
- `memory/2026-09-25-assert-the-thing-the-user-can-see.md`

## 再追加：这条规则要用在**每一个读状态的探针**上

同一天里这个坑又咬了两次（都是「按钮/格子从一个状态切到另一个状态，读 computed style」）：
保存按钮从禁用（灰底）切到可用（墨底）、模块格子从选中切到未选中。两次读到的都是**切换前**的值，
两次都让我以为代码写错了。

所以别把它当特例判断，当流程：

```js
// 任何按状态读颜色的探针，读之前无条件关掉过渡
el.style.transition = 'none'
const st = getComputedStyle(el)
```

或者干脆断言**类名 / aria 属性 / disabled**，那些不经过过渡，断言它们永远不会被骗。
