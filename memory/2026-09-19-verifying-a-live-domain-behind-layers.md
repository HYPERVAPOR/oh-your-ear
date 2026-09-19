---
date: "2026-09-19"
category: "lesson"
tags: ["vercel", "dns", "wsl", "proxy", "verification", "spaceship", "deploy"]
summary: "验证线上域名时三个会骗人的东西：Vercel 部署保护把 *.vercel.app 302 到 SSO、本机 fake-IP 代理让公网域名解析成 198.18.x.x、Cloudflare DoH 缓存了写记录之前的 parking 答案。"
---

# 验证线上域名：三个会骗你的中间层

首次把前端部署到 Vercel（`ohyourear.com` / `app.ohyourear.com`）时，三件事轮流让我以为部署坏了。

## 1. `*.vercel.app` 返回 302 —— 那不是坏，是部署保护

新建项目的保护配置是 `ssoProtection: {deploymentType: "all_except_custom_domains"}`：**部署 URL 需要登录 Vercel，自定义域名不受影响**。

```bash
curl -I https://oye-landing-<hash>-<team>.vercel.app/   # 302 → vercel.com/sso-api?url=...
```

所以「部署 READY 但 URL 打不开」不要慌，也不要顺手去关保护 —— 绑上自定义域名就正常了。想核对当前设置：

```bash
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/<name>?teamId=<team>" | jq .ssoProtection
```

（`$VERCEL_TOKEN` 可以直接从 CLI 的凭据里取，不用另建 token：`~/.local/share/com.vercel.cli/auth.json` 的 `token` 字段。）

## 2. 本机 curl 打不开线上域名 —— 这台机器走 fake-IP 代理

`getent hosts ohyourear.com` → `198.18.1.85`（`198.18.0.0/15` 是 TUN/fake-IP 代理的假地址段）。表现是 `curl: (35) TLS connect error: unexpected eof`，而且**不同域名表现不一致**（同一个代理下 `app.` 子域 200、裸域 000），最容易被误判成"证书没签好"。

可靠的三种绕法：

- **外部抓取器**：`curl -sS https://r.jina.ai/https://ohyourear.com/`（从别的网络取，还会执行 JS，SPA 也能看到渲染结果）
- **问权威方**：`GET https://api.vercel.com/v6/domains/<domain>/config?teamId=...` → `misconfigured: false` 就说明线上接线是对的
- **Windows 侧 Chrome**（不经过 WSL 的代理）`--dump-dom`

## 3. DoH 缓存了写记录**之前**的 parking 答案

用 Cloudflare DoH 查刚写好的 A 记录，拿到的是 `34.216.117.25` / `54.149.79.189`（AWS，不是 Vercel 的 `216.198.79.1` / `64.29.17.1`）—— 那是**缓存 TTL 3600 内的旧答案**（域名此前无记录时的默认 parking）。

**换一个解析器交叉验证**即可：

```bash
curl -sS "https://dns.google/resolve?name=ohyourear.com&type=A"   # 新查询，直接给权威答案
```

## 附：Spaceship DNS 写入的正确形状

`PUT /v1/dns/records/{domain}` 的 body 是 upsert（不是全量替换，也会更新 TTL）：

```json
{ "force": false, "items": [
  { "type": "A",     "name": "@",   "address": "216.198.79.1", "ttl": 3600 },
  { "type": "CNAME", "name": "app", "cname": "<hash>.vercel-dns-017.com", "ttl": 3600 }
] }
```

- `name` 是**去掉域名部分**的相对名，裸域用 `@`。
- Vercel 给的推荐值里取 **rank 1**：裸域两条 A（`216.198.79.1` + `64.29.17.1`），子域用它为那个域名专用生成的一跳 CNAME（`GET /v6/domains/<d>/config` 的 `recommendedIPv4` / `recommendedCNAME`）。
- 成功返回 **204**，回读用 `GET /v1/dns/records/{domain}?take=500&skip=0`（必须带 `take`/`skip`）。

## 参考

- `docs/deploy.md`（拓扑与上线步骤）
- `memory/2026-09-18-wsl-headless-verification-via-windows-chrome.md`（本机验证手段）
