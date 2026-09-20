---
date: "2026-09-20"
category: "bugfix"
tags: ["react", "css-3d", "imperative-dom"]
summary: "拖拽旋转别用 React state，也别在 render 里写 transform：前者每次 pointermove 重渲染，后者被任何重渲染弹回初始视角"
---

# CSS 3D 拖拽旋转：state、ref、render 的三角关系

给 3D 柱状图做「按住拖动旋转」时踩的两个坑，顺序很经典：

## 坑 1：用 `useState` 存旋转角

```tsx
const [rotation, setRotation] = useState({ x: -20, y: -16 })
// pointermove 里：
setRotation({ x: ..., y: ... })
```

每次 `pointermove` 都触发一次 React 重渲染（游戏鼠标可达每秒数百次），只为写一个 style 属性。改成 `useRef` + 直接写 DOM，并用 `requestAnimationFrame` 把同一帧内的多次移动合并成**一次**样式写入：

```tsx
const spin = useRef({ x: -20, y: -16 })
if (!frame.current) frame.current = requestAnimationFrame(paint)
```

静止时没有循环、没有 rAF、CPU 占用为 0（CSS 3D 的合成由浏览器在 GPU 侧完成）。

## 坑 2：在 render 里读 ref 写 transform

改完 ref 之后顺手写成：

```tsx
<div style={{ transform: `rotateX(${spin.current.x}deg) ...` }}>   // ✗
```

oxlint 直接报 `react(refs): Cannot access refs during render`，而且它指向一个**真 bug**：
组件里任何一次重渲染（比如点柱子把选中态 `setPlayed` 改掉）都会用 render 时的值重写 `style.transform`，**把用户刚转好的视角弹回初始角度**。

正确做法：render 完全不碰 transform，挂载时用 effect 写一次（或干脆用 CSS 类给初值），之后只有拖拽通过 ref 改：

```tsx
useEffect(() => { paint() }, [])
```

判断标准：**命令式控制的东西，别让 React 渲染管线也管一份**。两份状态（ref 与 render 输出）必然打架，而且只在「重渲染恰好发生在交互后」时暴露，最难查。
