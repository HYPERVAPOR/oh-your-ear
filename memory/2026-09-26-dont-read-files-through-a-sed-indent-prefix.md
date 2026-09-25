---
date: "2026-09-26"
category: "workflow"
tags: ["tooling", "edit-tool"]
summary: "别用 `cat … | sed 's/^/  /'` 加缩进读文件，再把输出当成 edit 的 oldText —— 缩进会污染匹配"
---

# 读文件不要顺手加缩进

为了输出好看，我常这么读文件：

```bash
cat src/foo.tsx | sed 's/^/  /'
```

然后在 `edit` 里把**带那两格缩进的文本**当作 `oldText` —— 文件里没有那两格，于是匹配失败：「Could not find edits[1]」。一次会话里因此白费了两次编辑（每次还得重新读一遍原文）。

规矩：**要看就原样读**（`read` 工具，或有行号有缩进但不加料的 `grep -n`）。要在终端里加缩进做展示，就别拿那段文本去改文件。
