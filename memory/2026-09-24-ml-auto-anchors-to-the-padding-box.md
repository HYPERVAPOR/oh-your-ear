---
date: "2026-09-24"
category: "pitfall"
tags: ["css", "layout", "landing"]
summary: "`ml-auto` 对齐的是 padding 内边缘，不是里面那个居中容器的边；窄块要靠里层的 `ml-auto`，不是把两层容器合成一层"
---

# 靠右的块要对齐容器，不是对齐装订线

落地页第二屏（注册说明）做成靠右构图时，我写了这样一层：

```jsx
<section className="px-6">            {/* 装订线 */}
  <div className="w-full ml-auto max-w-[760px]">…</div>
</section>
```

看着没问题，实际是错的：`ml-auto` 把块推到 **section 的 padding 内边缘**，也就是装订线里侧，而不是里面那个 `max-w-[1200px]` 居中框的右缘。1280 宽下差 8px 不明显，1600 宽下差 176px —— 同一屏里的内容比上面几屏伸出去了，用户一眼就看出来「超出页面宽度了，咱们一直有一个页面左右边距呢」。

**根因是把两层容器合成了一层。** 页面一直有两层：外层 `mx-auto max-w-[1200px]`（所有屏共用的 1200 框），内层才是个别屏自己的子块。`ml-auto` 属于内层：

```jsx
<section className="px-6">
  <div className="mx-auto w-full max-w-[1200px]">
    <div className="ml-auto max-w-[760px]">…</div>
  </div>
</section>
```

这样块的右缘与所有屏的右缘是同一条竖线（实测 1280 下都是 x=1233，1600 下都是 1393），装订线也照旧。

**同理**，给带 `max-w` 的标题加 `text-right` 不够：盒子还会留在块的左缘，只有盒内的行靠右。要 `ml-auto text-right` 一起给 —— 盒子先贴右缘，行再右对齐，多行标题的右缘才齐。

**验证办法**：别硬编码"容器右缘应该在哪"，直接量两处 —— 拿上一屏的同一个容器和这一屏的块比左右缘。第一次就是因为我在探针里把容器右缘写成了假设值，才没当场发现。
