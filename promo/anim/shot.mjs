import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(here, '..', '..', 'animations', 'origin-promo', 'index.html')
const outDir = path.join(here, '..', 'out')
fs.mkdirSync(outDir, { recursive: true })

const times = process.argv.slice(2).map(Number)
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

for (const t of times) {
  await page.goto('file:///' + html.replace(/\\/g, '/') + '?t=' + t)
  await page.waitForTimeout(260)
  const file = path.join(outDir, 'a_' + String(t).replace('.', '_') + '.png')
  await page.locator('#cv').screenshot({ path: file })
  console.log('shot', t, fs.statSync(file).size)
}
await browser.close()
console.log('errors', JSON.stringify(errors.slice(0, 4)))
