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

### 字体（走过一次弯路，最后单字族）

- 源设计的 Waldenburg 是商用字体；它建议的替代 EB Garamond **没有 300 字重**（Google Fonts 直接丢掉了这个 family，我是请求后才发现）。
- 第一版：display = **Newsreader**（OFL 衬线）+ 正文 = Inter，自托管共 216KB。
- **用户复审直接否掉**：「衬线标题 + 无衬线正文/按钮混用，缺乏精致感」。原因是更根本的：我的衬线栈是 `Newsreader + 系统宋体` —— **拉丁衬线配不上系统中文衬线**，而中文标题与拉丁词（note 名、品牌名）同行时两种衬线并置。双语产品几乎不可能在这条路上做精致（打包中文 webfont 是几 MB）。
- 最终：**全站单一字族**（Inter + 平台中文黑体），层级只靠字号 / 字重（300 显示、400–500 界面）/ 负字距；Newsreader 及许可说明已从包里删除，字体体积 216KB → 104KB。中文一律不打包（各平台自带 PingFang / 雅黑 / 思源）。

### 落地顺序

1. token / 字体 / 原语（Button·Card·Pill·Field·Orb·Swatch）/ 页头 + 首页 + 登录页
2. `ExerciseShell` + 五个模块 + 设置面板
3. `/me` + `/mistakes`

## 结论

- 设计规范落在仓库根目录 **`DESIGN.md`**（frontmatter 是机器可读 token，正文是规则与 do/don't）。**改 UI 前先读它**，不要再发明新的间距/色值。
- token 命名以 DESIGN.md 为准（canvas/surface/ink/body/muted/hairline/primary/success/error/swatch-*）；旧名（background/foreground/border/muted-foreground…）目前作为别名指向同一批值，最后一批文件迁移完就可以删。
- **不要在两个地方存同一份状态**（语言在 store 与 i18next detector 各一份 → 导航与正文可能不一致）。
- 判定状态**必须三件齐**：色块 + 满强度描边 + ✓/✕ 标记。只做 `/10` 淡色块时截图里根本看不出来，等于没有反馈（PRD 7.3 也禁止只靠颜色）。
- 答题页的反馈条与「下一题」占**固定槽位**，答题时选项不能位移。

## 复审后的另一条教训：要在**用户看到的那套配置**下自查

四条复审意见全部来自 **英文 + 深色**，而我前面每一轮截图都看的是中文 + 浅色 —— 于是"衬线/无衬线割裂""3+2 网格空洞""深色层次不清"这些问题我一次都没看见。同一张英文截图还暴露一个真 bug：**导航显示 English 而正文是中文**（app-store 与 i18next 的 detector 各存一份语言，启动时没同步，现在以 store 为准）。

=> 视觉自查必须覆盖 **语言 × 主题 × 宽度** 的组合，至少要有「用户默认看到的那一套」。

## 原因

- 之前的 UI 是"默认脸"：系统蓝复选框、硬编码 `bg-green-100 dark:bg-green-900`、每页自定义间距、卡片叠阴影。缺的是一套**有人做过的系统**，而不是更多样式。
- 用现成的 DESIGN.md 当基准，好处是决策有出处、可争论、可对照；坏处是要老实处理它的替换项（授权字体、颜色对比度不达标的绿红），这些偏离都写进了对照表而不是偷偷改。

## 参考

- `DESIGN.md`、`apps/web/src/index.css`（token + `orb-*` / `badge-label` / `tabular` 工具类）、`apps/web/src/components/ui/*`、`apps/web/public/fonts/LICENSES.md`（SIL OFL 1.1）
- 迭代靠真截图（WSL 调 Windows Chrome headless + 固定宽度 iframe），见 `2026-09-18-wsl-headless-verification-via-windows-chrome.md`
- PR #48 / #49 / #50
