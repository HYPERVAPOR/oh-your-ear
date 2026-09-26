---
date: "2026-09-26"
category: "technique"
tags: ["react", "tailwind", "tooltip", "hover", "a11y", "chart", "probe"]
summary: "纯 CSS 的悬停读数卡片：父元素 group + 绝对定位卡片，用 opacity-0 / group-hover:opacity-100（不是 display:none，读屏才读得到），pointer-events:none 免得抢走底下元素的悬停；最外两侧的卡片要贴边对齐，否则窄屏会挂到卡片外面。headless 里没法真的触发 :hover，验证要换成「查生成的 CSS 规则 + 手动点亮量几何」。"
---

# 图表上的悬停读数卡片

`/me` 统计卡里「各模块正确率」那张柱状图，柱子悬停时浮出一张卡片（模块名 + 色点、正确率、练了多少、对了多少）。

## 结构

```tsx
<div className="group relative w-4">                    {/* 一列一根柱 */}
  <span className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: `${percent}%` }} />
  {/* 柱顶那个数字在悬停时让位给卡片 */}
  <span className="... group-hover:opacity-0" style={{ bottom: `${percent}%` }}>{percent}%</span>

  <div className={`pointer-events-none absolute z-10 mb-2 w-40 ... opacity-0 transition-opacity group-hover:opacity-100 ${anchor}`}
       style={{ bottom: `${percent}%` }}>
    …名称 / 正确率 / 计数…
  </div>
</div>
```

四条经验：

- **用 `opacity-0` 而不是 `display: none`**：内容留在无障碍树里，读屏软件不悬停也能读到五条读数（这些数字在图上只有色点和柱高，别处没有）。
- **`pointer-events: none`**：卡片是读数不是控件，绝不能抢走柱子的悬停，否则鼠标一进入卡片就闪烁。
- **卡片跟随柱顶**：`style={{ bottom: percent% }}` 比固定 `bottom-full` 更贴切 ——卡片与它描述的那根柱有视觉联系；`100%` 时配合绘图区上方留的 24px 顶带，不会写到图外。
- **最外两根的卡片贴边对齐**（第一根 `left-0`、最后一根 `right-0`，中间的才 `left-1/2 -translate-x-1/2`）：160px 宽的卡片居中在最后一根柱上，在手机上会挂到卡片外面。这个锚点要在 `map` 里算（`first:`/`last:` 变体不行 —— 卡片不是 flex 的第一个子元素，柱才是）。

## 怎么验证（headless 里 :hover 触发不了）

CSS `:hover` 跟的是**真实指针**，`dispatchEvent(new MouseEvent('mouseover'))` 不会让伪类生效，项目里也没有可用的 CDP。所以拆成两条：

1. **规则存在**：读浏览器自己的 `document.styleSheets`，确认 `group-hover\:opacity-100`、`group-hover\:opacity-0` 这些转义后的类名在里面（各 1 条）。
2. **几何与文案**：先 `el.style.transition = 'none'`，再 `el.style.opacity = '1'`，量它的 rect（是否出卡、是否在卡区范围内）与 `textContent`，然后复原。

注意别用 `curl /src/index.css` 判断类有没有生成 —— 那是过时模块（见 `2026-09-19-vite-stale-css-vs-direct.md`），要用 `?direct` 或直接读 styleSheets。

## 参考

- `apps/web/src/components/practice-stats.tsx`
- `apps/web/src/components/ui/confirm-dialog.tsx`（同一套「背景层点击 = `event.target` 是 dialog 本体」的思路）
