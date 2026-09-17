---
date: "2026-09-17"
category: "lesson"
tags: ["pnpm", "podman", "dev-container", "toolchain"]
summary: "在 host 上直接跑 pnpm 会因为 node_modules 是从容器内 store 链接而失败，需要在容器里执行 pnpm 命令。"
---

# pnpm store 在 host 与 dev container 之间不一致

## 背景

项目使用 Podman Compose 启动 dev container（web/api/db）。容器启动时会跑 `pnpm install`，把依赖装到容器内的 `/workspace/.pnpm-store/v10` 并链接到 `/workspace/node_modules`。

## 经过

在 host 上执行：

```bash
pnpm --filter @oh-your-ear/web run typecheck
```

报错：

```
ERR_PNPM_UNEXPECTED_STORE  Unexpected store location
The dependencies at "/home/hv/projs/oh-your-ear/node_modules" are currently linked from the store at "/workspace/.pnpm-store/v10".
```

host 的 pnpm 想用自己的 global store，但 `node_modules` 已经由容器内的 store 链接，两边 store 路径不一致。

## 结论

需要运行的 web 前端检查命令（typecheck / lint / format / build）全部在 web 容器内执行：

```bash
podman exec oh-your-ear-web-1 sh -c "pnpm --filter @oh-your-ear/web run typecheck"
podman exec oh-your-ear-web-1 sh -c "pnpm --filter @oh-your-ear/web run lint"
podman exec oh-your-ear-web-1 sh -c "pnpm --filter @oh-your-ear/web run format:write"
podman exec oh-your-ear-web-1 sh -c "pnpm --filter @oh-your-ear/web run build"
```

根目录的 `pnpm lint` / `pnpm typecheck` 等 turbo 命令也应在容器内跑。

## 原因

- 容器和 host 的 pnpm store 路径不同，pnpm 对 store 位置敏感。
- 容器内才是项目真正的开发环境，host 只是编辑器/文件操作的入口。

## 参考

- `compose/compose.dev.yml` 中 web 服务把项目目录 mount 到 `/workspace`。
- 报错信息：`pnpm now wants to use the store at "/home/hv/.local/share/pnpm/store/v10"`.
