---
date: "2026-09-21"
category: "decision"
tags: ["ci", "github", "process"]
summary: "纯文档改动不该触发 CI：workflow 级 paths-ignore（本仓库 safe，因为 main 没有必过检查）；若开了必过检查必须改成 job 级 if"
---

# 纯文档改动不要跑 CI

改个 README 触发了五个 runner —— 用户原话："这种情况下应该bypass啊？"

**要做的是"别触发"，不是"绕过"。** 绕过检查等于承认那个检查不可信；而这里的真实问题只是它对着不该管的东西跑。GitHub 原生开关：

```yaml
on:
  push:
    branches: [main]
    paths-ignore: &not-code
      - '**/*.md'
      - '.github/assets/**'
      - 'LICENSE'
      - 'NOTICE'
  pull_request:
    branches: [main]
    paths-ignore: *not-code
```

YAML 锚点（`&` / `*`）在 workflow 文件里可用，两个触发器共用一份列表。

## 那个著名的坑，以及本仓库为什么没有踩

**如果 main 开了必过检查（required status checks），workflow 级过滤会让 PR 永远卡住**：不跑 = 那个检查永远停在 "Expected — waiting for status to be reported"，而 job 级 `if:` 跳过则会被算作通过。

所以动用例前先查：

```bash
gh api repos/OWNER/REPO/branches/main/protection
```

本仓库是 `404 Branch not protected` —— **一个必过检查都没有**，那五个检查对文档 PR 是纯粹白烧，所以 workflow 级过滤完全安全。**哪天有人给 main 开了必过检查，就必须改成 job 级 `if:` 守卫**（这条也写进了 `.github/workflows/ci.yml` 的注释，免得下一个人照抄出事）。

顺带：`file-size-check` 只按源码后缀查（go/ts/tsx/py…），`.md` 不在表里，所以文档改动确实不需要它。

## 验证方式

先推配置本身（它不是被忽略的路径，会跑一次 CI，顺带验证 YAML 合法），**再推一个纯文档改动，确认 `gh run list` 里没有新运行** —— 一次真实验证，比读文档想象强。
