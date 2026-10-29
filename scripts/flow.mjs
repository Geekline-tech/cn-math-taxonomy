import { chromium } from 'playwright-core'

const base = process.env.BASE_URL || 'http://localhost:4173'
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(String(error)))

await page.goto(`${base}/diagnose?target=cnm_221`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const next = page.getByRole('button', { name: /下一\s*题/ })
const skip = page.getByRole('button', { name: /不\s*会/ })
const view = page.getByRole('button', { name: /查看\s*结果/ })
const result = page.getByText('诊断结果：')

for (let step = 0; step < 40; step += 1) {
  if (await result.count()) break
  if (await next.count()) {
    await next.click()
    await page.waitForTimeout(180)
    continue
  }
  if (await view.count()) {
    await view.click()
    await page.waitForTimeout(300)
    continue
  }
  if (await skip.count()) {
    await skip.click()
    await page.waitForTimeout(220)
    continue
  }
  console.log('stuck at step', step)
  break
}

await page.waitForTimeout(1200)
await page.screenshot({ path: '.shots/diagnose-result.png', fullPage: true })
console.log('result visible:', (await result.count()) > 0)
console.log('errors:', errors.slice(0, 5))

await browser.close()
