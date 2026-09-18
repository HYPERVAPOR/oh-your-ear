---
date: "2026-09-18"
category: "bugfix"
tags: ["react", "useState", "random", "quiz-generation", "screenshot-review"]
summary: "题目各部分（播放的音、答案键、选项）如果各自在自己的 useState 初始化里抽随机数，就会互不同步；必须一次抽样、派生整轮。单音还因此有 38% 概率正确答案不在选项里。"
---

# 一轮题目的各部分不能在各自的 useState 里各抽各的随机数

## 背景

练耳应用各模块的题目由「目标 + 选项」组成。单音与音程模块原本这样初始化：

```tsx
const [root, setRoot] = useState(() => pickRoot())
const [semitones, setSemitones] = useState(() => pickSemitones(allowed))
const [second, setSecond] = useState(() => computeSecond(pickRoot(), pickSemitones(allowed)))
const [options, setOptions] = useState(() =>
  pickOptions(Interval.fromSemitones(pickSemitones(allowed)), allowedIntervals),
)
```

每一条都调用了自己的随机函数。

## 经过

看截图时发现反馈写着「正确答案是 小三度」，而四个选项是 纯四度 / 大六度 / 纯五度 / 大七度 —— **正确项根本不在选项里**。顺着查下去：

- **音程**：`root`（播放的第一个音）、`semitones`（答案键）、`second`（播放的第二个音）、`options` 是四套独立随机，新开一题时三者互不相干。同一个模块的 `startRound()`（点「下一题」时调用）却写得是对的：抽一次、派生全部 —— 所以只有**会话首题**坏掉，用「下一题」或错题本种子路径测都测不出来。
- **单音**：`target` 一次随机、`options` 另一次随机，13 个音的池子里取 8 个 → 目标音约 38% 概率不在选项里，那题无法答对。白键模式池子正好 8 个（slice(0,8) 取全部），所以历史上从未触发。

## 结论

一轮题目的所有随机量必须在**一次抽样**里产生，从一个显式的 round 对象派生：

```tsx
interface IntervalRound { root: string; semitones: number; second: string; options: string[] }

function createRound(seed, allowedSemitones, allowedIntervals): IntervalRound {
  const root = seed?.root ?? pickRoot()
  const semitones = seed?.semitones ?? pickSemitones(allowedSemitones)
  return {
    root, semitones,
    second: computeSecond(root, semitones),
    options: pickOptions(Interval.fromSemitones(semitones), allowedIntervals),
  }
}

const [round, setRound] = useState(() => createRound(seed, allowedSemitones, allowedIntervals))
```

选项生成也顺手改成「一定包含正确答案」（先取干扰项、再把答案并进去打乱），而不是「从池子里随机取 N 个」——后者的隐含假设是「答案碰巧在里面」。

## 原因

- `useState(() => ...)` 的初始化函数各跑各的，彼此看不到对方的结果；代码读起来像「一组初始化」，实际是「多次独立掷骰」。
- 类型检查、lint、构建全过 —— 这类 bug 只在运行时、按概率暴露。
- **靠人眼看截图抓到的**：只要有正确项的反馈文案与选项列表同屏，缺失就一目了然。这也说明前端缺单元测试：这类纯函数（`createRound` / `makeMelodyQuestion`）本该有断言「答案 ∈ 选项」的测试。

## 参考

- `apps/web/src/components/exercises/{single-note,interval}-exercise.tsx`
- 验证方式：浏览器里连开 12 轮、点击选项、从反馈里解析正确答案、断言它在选项文案中（修复后三个模块均 12/12）
