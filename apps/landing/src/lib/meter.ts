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
  fillStyle: unknown
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  fillRect(x: number, y: number, w: number, h: number): void
}

/** Paint the meter: square bars standing on the floor of the strip, in the theme's ink.
 *  A bar of no height is not drawn at all, so silence leaves the strip empty rather than
 *  drawing a row of nothing. */
export function drawMeter(
  context: MeterContext,
  canvas: MeterCanvas,
  heights: number[],
  ink: string,
  ratio = 1,
) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = ink
  const gap = 1
  const bar = (width - gap * (heights.length - 1)) / heights.length
  heights.forEach((value, index) => {
    const tall = Math.round(value * height)
    if (tall > 0) context.fillRect(index * (bar + gap), height - tall, bar, tall)
  })
}
