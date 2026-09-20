import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bars, drawMeter } from './meter.ts'

const BINS = 256

const spike = (bin: number) => {
  const data = new Uint8Array(BINS)
  data[bin] = 255
  return data
}

test('silence draws nothing', () => {
  assert.deepEqual(
    bars(new Uint8Array(BINS), 8).filter((value) => value > 0),
    [],
  )
})

test('both ends of the spectrum can light a bar', () => {
  assert.equal(bars(spike(0), 8)[0], 1)
  assert.equal(bars(spike(BINS - 1), 8)[7], 1)
})

test('the bars are log-spaced, so the whole spectrum fits the strip', () => {
  // a spike walking up the bins can only ever move the lit bar to the right
  const landed = [0, 8, 40, 120, 255].map((bin) => bars(spike(bin), 8).findIndex((v) => v === 1))
  assert.deepEqual(
    landed,
    [...landed].sort((a, b) => a - b),
  )
  // and it starts at the left end and ends at the right one
  assert.equal(landed[0], 0)
  assert.equal(landed[landed.length - 1], 7)
})

test('bars stay inside the strip', () => {
  const loud = new Uint8Array(BINS).fill(255)
  for (const value of bars(loud, 20)) assert.ok(value >= 0 && value <= 1)
})

test('silence draws nothing and bars stand on the floor', () => {
  const calls: [number, number, number, number][] = []
  const context = {
    fillStyle: '',
    setTransform: () => {},
    clearRect: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => calls.push([x, y, w, h]),
  }
  const canvas = { clientWidth: 64, clientHeight: 32, width: 0, height: 0 }

  drawMeter(context, canvas, [0, 0, 0], 'ink')
  assert.deepEqual(calls, [], 'a zero-height bar is not drawn')
  assert.equal(canvas.width, 64, 'and the backing store is sized to the strip')

  // two neighbours, so the gap can be measured between bars that are both drawn
  drawMeter(context, canvas, [1, 0.5, 0], 'ink')
  assert.equal(calls.length, 2, 'the middle bar has height, the last one does not')
  const [full, half] = calls
  assert.equal(full[1] + full[3], 32, 'a full bar stands on the floor')
  assert.equal(half[1] + half[3], 32, 'and so does a half-height one')
  assert.equal(Math.round(half[3]), 16, 'half height is half the strip')
  assert.ok(full[0] < half[0], 'bars move left to right')
  assert.equal(half[0] - (full[0] + full[2]), 1, 'with exactly a one-pixel gap between them')

  // and at the count the meter actually draws, a bar is a couple of pixels and no more
  calls.length = 0
  drawMeter(
    context,
    canvas,
    Array.from({ length: 20 }, () => 1),
    'ink',
  )
  assert.equal(calls.length, 20)
  assert.ok(
    calls[0][2] > 1 && calls[0][2] < 3,
    `a bar is thin at 20 across 64px, got ${calls[0][2]}`,
  )
})
