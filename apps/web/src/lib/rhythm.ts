export const BPM = 100
export const TAP_TOLERANCE = 0.2

export function toTransportTime(quarterNotes: number): string {
  const sixteenths = Math.round(quarterNotes * 4)
  const bars = Math.floor(sixteenths / 16)
  const quarters = Math.floor((sixteenths % 16) / 4)
  const sixteenth = sixteenths % 4
  return `${bars}:${quarters}:${sixteenth}`
}

export function getExpectedTimes(pattern: number[], beatDuration: number): number[] {
  let cumulative = 0
  return pattern.map((dur) => {
    const time = cumulative * beatDuration
    cumulative += dur
    return time
  })
}

export function countMatches(expected: number[], actual: number[], tolerance: number): number {
  const used = new Set<number>()
  let matched = 0
  for (const target of expected) {
    let bestIndex = -1
    let bestDiff = Infinity
    for (let i = 0; i < actual.length; i++) {
      if (used.has(i)) continue
      const diff = Math.abs(actual[i] - target)
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff
        bestIndex = i
      }
    }
    if (bestIndex !== -1) {
      used.add(bestIndex)
      matched++
    }
  }
  return matched
}

export function generatePattern(length: number, durations: number[]): number[] {
  if (durations.length === 0) durations = [1]
  const pattern: number[] = []
  let remaining = length
  while (remaining > 0) {
    const choices = durations.filter((d) => d <= remaining)
    const dur = choices[Math.floor(Math.random() * choices.length)] ?? Math.min(...durations)
    pattern.push(dur)
    remaining -= dur
  }
  return pattern
}
