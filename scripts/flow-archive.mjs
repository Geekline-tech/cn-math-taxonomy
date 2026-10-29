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

const loaded = []
page.on('response', async (response) => {
  const url = response.url()
  if (!url.includes('/assets/')) return
  const length = Number(response.headers()['content-length'] || 0)
  loaded.push({ file: url.split('/assets/')[1], length })
})

await page.goto(`${base}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const homeTotal = loaded.reduce((sum, item) => sum + item.length, 0)
console.log('首页加载文件数:', loaded.length, '总计', (homeTotal / 1024).toFixed(1), 'KB')
console.log('首页是否拉取图组件:', loaded.some((item) => /use-graph|xyflow/.test(item.file)))
console.log('首页文件:', loaded.map((item) => `${item.file}(${(item.length / 1024).toFixed(0)}K)`).join(' '))

await page.goto(`${base}/children`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /新建\s*孩子/ }).click()
await page.waitForTimeout(400)
await page.locator('.ant-modal input#name').fill('小满')
await page.locator('.ant-modal .ant-select').first().click()
await page.waitForTimeout(300)
await page.locator('.ant-select-dropdown .ant-select-item-option').filter({ hasText: '七年级' }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /保\s*存/ }).click()
await page.waitForTimeout(600)
const childCreated = await page.getByText('小满').count()
console.log('孩子档案已创建:', childCreated > 0)

await page.goto(`${base}/diagnose?target=cnm_221`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

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
  console.log('诊断卡在第', step, '步')
  break
}

await page.waitForTimeout(1000)
console.log('到达结果页:', (await result.count()) > 0)
const savedAlert = await page.getByText(/已存入「小满」的学习档案/).count()
console.log('结果页提示已存档:', savedAlert > 0)
await page.screenshot({ path: '.shots/diagnose-saved.png', fullPage: true })

await page.goto(`${base}/children`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const recordRow = await page.getByText(/掌握 \d+ · 不稳 \d+ · 薄弱 \d+/).count()
console.log('档案页出现诊断记录:', recordRow)
await page.screenshot({ path: '.shots/children-record.png', fullPage: true })

console.log('错误:', errors.slice(0, 5))
await browser.close()
