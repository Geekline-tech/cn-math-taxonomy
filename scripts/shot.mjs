import { chromium } from 'playwright-core'

const base = process.env.BASE_URL || 'http://localhost:4173'
const targets = [
  { name: 'home', path: '/', viewport: { width: 1440, height: 900 } },
  { name: 'home-mobile', path: '/', viewport: { width: 390, height: 844 } },
  { name: 'explore', path: '/explore?id=cnm_221', viewport: { width: 1440, height: 900 } },
  { name: 'explore-mobile', path: '/explore?id=cnm_221', viewport: { width: 390, height: 844 } },
  { name: 'diagnose', path: '/diagnose', viewport: { width: 1440, height: 900 } },
  { name: 'diagnose-quiz', path: '/diagnose?target=cnm_221', viewport: { width: 1440, height: 900 } },
  { name: 'children', path: '/children', viewport: { width: 1440, height: 900 } },
]

const browser = await chromium.launch({ channel: 'chrome' })

for (const target of targets) {
  const context = await browser.newContext({ viewport: target.viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(`${base}${target.path}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `.shots/${target.name}.png`, fullPage: true })
  if (errors.length) console.log(`[${target.name}] errors:`, errors.slice(0, 4))
  else console.log(`[${target.name}] ok`)
  await context.close()
}

await browser.close()
