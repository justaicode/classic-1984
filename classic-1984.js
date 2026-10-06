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

/**
 * A 1984 menu: a context menu at a point, or a pull-down under an element.
 * Ported from Agentrix's showClassicMenu (version B, approved 4 Oct 2026).
 *
 *   const id = await showMenu([
 *     { id: 'edit', label: 'Edit project…', icon: '/icons/pencil.svg' },
 *     { separator: true },
 *     { id: 'sort', label: 'Sort by', submenu: [
 *         { id: 'name', label: 'Name', checked: true },
 *         { id: 'date', label: 'Date', checked: false } ] },
 *     { id: 'del', label: 'Delete…', enabled: false },
 *   ], { x: e.clientX, y: e.clientY })        // or { anchor: buttonElement }
 *
 * Items: { id, label, icon?, checked?, enabled?, key?, submenu? },
 * { separator: true } or { heading: 'Text' }. `icon` is an image URL used as a
 * mask (so it takes the ink and reverses with the row) or an inline <svg> string
 * drawn in currentColor. Resolves with the chosen id, or null.
 *
 * Behaviour, all of it from the 1984 menus:
 * - It opens below and right of the point, flipped back inside the window if
 *   it would run off. Submenus open to the side, or to the left at the edge.
 * - The row under the pointer is reversed. A press can be dragged down the menu
 *   and released on an item, or a click opens it and a second click chooses.
 * - Keys: ↑ ↓ move (skipping separators and disabled rows), → opens a submenu,
 *   ← closes it, Return or Space chooses, Esc closes one level.
 * - A press outside closes the menu and does nothing else: that click is eaten.
 * - Leaving the window closes it.
 */
const MENU_CHECK = '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3"/></svg>'
const MENU_ARROW = '<svg viewBox="0 0 8 10" width="7" height="9" aria-hidden="true"><path d="M1 0l6 5-6 5z" fill="currentColor"/></svg>'
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
let openMenu = null

export function closeMenu() {
  openMenu?.(null)
}

export function showMenu(items, { x = 40, y = 40, anchor = null, root = document.body } = {}) {
  closeMenu()
  return new Promise((resolve) => {
    const stack = [] // open levels: { el, items, on }
    let done = false
    const usable = (i) => i && !i.separator && !i.heading && i.enabled !== false
    const finish = (id) => {
      if (done) return
      done = true
      for (const l of stack) l.el.remove()
      removeEventListener('keydown', onKey, true)
      removeEventListener('mousedown', onDown, true)
      removeEventListener('blur', onBlur)
      openMenu = null
      resolve(id ?? null)
    }
    const iconHtml = (i) =>
      !i.icon ? '<span class="c84-menu-icon"></span>'
      : i.icon.trim().startsWith('<svg') ? `<span class="c84-menu-icon">${i.icon}</span>`
      : `<span class="c84-menu-icon" style="-webkit-mask-image:url('${escHtml(i.icon)}');mask-image:url('${escHtml(i.icon)}')"></span>`
    const open = (list, px, py, from) => {
      const el = document.createElement('div')
      el.className = 'c84-menu'
      el.setAttribute('role', 'menu')
      const checks = list.some((i) => i.checked !== undefined)
      const icons = list.some((i) => i.icon)
      el.innerHTML = list
        .map((i, n) =>
          i.separator ? '<div class="c84-menu-sep" role="separator"></div>'
          : i.heading ? `<div class="c84-menu-head">${escHtml(i.heading)}</div>`
          : `<div class="c84-menu-item" role="menuitem" data-n="${n}"${i.enabled === false ? ' aria-disabled="true"' : ''}>` +
            (checks ? `<span class="c84-menu-check">${i.checked ? MENU_CHECK : ''}</span>` : '') +
            (icons ? iconHtml(i) : '') +
            `<span class="c84-menu-label">${escHtml(i.label ?? '')}</span>` +
            (i.key ? `<span class="c84-menu-key">${escHtml(i.key)}</span>` : '') +
            (i.submenu ? `<span class="c84-menu-sub">${MENU_ARROW}</span>` : '') +
            '</div>',
        )
        .join('')
      root.append(el)
      // Where it fits: below and right of the point, or flipped back inside.
      const r = el.getBoundingClientRect()
      const W = innerWidth
      const H = innerHeight
      let left = px
      let top = py
      if (from) {
        left = from.right - 2
        top = from.top - 3
        if (left + r.width > W - 4) left = from.left - r.width + 2
      }
      if (left + r.width > W - 4) left = Math.max(4, W - r.width - 4)
      if (top + r.height > H - 4) top = Math.max(4, (from ? from.bottom + 3 : py) - r.height)
      el.style.left = `${left}px`
      el.style.top = `${Math.max(4, top)}px`
      const level = { el, items: list, on: -1 }
      stack.push(level)
      el.addEventListener('mousemove', (e) => {
        const row = e.target.closest('.c84-menu-item')
        if (row) hover(stack.indexOf(level), +row.dataset.n)
      })
      el.addEventListener('mouseup', (e) => {
        const row = e.target.closest('.c84-menu-item')
        if (!row || row.getAttribute('aria-disabled') === 'true') return
        const it = list[+row.dataset.n]
        if (!it.submenu) finish(it.id)
      })
      return level
    }
    const rowOf = (level, n) => level.el.querySelector(`[data-n="${n}"]`)
    const hover = (depth, n) => {
      const level = stack[depth]
      if (!level || level.on === n) return
      while (stack.length > depth + 1) stack.pop().el.remove() // close deeper submenus
      level.on = n
      for (const row of level.el.querySelectorAll('.c84-menu-item')) row.classList.toggle('is-on', +row.dataset.n === n)
      const it = level.items[n]
      if (it?.submenu && usable(it)) open(it.submenu, 0, 0, rowOf(level, n).getBoundingClientRect())
    }
    const step = (level, dir) => {
      const list = level.items
      let n = level.on
      for (let k = 0; k < list.length; k++) {
        n = (n + dir + list.length) % list.length
        if (usable(list[n])) return n
      }
      return level.on
    }
    const onKey = (e) => {
      const depth = stack.length - 1
      const level = stack[depth]
      const it = level.items[level.on]
      if (e.key === 'Escape') {
        if (depth) stack.pop().el.remove()
        else finish(null)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') hover(depth, step(level, e.key === 'ArrowDown' ? 1 : -1))
      else if (e.key === 'ArrowRight') {
        if (it?.submenu && usable(it) && stack.length === depth + 1) open(it.submenu, 0, 0, rowOf(level, level.on).getBoundingClientRect())
        const sub = stack[depth + 1]
        if (sub) hover(depth + 1, step(sub, 1))
      } else if (e.key === 'ArrowLeft') {
        if (depth) stack.pop().el.remove()
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (usable(it)) {
          if (it.submenu) {
            const sub = stack[depth + 1] || open(it.submenu, 0, 0, rowOf(level, level.on).getBoundingClientRect())
            hover(depth + 1, step(sub, 1))
          } else finish(it.id)
        }
      }
      // The menu has the keyboard while it is open.
      e.preventDefault()
      e.stopPropagation()
    }
    // A press outside closes the menu and does nothing else.
    const onDown = (e) => {
      if (e.target.closest?.('.c84-menu')) return
      e.stopPropagation()
      e.preventDefault()
      const eat = (ev) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', eat, true), 800) // a drag never clicks
      finish(null)
    }
    const onBlur = () => finish(null)
    if (anchor) {
      // A pull-down hangs from its title: just below it, aligned to its left.
      const a = anchor.getBoundingClientRect()
      open(items, a.left - 1, a.bottom + 1)
    } else open(items, x, y)
    addEventListener('keydown', onKey, true)
    addEventListener('mousedown', onDown, true)
    addEventListener('blur', onBlur)
    openMenu = finish
  })
}

/**
 * A 1984 alert or confirmation: the double-bordered dialog box (§8.8), the
 * message in Chicago, a detail line under it, the buttons on the right.
 * Ported from Agentrix's showClassicDialog (Mac) and classicDialog (iPhone),
 * 6 Oct 2026.
 *
 *   const n = await showDialog({
 *     message: 'Move "Notes" to the Trash?',
 *     detail: 'You can restore it from the Trash.',
 *     buttons: ['Move to Trash', 'Cancel'],
 *     destructive: 0,                      // the button that deletes, if any
 *   })                                     // → 0, 1, or the cancel index on Esc
 *
 * Rules, from Roberto's choices:
 * - The default button (ringed, what Return presses) is always the rightmost.
 *   It's `defaultId` if given; when a button deletes (`destructive`), Cancel;
 *   otherwise the first button.
 * - Esc presses the cancel button: `cancelId`, else the one labelled Cancel,
 *   else the last.
 * - Nothing dims behind it and a press outside does nothing: a modal dialog
 *   waits for an answer. It appears at once, in the upper part of the window.
 * Resolves with the chosen button's index.
 */
export function showDialog({ message, detail = '', buttons = ['OK'], defaultId, cancelId, destructive, root = document.body } = {}) {
  return dialogBox({ message, detail, buttons, defaultId, cancelId, destructive, root }).then((r) => r.button)
}

/**
 * A text prompt (Rename…): the same box with a square field. Resolves with the
 * text when the confirming button is pressed (or Return in the field), else null.
 *
 *   const name = await showPrompt({ message: 'Rename chat', value: 'Old name', confirm: 'Rename' })
 */
export function showPrompt({ message, detail = '', value = '', placeholder = '', confirm = 'OK', cancel = 'Cancel', root = document.body } = {}) {
  return dialogBox({ message, detail, buttons: [cancel, confirm], defaultId: 1, cancelId: 0, field: { value, placeholder }, root })
    .then((r) => (r.button === 1 ? r.value : null))
}

function dialogBox({ message, detail, buttons, defaultId, cancelId, destructive, field, root }) {
  closeMenu()
  const cancelAt = cancelId ?? (buttons.findIndex((b) => /^cancel$/i.test(b)) + 1 || buttons.length) - 1
  const def = defaultId ?? (destructive != null ? cancelAt : 0)
  const order = buttons.map((_, i) => i).filter((i) => i !== def).concat(def)
  return new Promise((resolve) => {
    const layer = document.createElement('div')
    layer.className = 'c84-dialog-layer'
    layer.innerHTML =
      `<div class="c84-dialog is-alert" role="alertdialog" aria-modal="true" aria-label="${escHtml(message)}">` +
      `<div class="c84-dialog-message">${escHtml(message)}</div>` +
      (detail ? `<div class="c84-dialog-detail">${escHtml(detail)}</div>` : '') +
      (field ? `<input class="c84-field c84-dialog-field" value="${escHtml(field.value || '')}" placeholder="${escHtml(field.placeholder || '')}">` : '') +
      `<div class="c84-dialog-buttons">${order.map((i) => `<button class="c84-button${i === def ? ' is-default' : ''}" data-n="${i}">${escHtml(buttons[i])}</button>`).join('')}</div></div>`
    const input = layer.querySelector('input')
    const finish = (button) => {
      layer.remove()
      removeEventListener('keydown', onKey, true)
      resolve({ button, value: input ? input.value.trim() : undefined })
    }
    const onKey = (e) => {
      if (e.key === 'Enter') finish(def)
      else if (e.key === 'Escape') finish(cancelAt)
      else return // typing in the field goes through
      e.preventDefault()
      e.stopPropagation()
    }
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]')
      if (b) finish(+b.dataset.n)
    })
    root.append(layer)
    addEventListener('keydown', onKey, true)
    if (input) {
      input.focus()
      input.select()
    } else layer.querySelector('.is-default')?.focus()
  })
}
