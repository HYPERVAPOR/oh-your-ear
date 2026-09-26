---
date: "2026-09-26"
category: "lesson"
tags: ["dom", "probe", "verification", "css", "dialog", "transition", "getComputedStyle"]
summary: "改动样式的同一个 tick 里读回来的是旧值：刚 showModal() 的 dialog 读 :modal 会是 false，刚设 opacity:1 的元素 getComputedStyle 还是 0（过渡的动画值）。探针里一连误报两次，都不是代码问题。"
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

## 参考

- `apps/web/src/components/avatar.tsx`（`AvatarPreview`）
- `memory/2026-09-25-assert-the-thing-the-user-can-see.md`
