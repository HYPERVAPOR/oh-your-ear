---
date: "2026-09-26"
category: "gotcha"
tags: ["i18n", "react-i18next", "Trans"]
summary: "react-i18next 的 <Trans> 里，组件标签名不能是 HTML 空元素名（link、br、img…），否则内容被放到元素外面"
---

# `<Trans>` 的组件标签别叫 `link`

要在句子里嵌一个链接（「请<link>登录</link>。」），用了本仓库的第一次 `<Trans i18nKey components={{ link: <Link/> }} />`。

结果渲染成：

```html
<p>嗯……我们还不认识你，请<a class="…" href="/login?next=%2F"></a>登录。</p>
```

**锚点里的文字是空的，句子文字跑到了锚点外面** —— 链接还在、也能点，但看起来是一段普通文字，而且「登录」两个字不在链接里。

原因：`link` 是 HTML 的**空元素**名，i18next 的解析器把它当自闭合标签处理，于是 `...</link>` 之间的内容落在元素之后。

改法：把标签名换成不是 HTML 元素的词，比如 `<signIn>登录</signIn>`，`components={{ signIn: <Link …/> }}`。同理要避开 `br`、`img`、`input`、`hr`、`meta`、`source`、`area`、`base`、`col`、`embed`、`track`、`wbr`。
