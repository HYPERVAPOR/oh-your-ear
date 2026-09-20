---
date: "2026-09-21"
category: "decision"
tags: ["webaudio", "playback", "architecture"]
summary: "提前排进音频时钟的音符，取消定时器停不掉：每次播放给一条总线，停止 = 摘掉总线"
---

# 排程播放的"停止"必须摘总线，不能取消定时器

卷帘窗的播放是**一次把整小节的音符全排进音频时钟**（`playNote(freq, when)`，`when` 是 `AudioContext.currentTime` 上的绝对时间）—— 好处是音符落点由音频硬件决定，不受 JS 定时器抖动影响。

代价：**停止按钮按下去没反应**。原来"停止"只做了 `cancelAnimationFrame`（停游标）+ `setPlaying(false)`，但音符已经在 Web Audio 的排程队列里，照响不误 —— 用户的原话是"按了也只能听完"。

## 解法：每次播放一条总线

`lib/keys.ts` 加 `createBus()`（一个连到 `destination` 的 `GainNode`），`playNote(freq, when, bus?)` 把音色的输出接到 `bus ?? destination`。播放时建一条新总线、整小节都从它出；停止时 `bus.disconnect()` —— 所有已排程的音符瞬间无声（振荡器仍会自己 `stop()`，只是没了出口）。

不用逐音符登记 + `.stop()`，也不需要 master gain 门限（门限只静音不取消，重新开闸时排程中的音符会**回来**）。

## 验证方式

音频在截图里看不见，所以用临时探针页（import `/src/lib/keys.ts`，钩住 `AudioNode.prototype.connect/disconnect`）核对图接线：
`ROUTED_THROUGH_BUS=10 TO_DESTINATION=1 DISCONNECTS=1`。

## 顺带

WSL 里够不到 Windows Chrome 的 `--remote-debugging-port`（loopback 不通，`localhost` 也不行），CDP 那条路走不通；**让页面自己当探针、结果写进 DOM、再 `--dump-dom` 读回来**是这台机器上验证浏览器行为的可行办法。
