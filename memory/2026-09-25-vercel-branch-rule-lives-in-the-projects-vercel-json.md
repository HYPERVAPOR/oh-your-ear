---
date: "2026-09-25"
category: "lesson"
tags: ["vercel", "ci", "deployment", "verification"]
summary: "git.deploymentEnabled 必须写在项目自己的 vercel.json（Root Directory 下那份），仓库根那份不生效；并且限额耗尽的窗口反而是干净的判据——规则不生效必留一条 rate-limited 状态。"
---

# Vercel 的分支部署开关：放哪一份文件，以及怎么在限额窗口里验证

## 放哪一份

`git.deploymentEnabled` **必须写在项目自己的 `vercel.json` 里**（就是该项目 Root Directory 下那一份；我们的项目是 `apps/web`、`apps/landing`）。

仓库根的 `vercel.json` **不生效**。这条踩了很久：根目录那份从 13:14 起一直带着 `{dev: false}`，而期间每一次 dev 推送都照常部署，于是看起来像"这个字段根本没用"。同一段配置放进两个项目文件之后，dev 推送立刻不再触发部署。

字段本身按官方文档写就对：`{ "git": { "deploymentEnabled": { "dev": false } } }`，键支持 minimatch（如 `internal-*`），多条命中只要有一条是 `true` 就部署。

**别用 `*` 或 `**` 当通配**：`main` 也是不含斜杠的分支名，通配一旦把它也关掉，生产就静默不部署了。宁可少关几个分支，也不能有这种配置。

**这个设置跟着 git 走**，所以它必须出现在被推送的那个提交里——分支的历史缺了它，规则就不生效（我们就是这么丢的，见 `2026-09-25-resetting-an-integration-branch-drops-what-landed-on-main.md`）。

## 怎么验证（不用等额度恢复）

一开始以为"额度耗尽的窗口里分不清规则生效与被额度挡下"，所以一直不敢下结论。其实反过来：**那个窗口是最好的判据。**

- 规则**不生效** → Vercel 必然尝试一次 → 提交上会留下一条 `Deployment rate limited` 状态；
- 规则**生效** → 没有部署被创建 → 该提交上**一条 Vercel 状态都没有**。

```bash
gh api repos/OWNER/REPO/commits/<sha>/status --jq '.statuses[].context'
```

加上配置后推两个 dev 提交，两次都返回空；而在此之前，每一次 dev 推送都带着两条 rate-limited 状态。判据清晰、不需要消耗额度、也不需要面板。

推论：**在限额窗口里，"缺少失败状态"是有信息量的，"存在失败状态"同样有信息量** —— 真正没信息的是"成功的部署"（分不清是真构建还是被 `ignoreCommand` 跳过）。
