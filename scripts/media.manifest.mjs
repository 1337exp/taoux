// What the media pipeline captures. Edit this file, run `npm run media`.
//
// Every target is a sandbox page plus a CSS selector. Names become file names, so keep them stable:
// the READMEs and the website link to them.

/** Page language for every capture. */
export const LANG = 'en'

/** Theme variants for screenshots. */
export const THEMES = ['dark', 'light']

/**
 * Still images.
 *   page      sandbox page (sandbox/<page>.html), 'index' by default
 *   selector  element to crop to (omit: the whole viewport)
 *   pad       extra pixels around the element [top, right, bottom, left]
 *   before    optional async (page, h) => void
 */
export const shots = [
  { name: 'overview', page: 'curveeditor' },
  { name: 'curveeditor', page: 'curveeditor', selector: '.grid .case', pad: [8, 8, 8, 8] },
  { name: 'curvefield', page: 'curvefield', selector: '.grid .case', pad: [8, 8, 8, 8] },
  { name: 'gradienteditor', page: 'gradienteditor', selector: '.case', pad: [8, 8, 8, 8] },
  { name: 'playback', page: 'playback', selector: '.grid', pad: [8, 8, 8, 8] },
  { name: 'color', page: 'color', selector: '.grid', pad: [8, 8, 8, 8] },
  { name: 'slider', page: 'slider', selector: '.grid .case', pad: [8, 8, 8, 8] },
]

/**
 * Short loops for the website and the README (mp4 + animated WebP + a poster frame).
 *   page / crop / pad  as in shots ('viewport' keeps the whole 1280x720 frame; 'all:<selector>' = union of matches)
 *   prepare            async (page, h) => void: run before recording starts
 *   steps              async (page, h) => void: the interaction, recorded
 * Keep them under ~8 seconds: they are a taste, not a tutorial.
 */
export const clips = [
  {
    name: 'curveeditor',
    page: 'curveeditor',
    crop: '.grid .case',
    pad: [8, 8, 8, 8],
    prepare: (page, h) => h.scrollTo(page, '.grid .case .tx-curve'),
    steps: async (page, h) => {
      const plot = page.locator('.grid .case').first().locator('.tx-curve')
      const box = await h.box(plot)
      const dots = page.locator('.grid .case').first().locator('.tx-curve-dot')
      const dot = await h.box(dots.nth(1))
      const cx = dot.x + dot.width / 2
      const cy = dot.y + dot.height / 2
      await h.drag(page, [cx, cy], [cx + 70, cy - 20])
      await h.drag(page, [cx + 70, cy - 20], [cx - 40, cy + 40])
      await page.mouse.dblclick(box.x + box.width * 0.72, box.y + box.height * 0.3)
      await page.waitForTimeout(500)
      const added = await h.box(dots.nth(2))
      await h.drag(page, [added.x + added.width / 2, added.y + added.height / 2], [added.x + added.width / 2 + 30, added.y + added.height / 2 + 90])
      await page.waitForTimeout(500)
    },
  },
  {
    name: 'gradienteditor',
    page: 'gradienteditor',
    crop: '.case',
    pad: [8, 8, 8, 8],
    prepare: (page, h) => h.scrollTo(page, '.case .tx-gradient'),
    steps: async (page, h) => {
      const bar = await h.box(page.locator('.tx-gradient').first())
      await page.mouse.click(bar.x + bar.width * 0.28, bar.y + bar.height / 2)
      await page.waitForTimeout(600)
      const stops = page.locator('.tx-gradient-stop')
      const stop = await h.box(stops.nth(1))
      await h.drag(page, [stop.x + stop.width / 2, stop.y + stop.height / 2], [bar.x + bar.width * 0.45, stop.y + stop.height / 2])
      await page.mouse.click(bar.x + bar.width * 0.8, bar.y + bar.height / 2)
      await page.waitForTimeout(800)
    },
  },
  {
    name: 'playback',
    page: 'playback',
    crop: '.grid',
    pad: [8, 8, 8, 8],
    prepare: (page, h) => h.scrollTo(page, '.grid .case'),
    steps: async (page, h) => {
      const first = page.locator('.grid .case').first()
      await first.locator('.tao-scrubber__controls button').first().click()
      await page.waitForTimeout(2200)
      const thumb = await h.box(first.locator('[role="slider"]').first())
      const track = await h.box(first.locator('.tao-scrubber__track'))
      await h.drag(page, [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2], [track.x + track.width * 0.2, thumb.y + thumb.height / 2])
      await page.waitForTimeout(1200)
    },
  },
  {
    name: 'curvefield',
    page: 'curvefield',
    crop: '.grid .case',
    pad: [8, 8, 8, 8],
    prepare: (page, h) => h.scrollTo(page, '.grid .case .tx-curve'),
    steps: async (page, h) => {
      const dots = page.locator('.grid .case').first().locator('.tx-curve-dot')
      const dot = await h.box(dots.nth(1))
      const cx = dot.x + dot.width / 2
      const cy = dot.y + dot.height / 2
      await h.drag(page, [cx, cy], [cx + 90, cy + 30])
      await h.drag(page, [cx + 90, cy + 30], [cx - 60, cy - 10])
      await page.waitForTimeout(600)
    },
  },
]
