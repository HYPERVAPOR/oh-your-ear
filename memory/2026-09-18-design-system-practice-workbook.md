---
date: "2026-09-18"
category: "decision"
tags: ["design", "ui", "design-md", "typography", "tokens", "fonts", "tailwind"]
summary: "UI 重设计以 DESIGN.md（改自 awesome-design-md 的 ElevenLabs 分析）为准绳：练习册隐喻、墨水胶囊唯一动作色、五个柔光球映射五个模块；字体自托管 Newsreader + Inter，中文回退系统字体。"
---

# 设计系统：练习册隐喻 + 模块色信息化的 DESIGN.md

## 背景

用户评价"前端 UI 设计太烂"，要求参考 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 里的一份 DESIGN.md，结合项目的 frontend-design skill 重做。

## 经过

### 选源

73 份候选里挑了 **ElevenLabs**：它的语汇是"安静的印刷杂志"——纸底 + 暖近黑墨水 + 发丝线 + 轻衬线标题 + 胶囊按钮 + 五个柔光球（mint/peach/lavender/sky/rose）作为唯一的色彩时刻。对一个每天用十分钟、边听边答的练耳工具，这比"仪表盘"或"消费品牌"都合适。

### 两处有意偏离（写进 DESIGN.md 的对照表）

1. **五个柔光球 → 五个模块身份色**：单音薄荷、音程蜜桃、和弦薰衣草、旋律天蓝、节奏玫瑰。于是颜色承载信息（模块识别），不只是气氛。列表与统计行用同色系中调 `--swatch-*` 色点（柔光球太淡，做不了标记）。
2. **禁用态不用 `opacity: 45%`**：单色页面上"变灰的墨色胶囊"看起来像坏掉，改成静默 surface 胶囊 + 弱化文字。

### 字体（关键约束）

- 源设计的 Waldenburg 是商用字体；它建议的替代 EB Garamond **没有 300 字重**（Google Fonts 直接丢掉了这个 family，我是请求后才发现）。
- 最终 display = **Newsreader**（OFL，可变 200–800，有真正的 300），正文 = **Inter**，两者自托管 latin/latin-ext 子集共 216KB，运行时零第三方请求、离线可用。
- **中文一律不打包**：一个中文字体几 MB，而 Songti/PingFang/YaHei/Noto 各平台都有 → 回退栈写进 DESIGN.md。

### 落地顺序

1. token / 字体 / 原语（Button·Card·Pill·Field·Orb·Swatch）/ 页头 + 首页 + 登录页
2. `ExerciseShell` + 五个模块 + 设置面板
3. `/me` + `/mistakes`

## 结论

- 设计规范落在仓库根目录 **`DESIGN.md`**（frontmatter 是机器可读 token，正文是规则与 do/don't）。**改 UI 前先读它**，不要再发明新的间距/色值。
- token 命名以 DESIGN.md 为准（canvas/surface/ink/body/muted/hairline/primary/success/error/swatch-*）；旧名（background/foreground/border/muted-foreground…）目前作为别名指向同一批值，最后一批文件迁移完就可以删。
- 判定状态**必须三件齐**：色块 + 满强度描边 + ✓/✕ 标记。只做 `/10` 淡色块时截图里根本看不出来，等于没有反馈（PRD 7.3 也禁止只靠颜色）。
- 答题页的反馈条与「下一题」占**固定槽位**，答题时选项不能位移。

## 原因

- 之前的 UI 是"默认脸"：系统蓝复选框、硬编码 `bg-green-100 dark:bg-green-900`、每页自定义间距、卡片叠阴影。缺的是一套**有人做过的系统**，而不是更多样式。
- 用现成的 DESIGN.md 当基准，好处是决策有出处、可争论、可对照；坏处是要老实处理它的替换项（授权字体、颜色对比度不达标的绿红），这些偏离都写进了对照表而不是偷偷改。

## 参考

- `DESIGN.md`、`apps/web/src/index.css`（token + `orb-*` / `badge-label` / `tabular` 工具类）、`apps/web/src/components/ui/*`、`apps/web/public/fonts/LICENSES.md`（SIL OFL 1.1）
- 迭代靠真截图（WSL 调 Windows Chrome headless + 固定宽度 iframe），见 `2026-09-18-wsl-headless-verification-via-windows-chrome.md`
- PR #48 / #49 / #50
