#!/usr/bin/env node
/**
 * Media pipeline: screenshots and short clips of the sandbox, encoded for the READMEs and the website.
 *
 *   npm run media                    everything
 *   npm run media -- --only table    one target (a shot or a clip name)
 *   SHOWCASE_URL=http://localhost:5300 npm run media    use a running sandbox (npm run sandbox)
 *
 * Needs: Chrome or Edge installed (driven through playwright-core, nothing is downloaded) and ffmpeg on PATH.
 * Output: docs/media/screenshots/*.webp, docs/media/clips/*.{mp4,webp}, docs/media/posters/*.webp,
 *         docs/media/social-preview.png. Raw captures go to docs/media/.raw (git-ignored).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { LANG, THEMES, shots, clips } from './media.manifest.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA = join(ROOT, 'docs', 'media')
const RAW = join(MEDIA, '.raw')
const OUT = { shots: join(MEDIA, 'screenshots'), clips: join(MEDIA, 'clips'), posters: join(MEDIA, 'posters') }

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const VIEW = { width: 1440, height: 900 } // screenshots
const CLIP_VIEW = { width: 1280, height: 720 } // clips

for (const dir of [join(RAW, 'shots'), join(RAW, 'video'), ...Object.values(OUT)]) mkdirSync(dir, { recursive: true })

// ---------------------------------------------------------------- ffmpeg

function ffmpeg(argv) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8' })
  if (run.error?.code === 'ENOENT') throw new Error('ffmpeg is not on PATH')
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`)
}

const even = (n) => Math.max(2, Math.floor(n / 2) * 2)

function cropFilter(crop) {
  if (!crop) return 'null'
  const x = Math.max(0, Math.round(crop.x))
  const y = Math.max(0, Math.round(crop.y))
  const width = even(Math.min(crop.width, CLIP_VIEW.width - x))
  const height = even(Math.min(crop.height, CLIP_VIEW.height - y))
  return `crop=${width}:${height}:${x}:${y}`
}

function encodeShot(name) {
  ffmpeg(['-i', join(RAW, 'shots', `${name}.png`), '-c:v', 'libwebp', '-quality', '88', '-compression_level', '6', join(OUT.shots, `${name}.webp`)])
}

function encodeClip(name, meta) {
  const list = join(RAW, 'video', name, 'frames.txt')
  const crop = cropFilter(meta.crop)
  const input = ['-f', 'concat', '-safe', '0', '-i', list]
  // mp4 for the website: <video autoplay muted loop playsinline poster="...">
  ffmpeg([...input, '-vf', `${crop},fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-an',
    '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    join(OUT.clips, `${name}.mp4`)])
  // animated WebP for the READMEs (GitHub and npm do not autoplay <video> from a repository)
  ffmpeg([...input, '-vf', `${crop},fps=15,scale='min(760,iw)':-2:flags=lanczos`, '-an',
    '-c:v', 'libwebp', '-quality', '70', '-compression_level', '6', '-loop', '0',
    join(OUT.clips, `${name}.webp`)])
  // poster frame
  ffmpeg([...input, '-vf', crop, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '85',
    join(OUT.posters, `${name}.webp`)])
}

// ---------------------------------------------------------------- server + browser

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Sandbox did not come up at ${url}`)
}

async function startShowcase() {
  if (process.env.SHOWCASE_URL) return { url: process.env.SHOWCASE_URL, stop() {} }
  const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(vite)) throw new Error('Run `npm install` first')
  const port = 5188
  const child = spawn(process.execPath, [vite, '--config', 'vite.sandbox.config.ts', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  const url = `http://localhost:${port}`
  await waitFor(url)
  return { url, stop: () => child.kill() }
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      // try the next one
    }
  }
  throw new Error('Neither Chrome nor Edge could be launched')
}

// ---------------------------------------------------------------- helpers handed to the manifest

// A visible cursor: video recordings do not include the mouse.
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div')
    dot.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:rgba(255,255,255,.9);border:2px solid #14161a;box-shadow:0 1px 6px rgba(0,0,0,.45);left:-40px;top:-40px;transition:transform .08s'
    document.documentElement.appendChild(dot)
    addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { dot.style.transform = 'scale(.75)' }, true)
    addEventListener('mouseup', () => { dot.style.transform = '' }, true)
  })
`

const helpers = {
  async scrollTo(page, selector) {
    await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(350)
  },
  async box(locator) {
    const b = await locator.boundingBox()
    if (!b) throw new Error('Element has no box (is it visible?)')
    return b
  },
  async drag(page, from, to, steps = 28) {
    await page.mouse.move(from[0], from[1], { steps: 10 })
    await page.mouse.down()
    await page.mouse.move(to[0], to[1], { steps })
    await page.mouse.up()
    await page.waitForTimeout(250)
  },
  async setTheme(page, theme) {
    await page.evaluate((t) => {
      if (t === 'light') document.documentElement.dataset.taoTheme = 'light'
      else delete document.documentElement.dataset.taoTheme
    }, theme)
  },
}

async function openShowcase(context, url, theme, pageName = 'index') {
  const page = await context.newPage()
  await page.goto(`${url}/${pageName}.html?lang=${LANG}`)
  await page.waitForSelector('.page')
  await helpers.setTheme(page, theme)
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(500)
  return page
}

/**
 * Pixel rectangle of `selector` (plus padding), in document coordinates.
 * A selector starting with `all:` covers every match (their union), otherwise the first one.
 */
async function region(page, selector, pad = [0, 0, 0, 0]) {
  const union = selector.startsWith('all:')
  const locator = page.locator(union ? selector.slice(4) : selector)
  const rects = await locator.evaluateAll((els, all) => {
    const list = all ? els : els.slice(0, 1)
    return list.map((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
    })
  }, union)
  if (!rects.length) throw new Error(`no element matches ${selector}`)
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const [t, r, bt, l] = pad
  return { x: Math.max(0, left - l), y: Math.max(0, top - t), width: right - left + l + r, height: bottom - top + t + bt }
}

// ---------------------------------------------------------------- capture

const wanted = (item) => !only || item.name === only

async function captureShots(browser, url) {
  const done = []
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, reducedMotion: 'reduce' })
    for (const shot of shots.filter(wanted)) {
      const page = await openShowcase(context, url, theme, shot.page)
      const name = `${shot.name}-${theme}`
      try {
        if (shot.before) await shot.before(page, helpers)
        const path = join(RAW, 'shots', `${name}.png`)
        if (shot.selector) {
          await helpers.scrollTo(page, shot.selector)
          await page.screenshot({ path, fullPage: true, clip: await region(page, shot.selector, shot.pad) })
        } else {
          await page.screenshot({ path })
        }
        done.push(name)
        console.log(`shot  ${name}`)
      } catch (error) {
        console.error(`shot  ${name} FAILED: ${error.message}`)
        process.exitCode = 1
      } finally {
        await page.close()
      }
    }
    await context.close()
  }
  return done
}

/**
 * Records the page through the DevTools screencast instead of Playwright's video: no extra
 * binary to download, and frames carry real timestamps, so a still page costs nothing.
 */
async function startRecording(context, page, dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({ time: frame.metadata.timestamp, data: frame.data })
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: CLIP_VIEW.width, maxHeight: CLIP_VIEW.height, everyNthFrame: 1 })
  return {
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {})
      if (frames.length < 2) throw new Error('the screencast produced no frames')
      const lines = []
      frames.forEach((frame, i) => {
        const file = join(dir, `${String(i).padStart(5, '0')}.jpg`)
        writeFileSync(file, Buffer.from(frame.data, 'base64'))
        const next = frames[i + 1]?.time ?? frame.time + 0.6
        lines.push(`file '${file.replaceAll('\\', '/')}'`, `duration ${(next - frame.time).toFixed(4)}`)
      })
      lines.push(lines[lines.length - 2]) // the concat demuxer needs the last file repeated
      writeFileSync(join(dir, 'frames.txt'), lines.join('\n'))
      return frames.length
    },
  }
}

async function captureClips(browser, url) {
  const done = new Map()
  for (const clip of clips.filter(wanted)) {
    const context = await browser.newContext({ viewport: CLIP_VIEW, deviceScaleFactor: 1 })
    await context.addInitScript(CURSOR)
    try {
      const page = await openShowcase(context, url, 'dark', clip.page)
      await clip.prepare?.(page, helpers)
      // the region is measured once, before the interaction, and cropped from the whole frame
      const crop = clip.crop === 'viewport' ? null : await region(page, clip.crop, clip.pad)
      const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
      const frameCrop = crop && { ...crop, x: crop.x - scroll.x, y: crop.y - scroll.y }
      const recording = await startRecording(context, page, join(RAW, 'video', clip.name))
      const started = Date.now()
      await page.waitForTimeout(300)
      await clip.steps(page, helpers)
      await page.waitForTimeout(500)
      const count = await recording.stop()
      if (frameCrop && (frameCrop.x < 0 || frameCrop.y < 0 || frameCrop.x + frameCrop.width > CLIP_VIEW.width || frameCrop.y + frameCrop.height > CLIP_VIEW.height)) {
        console.warn(`clip  ${clip.name}: the crop (${Math.round(frameCrop.width)}x${Math.round(frameCrop.height)} at ${Math.round(frameCrop.x)},${Math.round(frameCrop.y)}) does not fit the ${CLIP_VIEW.width}x${CLIP_VIEW.height} frame and was clamped`)
      }
      done.set(clip.name, { crop: frameCrop })
      console.log(`clip  ${clip.name} (${((Date.now() - started) / 1000).toFixed(1)}s, ${count} frames)`)
    } catch (error) {
      console.error(`clip  ${clip.name} FAILED: ${error.message}`)
      process.exitCode = 1
    } finally {
      await context.close().catch(() => {})
    }
  }
  return done
}

// ---------------------------------------------------------------- main

async function main() {
  const server = await startShowcase()
  const browser = await launch()
  let shotNames = []
  let clipMeta = new Map()
  try {
    shotNames = await captureShots(browser, server.url)
    clipMeta = await captureClips(browser, server.url)
  } finally {
    await browser.close()
    server.stop()
  }

  for (const name of shotNames) encodeShot(name)
  for (const [name, meta] of clipMeta) encodeClip(name, meta)

  // GitHub social preview (1280x640), cut from the dark overview
  const overview = join(RAW, 'shots', 'overview-dark.png')
  if (shotNames.includes('overview-dark')) {
    ffmpeg(['-i', overview, '-vf', 'crop=iw:iw/2:0:0,scale=1280:640:flags=lanczos', join(MEDIA, 'social-preview.png')])
  }
  console.log('done → docs/media')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
