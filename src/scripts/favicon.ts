/**
 * Animates the tab icon: the logo's two coins drift apart and back until they
 * overlap as they do in the mark, two people's money counted as one.
 *
 * We decided to draw it on a canvas and swap the icon's href each frame,
 * because browsers don't run animations inside a favicon SVG.
 */

const SIZE = 64
const RADIUS = 19
const BLUE = "#2341F5"
const CORAL = "#FF6A3D"
const LENS = "#231B3B"

/** How far apart the centres are, from the mark's overlap to nearly apart. */
const NEAR = RADIUS
const FAR = RADIUS * 1.55

const FRAMES = 36
const INTERVAL = 70

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

/**
 * Lays out one frame: a full loop eases the coins apart and back together.
 *
 * @param frame - The frame's index in the loop.
 *
 * @returns The distance between the two centres.
 */
function distance(frame: number): number {
  const wave = (1 - Math.cos((frame / FRAMES) * Math.PI * 2)) / 2
  return NEAR + (FAR - NEAR) * wave
}

/**
 * Draws the two coins and, where they overlap, the dark lens between them.
 *
 * @param context - The canvas's 2d context.
 * @param gap - The distance between the two centres.
 */
function draw(context: CanvasRenderingContext2D, gap: number) {
  const middle = SIZE / 2
  const left = middle - gap / 2
  const right = middle + gap / 2

  context.clearRect(0, 0, SIZE, SIZE)

  for (const [x, colour] of [
    [left, BLUE],
    [right, CORAL],
  ] as const) {
    context.beginPath()
    context.arc(x, middle, RADIUS, 0, Math.PI * 2)
    context.fillStyle = colour
    context.fill()
  }

  // The lens is drawn from both circles' arcs and stroked in its own colour,
  // so the edges it shares with them don't leave a fringe at tab size.
  const angle = Math.acos(gap / 2 / RADIUS)
  context.beginPath()
  context.arc(left, middle, RADIUS, -angle, angle)
  context.arc(right, middle, RADIUS, Math.PI - angle, Math.PI + angle)
  context.closePath()
  context.fillStyle = LENS
  context.strokeStyle = LENS
  context.lineWidth = 1.5
  context.fill()
  context.stroke()
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
    draw(context, distance(frame))
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
