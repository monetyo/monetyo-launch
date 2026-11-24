import tokens from "@monetyo/brand/tokens.json" with { type: "json" }

/**
 * Animates the tab icon: the logo's coin and house drift apart along the
 * diagonal and back until they overlap as they do in the mark.
 *
 * We decided to draw it on a canvas and swap the icon's href each frame,
 * because browsers don't run animations inside a favicon SVG.
 */

const SIZE = 64
const BLUE = tokens.color.blue["500"]
const CORAL = tokens.color.coral["500"]
const LENS = tokens.color.lens

/** The mark's shapes, in the 24-unit grid of @monetyo/brand's `logos/mark.svg`. */
const COIN = { x: 9, y: 9, radius: 9 }
const HOUSE = [
  [9, 23],
  [9, 14.5],
  [16, 8.3],
  [23, 14.5],
  [23, 23],
] as const
const ROUNDING = 2

/** How far the house drifts at the loop's widest, in grid units per axis. */
const DRIFT = 2.5
const SCALE = SIZE / (24 + DRIFT)

const FRAMES = 36
const INTERVAL = 70

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

/**
 * Lays out one frame: a full loop eases the shapes apart and back together.
 *
 * @param frame - The frame's index in the loop.
 *
 * @returns How far the house sits from its place in the mark, in grid units.
 */
function offset(frame: number): number {
  const wave = (1 - Math.cos((frame / FRAMES) * Math.PI * 2)) / 2
  return DRIFT * wave
}

/**
 * Draws the coin, the house and, where they overlap, the dark space they
 * share.
 *
 * @param context - The canvas's 2d context.
 * @param shift - How far the house sits from its place in the mark.
 */
function draw(context: CanvasRenderingContext2D, shift: number) {
  const coin = new Path2D()
  coin.arc(COIN.x, COIN.y, COIN.radius, 0, Math.PI * 2)

  const house = new Path2D()
  for (const [x, y] of HOUSE) house.lineTo(x + shift, y + shift)
  house.closePath()

  const margin = (SIZE - (24 + shift) * SCALE) / 2

  context.clearRect(0, 0, SIZE, SIZE)
  context.save()
  context.translate(margin, margin)
  context.scale(SCALE, SCALE)
  context.lineJoin = "round"
  context.lineWidth = ROUNDING

  context.fillStyle = CORAL
  context.strokeStyle = CORAL
  context.fill(house)
  context.stroke(house)

  context.fillStyle = BLUE
  context.fill(coin)

  // The shared space is the house again, cut to the coin. Drawn over the coin
  // rather than the house, its edges leave no coral fringe.
  context.clip(coin)
  context.fillStyle = LENS
  context.strokeStyle = LENS
  context.fill(house)
  context.stroke(house)

  context.restore()
}

/**
 * Plays the loop in the tab for as long as the page is visible, and puts the
 * static icon back for anyone who turns on reduced motion meanwhile.
 *
 * @param link - The `<link rel="icon">` whose href is swapped each frame.
 * @param canvas - The offscreen canvas each frame is drawn to.
 * @param context - That canvas's 2d context.
 */
function animate(
  link: HTMLLinkElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
) {
  const declared = { href: link.href, type: link.type }
  let frame = 0
  let timer = 0

  const paint = () => {
    draw(context, offset(frame))
    link.href = canvas.toDataURL("image/png")
  }

  const stop = () => {
    window.clearInterval(timer)
    timer = 0
  }

  const start = () => {
    if (timer || document.hidden || reducedMotion.matches) return

    link.type = "image/png"
    timer = window.setInterval(() => {
      frame = (frame + 1) % FRAMES
      paint()
    }, INTERVAL)
  }

  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return start()

    stop()
    link.type = declared.type
    link.href = declared.href
  })

  document.addEventListener("visibilitychange", () =>
    document.hidden ? stop() : start()
  )

  start()
}

/**
 * Takes the tab's icon over, unless the Visitor asked for less motion, who
 * keeps the sharp static SVG the document declares.
 */
function initFavicon() {
  if (reducedMotion.matches) return

  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext("2d")
  if (!link || !context) return

  animate(link, canvas, context)
}

initFavicon()
