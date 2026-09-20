/** The meter's bars, from the analyser's frequency data.
 *
 *  FFT bins are linear in frequency and hearing is not: grouped as they come, an octave of
 *  music lands in the first two bars and the rest of the strip is treble nobody is playing.
 *  The bars are log-spaced instead, so neighbouring bars are comparable intervals, which is
 *  what makes the strip read as a spectrum rather than as a left-hand smear. */
export function bars(values: Uint8Array, count: number): number[] {
  const bins = values.length
  return Array.from({ length: count }, (_, index) => {
    const from = Math.max(0, Math.floor(bins ** (index / count)) - 1)
    const to = Math.max(from + 1, Math.floor(bins ** ((index + 1) / count)))
    let peak = 0
    for (let bin = from; bin < to && bin < bins; bin++) peak = Math.max(peak, values[bin] ?? 0)
    return (peak / 255) ** 1.6
  })
}

/** What a canvas has to be able to do for the meter to draw on it — and nothing more, so a
 *  test can hand it a stub instead of a browser. */
export interface MeterCanvas {
  clientWidth: number
  clientHeight: number
  width: number
  height: number
}

export interface MeterContext {
  strokeStyle: unknown
  lineWidth: number
  lineJoin: CanvasLineJoin
  lineCap: CanvasLineCap
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
}

/** Paint the meter: the signal as one continuous trace, the way a spectrum analyser draws
 *  it, rather than a row of bars.
 *
 *  Straight segments between the points. A smoothed curve is prettier and lies about where
 *  the peaks are — the point of a folded line is that every sample is a corner you can see.
 *  The trace is inset a pixel from the top and the bottom so it neither clips nor sits on
 *  the cell's rule, and a flat line at the bottom is what silence looks like. */
export function drawMeter(
  context: MeterContext,
  canvas: MeterCanvas,
  heights: number[],
  ink: string,
  ratio = 1,
  weight = 1.5,
) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.strokeStyle = ink
  context.lineWidth = weight
  context.lineJoin = 'miter'
  context.lineCap = 'butt'
  context.beginPath()
  heights.forEach((value, index) => {
    const x = (index / Math.max(1, heights.length - 1)) * width
    const y = height - 1 - value * (height - 2)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
}
