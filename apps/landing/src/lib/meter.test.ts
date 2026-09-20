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

const trace = () => {
  const points: [number, number][] = []
  let strokes = 0
  const context = {
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter' as CanvasLineJoin,
    lineCap: 'butt' as CanvasLineCap,
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {
      points.length = 0
    },
    moveTo: (x: number, y: number) => points.push([x, y]),
    lineTo: (x: number, y: number) => points.push([x, y]),
    stroke: () => {
      strokes += 1
    },
  }
  const canvas = { clientWidth: 64, clientHeight: 32, width: 0, height: 0 }
  return { points, context, canvas, strokes: () => strokes }
}

test('silence is one flat line on the floor', () => {
  const { points, context, canvas, strokes } = trace()
  drawMeter(context, canvas, [0, 0, 0], 'ink')
  assert.equal(strokes(), 1, 'one continuous trace, not a bar each')
  assert.equal(points.length, 3)
  assert.deepEqual(
    points.map(([, y]) => y),
    [31, 31, 31],
    'a flat line one pixel above the bottom of the strip',
  )
  assert.deepEqual(points[0], [0, 31], 'starting at the left edge')
  assert.deepEqual(points[2], [64, 31], 'and ending at the right one')
  assert.equal(canvas.width, 64, 'and the backing store is sized to the strip')
  assert.equal(context.lineWidth, 1.5)
})

test('the trace follows the values, top to bottom', () => {
  const { points, context, canvas, strokes } = trace()
  drawMeter(context, canvas, [1, 0.5, 0], 'ink')
  assert.equal(strokes(), 1)
  assert.deepEqual(
    points.map(([, y]) => y),
    [1, 16, 31],
    'full height one pixel below the top, half way up, and silence on the floor',
  )
  assert.deepEqual(
    points.map(([x]) => x),
    [0, 32, 64],
    'evenly across the strip',
  )
  assert.equal(context.strokeStyle, 'ink')

  // a single point cannot be a line, but must not divide by zero either
  const one = trace()
  drawMeter(one.context, one.canvas, [0.5], 'ink')
  assert.deepEqual(one.points, [[0, 16]])
})
