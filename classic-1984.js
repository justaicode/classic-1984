/**
 * Classic 1984 — the colour recipe and the 1-bit photo, as plain ES modules.
 *
 * Lifted from Ekybe's src/lib/classic.ts, which took the colour recipe
 * unchanged from Agentrix so every app tints alike. If you change a number
 * here, change it in all of them, or the apps stop matching.
 */

/** Paper has no hue: it is strength 0, plain black and white. */
export const CLASSIC_TINTS = [
  { key: 'paper', label: 'Paper', hue: null },
  { key: 'green', label: 'Green', hue: 135 },
  { key: 'teal', label: 'Teal', hue: 180 },
  { key: 'blue', label: 'Blue', hue: 215 },
  { key: 'amber', label: 'Amber', hue: 35 },
]

/** Black and white, the night look on, real photos. */
export const CLASSIC_DEFAULT = { hue: 135, strength: 0, night: true, avatars: 'photo' }

export const CLASSIC_AVATARS = [
  { value: 'colour', label: 'Colour tiles', hint: 'Initials on each person’s colour' },
  { value: 'ink', label: 'Ink only', hint: 'Initials in a dotted frame' },
  { value: 'photo', label: 'Real photos', hint: 'Profile photos in colour' },
  { value: 'bit', label: '1-bit photos', hint: 'Profile photos as dots, like MacPaint' },
]

/**
 * The two colours from a hue (0–359) and a strength (0–100).
 *
 * Strength 0 is #000 on #fff by day and #fff on #000 at night, whatever the
 * hue. Strength 100 is a dark ink on a pale tinted paper by day, and a light
 * glowing ink on a near-black tinted paper at night.
 */
export function classicColors({ hue, strength }, night) {
  const k = Math.max(0, Math.min(100, strength)) / 100
  const r = (n) => Math.round(n * 10) / 10
  return night
    ? { paper: `hsl(${hue} ${r(45 * k)}% ${r(6 * k)}%)`, ink: `hsl(${hue} ${r(80 * k)}% ${r(100 - 32 * k)}%)` }
    : { paper: `hsl(${hue} ${r(35 * k)}% ${r(100 - 9 * k)}%)`, ink: `hsl(${hue} ${r(60 * k)}% ${r(15 * k)}%)` }
}

/** Anything stored (JSON, a database column) made whole and sane. */
export function normalizeClassic(v) {
  const o = v && typeof v === 'object' ? v : {}
  const num = (n, lo, hi, d) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d)
  return {
    hue: num(o.hue, 0, 359, CLASSIC_DEFAULT.hue),
    strength: num(o.strength, 0, 100, CLASSIC_DEFAULT.strength),
    night: typeof o.night === 'boolean' ? o.night : CLASSIC_DEFAULT.night,
    avatars: CLASSIC_AVATARS.some((a) => a.value === o.avatars) ? o.avatars : CLASSIC_DEFAULT.avatars,
  }
}

/** Which preset these prefs are, if any — for marking a swatch as chosen. */
export const classicTintKey = (p) => (p.strength === 0 ? 'paper' : CLASSIC_TINTS.find((t) => t.hue === p.hue)?.key ?? null)

/**
 * Put the colours on an element (normally <html>, which carries class="c84").
 * Night applies only when the person allows it AND the system is dark.
 */
export function applyClassic(el, prefs, systemDark) {
  const p = normalizeClassic(prefs)
  const night = p.night && systemDark
  const c = classicColors(p, night)
  el.style.setProperty('--ink', c.ink)
  el.style.setProperty('--paper', c.paper)
  el.toggleAttribute('data-c84-night', night)
  return c
}

/**
 * Keep an element in step with the system's light and dark. Returns a stop
 * function.
 */
export function followSystem(el, getPrefs) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const run = () => applyClassic(el, getPrefs(), mq.matches)
  run()
  mq.addEventListener('change', run)
  return () => mq.removeEventListener('change', run)
}

/** The reader's message text size: five steps around 1. */
export const TEXT_SIZES = [
  { step: -2, label: 'Smaller', scale: 0.86 },
  { step: -1, label: 'Small', scale: 0.93 },
  { step: 0, label: 'Default', scale: 1 },
  { step: 1, label: 'Large', scale: 1.15 },
  { step: 2, label: 'Largest', scale: 1.32 },
]
export function applyTextSize(el, step) {
  const t = TEXT_SIZES.find((s) => s.step === step) ?? TEXT_SIZES[2]
  el.style.setProperty('--c84-text-scale', String(t.scale))
}

/**
 * A photo as 1-bit dots: Atkinson dithering, what MacPaint used, at one dot per
 * CSS pixel so it reads as 1984 rather than as a blur.
 *
 * Returns a data-URL MASK (opaque where the ink goes), not a picture: show it
 * as `mask-image` over a box filled with var(--ink), and the same dots work in
 * every tint and at night without being worked out again. Cached per photo
 * and size. The photo must be served with CORS, or the canvas is tainted and
 * this rejects — keep showing the photo then.
 */
const masks = new Map()
const ATKINSON = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]
export function ditherMask(url, size) {
  const key = `${size}|${url}`
  let hit = masks.get(key)
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onerror = () => reject(new Error('photo did not load'))
      img.onload = () => {
        try {
          const w = size
          const h = size
          const cv = document.createElement('canvas')
          cv.width = w
          cv.height = h
          const g = cv.getContext('2d')
          // cover-crop, the way the avatar shows it
          const s = Math.min(img.naturalWidth, img.naturalHeight)
          g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, w, h)
          const d = g.getImageData(0, 0, w, h)
          const px = d.data
          const lum = new Float32Array(w * h)
          for (let i = 0; i < w * h; i++) lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const i = y * w + x
              const v = lum[i] < 128 ? 0 : 255
              // Atkinson passes on 6/8 of the error, not all of it: highlights
              // and shadows clip clean, which is the MacPaint look.
              const e = (lum[i] - v) / 8
              lum[i] = v
              for (const [dx, dy] of ATKINSON) {
                const xx = x + dx
                const yy = y + dy
                if (xx >= 0 && xx < w && yy < h) lum[yy * w + xx] += e
              }
            }
          for (let i = 0; i < w * h; i++) px.set([0, 0, 0, lum[i] ? 0 : 255], i * 4)
          g.putImageData(d, 0, 0)
          resolve(cv.toDataURL())
        } catch (e) {
          reject(e)
        }
      }
      img.src = url
    })
    hit.catch(() => masks.delete(key))
    masks.set(key, hit)
  }
  return hit
}

/** Fill a `.c84-avatar.is-bit` element with a photo's dots. */
export async function renderBitAvatar(el, url) {
  const size = el.clientWidth || 34
  const mask = await ditherMask(url, size)
  const i = el.querySelector('i') ?? el.appendChild(document.createElement('i'))
  i.style.webkitMaskImage = `url(${mask})`
  i.style.maskImage = `url(${mask})`
}
