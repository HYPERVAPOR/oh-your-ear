---
date: "2026-09-27"
category: "lesson"
tags: ["vercel", "firewall", "seo", "search-console", "cli", "crawlers"]
summary: "GSC 说「无法读取站点地图」时怎么用 Vercel CLI 证伪防火墙：firewall status / traffic inspect bot googlebot 能看到爬虫的实际动作；另记 vercel link 会偷偷改 apps/*/.gitignore"
---

## 场景

Search Console 报「无法读取此站点地图」，而 `curl` 拿到的文件完全正常（200、`application/xml`、合法 XML、robots 允许、响应头没有 `X-Robots-Tag`、Googlebot UA 也 200）。这种「Google 拿不到、命令行拿得到」的形态，第一个嫌疑人就是 Vercel 的防火墙 / Bot Protection。

## 用 CLI 证伪（不需要开任何浏览器）

跑之前要先 `vercel link`（CLI 已登录 `hypervapor`，无需 token 环境变量）：

```bash
vercel link --yes --project oye-app --cwd apps/web
vercel link --yes --project oye-landing --cwd apps/landing
```

然后这四条就是完整证据链：

```bash
vercel firewall status --cwd apps/landing          # 配置：Attack Mode / Bot Protection / AI Bots / 自定义规则
vercel firewall overview --cwd apps/landing        # 近 24h：Allow / Deny / Challenge 计数、Attacks mitigated
vercel firewall traffic inspect path /sitemap.xml  # 该路径的所有请求按动作拆开（**决定性**）
vercel firewall traffic inspect bot googlebot      # Googlebot 自己的请求，含它抓了哪些路径、动作是什么
```

本次结果（2026-09-27）：`Firewall Not configured`、`Attack Mode Off`、`Bot Protection Off`、`AI Bots Allow`；`/sitemap.xml` 24 小时 27 次请求**全是 Allow**；`googlebot` 8 次请求**全是 Allow**，抓了 `/sitemap.xml` ×3、`/`、`/robots.txt`、两个 assets。→ 防火墙与 Bot Protection **可以排除**，而且反过来说明 Google 已经在正常抓这个站（连落地页和 robots.txt 都抓了）。

注意 `Deny 103 / Challenge 11` 不是坏事：规则只有 `sys_dos_mitigation`，来源是扫描器（`/wp-admin/install.php` 被探了 82 次、还有一个 Tor 出口 IP），跟自己的路径无关。

## 顺带两条

- `vercel link` 会**修改 `apps/*/.gitignore`**（追加 `.vercel`、`.env*`）并在两个 app 目录生成 `.env.local`。仓库里没有 `.vercel` 忽略规则，所以查完要 `git checkout -- apps/*/.gitignore && rm -f apps/*/.env.local && rm -rf apps/*/.vercel`，否则脏文件会被带进提交。
- 「站内地图未读取」**不阻塞收录**：Googlebot 是自己发现 `/` 的（本次 `/` 与 `/robots.txt` 都有被抓的记录）。所以别为 sitemap 的状态花时间，要盯的是 Pages 报告里落地页何时变 Indexed。

## 什么时候还要回头看防火墙

如果 `traffic inspect path <路径>` 里出现 Deny/Challenge，或者 `attack-mode status` 变成 On —— 那才是真被拦。Attack Mode 打开会挑战**所有**请求，连爬虫一起挑战，是唯一能让「只有 Google 拿不到」的常见配置。
