import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(here, '..', '..', 'animations', 'origin-promo', 'index.html')
const outDir = path.join(here, '..', 'out', 'frames')
const FPS = 30
const DUR = 38

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('file:///' + html.replace(/\\/g, '/') + '?t=0')
await page.waitForFunction('typeof window.__frame === "function"')

const total = Math.round(DUR * FPS)
const t0 = Date.now()
for (let f = 0; f < total; f++) {
  const data = await page.evaluate((tt) => {
    window.__frame(tt)
    return document.getElementById('cv').toDataURL('image/jpeg', 0.93)
  }, f / FPS)
  const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
  fs.writeFileSync(path.join(outDir, 'f' + String(f).padStart(5, '0') + '.jpg'), buf)
  if (f % 120 === 0) {
    const el = ((Date.now() - t0) / 1000).toFixed(1)
    console.log('frame', f, '/', total, el + 's')
  }
}

console.log('done', total, 'frames', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'errors', JSON.stringify(errors.slice(0, 3)))
await browser.close()
