# Long-Term Memory

这里是项目的长期记忆系统，只记录重要的知识沉淀：

- 棘手的 bug 及其解决方案
- 血泪踩坑教训
- 用户反复强调的偏好和约定
- 关键架构决策及其原因

## 格式

每个记忆条目是一个 Markdown 文件，顶部使用 YAML frontmatter：

```yaml
---
date: "YYYY-MM-DD"
category: "bugfix" | "lesson" | "preference" | "decision"
tags: ["tag1", "tag2"]
summary: "一句话概括"
---
```

文件名建议：

- 踩坑/bugfix：`YYYY-MM-DD-short-title.md`
- 偏好/约定：`preference-short-title.md`
- 决策记录：`decision-short-title.md`

## 为什么用 YAML + Markdown 而不是 SQLite

- 纯文本，Git diff 友好
- 可直接在编辑器里阅读和修改
- 不需要额外服务或迁移脚本
- 便于大模型在后续对话中检索和引用

新增条目时，先复制 `.template.md`。
