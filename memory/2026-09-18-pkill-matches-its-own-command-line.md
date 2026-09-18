---
date: "2026-09-18"
category: "lesson"
tags: ["bash", "pkill", "process", "dev-container", "podman"]
summary: "`pkill -f <pattern>` 会匹配到调用它的那个 shell 自己的命令行——包括你正在跑的那整条命令，于是把自己杀掉、后续步骤静默不执行。用 `ps ... | grep 'patter[n]'` 或按端口找 PID 代替。"
---

# pkill -f 会杀掉自己：一条命令的后半段静默丢失

## 背景

验证认证加固时需要在宿主机临时起一个 API 进程和一个假 SMTP 服务器，验证完要清理掉。

## 经过

写了这样一条命令：

```bash
pkill -f "fake_smtp.py" 2>/dev/null; pkill -f "go run ./cmd/server" 2>/dev/null; sleep 1
curl ... ; podman exec ... psql -c "DELETE ..." ; podman restart oh-your-ear-api-1
```

整条命令**没有任何输出**，也没报错。实际情况是：`pkill -f "go run ./cmd/server"` 的模式匹配到了这条 bash 命令**自己的命令行**（命令行里就写着这个字符串），于是 pkill 把执行这条命令的 shell 一并杀了 —— 后面的 curl、数据清理、容器重启全部没跑。我是后来发现数据库里还有测试用户、容器状态没变才意识到的。

同一次会话里还有一次变体：我先 `ps -eo pid,args | grep "cmd/server"` 找出 PID 再 `kill`，结果**把开发容器里的 API 进程也杀了**（那个进程的 cmdline 里同样有 `go run ./cmd/server`），开发环境瞬间 health=000。

## 结论

1. 匹配模式放进方括号，让它不再匹配自己：
   ```bash
   pkill -f "fake_smt[p].py"          # 命令行里出现的是 fake_smt[p].py，不是 fake_smtp.py
   ```
2. 或者**按端口找 PID**，最精确、不会误伤同名进程：
   ```bash
   PID=$(ss -ltnp | grep ":8090" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
   kill "$PID"
   ```
3. 清理类命令**不要和验证步骤写在一条 `;` 链里**：一旦前面被中断，后面的步骤不会执行，而你可能以为执行过了。
4. 杀进程前先确认它是谁的：`ps -o pid,ppid,args -p <pid>`，容器内的进程和宿主进程名字可能一模一样。

## 原因

`pkill -f` 匹配的是**完整命令行**，而你自己这条 `bash -c "..."` 的完整命令行里就包含了你要匹配的字符串 —— 自匹配是必然的，不是偶然。加上 `--older`、`-x` 之类的参数也只能缓解。

而这个失败模式特别阴：没有报错、没有输出，看起来就像"命令执行了但没效果"。

## 参考

- `apps/api` 开发容器入口是 `go mod download && go run ./cmd/server`（所以宿主机 `ps` 里能搜到同名 cmdline，误杀风险高）
- 验证 SMTP 投递用的最小假服务器：`python3` 起一个监听 2525 的 socket，按 SMTP 协议回 `220/250/354/221` 即可让 `net/smtp` 走完整个会话
