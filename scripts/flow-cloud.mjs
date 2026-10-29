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
await page.waitForTimeout(900)

const next = page.getByRole('button', { name: /下一\s*题/ })
const skip = page.getByRole('button', { name: /不\s*会/ })
const view = page.getByRole('button', { name: /查看\s*结果/ })
const result = page.getByText('诊断结果：')

for (let step = 0; step < 40; step += 1) {
  if (await result.count()) break
  if (await next.count()) {
    await next.click()
    await page.waitForTimeout(160)
    continue
  }
  if (await view.count()) {
    await view.click()
    await page.waitForTimeout(280)
    continue
  }
  if (await skip.count()) {
    await skip.click()
    await page.waitForTimeout(200)
    continue
  }
  break
}
await page.waitForTimeout(900)
console.log('到达结果页:', (await result.count()) > 0)

const aiButtons = page.getByRole('button', { name: /AI\s*讲解/ })
const aiCount = await aiButtons.count()
console.log('根因列表 AI 按钮数:', aiCount)

if (aiCount) {
  await aiButtons.first().click()
  await page.waitForTimeout(500)
  const dialog = page.locator('.ant-modal').filter({ hasText: 'AI 讲解' })
  const loading = await dialog.getByText('正在按这道题的错误点讲解').count()
  console.log('弹出讲解框:', (await dialog.count()) > 0, '| 加载中:', loading > 0)
  await page.waitForTimeout(9000)
  const body = await dialog.innerText()
  console.log('讲解文本长度:', body.length)
  console.log('讲解片段:', body.replace(/\s+/g, ' ').slice(0, 160))
  await page.screenshot({ path: '.shots/ai-explain.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

await page.goto(`${base}/children`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
if (!(await page.getByText('小满').count())) {
  await page.getByRole('button', { name: /新建\s*孩子/ }).click()
  await page.waitForTimeout(400)
  await page.locator('.ant-modal input#name').fill('小满')
  await page.locator('.ant-modal .ant-select').first().click()
  await page.waitForTimeout(300)
  await page.locator('.ant-select-dropdown .ant-select-item-option').filter({ hasText: '七年级' }).first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /保\s*存/ }).click()
  await page.waitForTimeout(800)
}
const cloudBtn = page.getByRole('button', { name: /云\s*端/ })
console.log('云端按钮存在:', (await cloudBtn.count()) > 0)
await cloudBtn.click()
await page.waitForTimeout(300)
await page.locator('.ant-dropdown-menu-item').filter({ hasText: '备份到云端' }).click()
await page.waitForTimeout(4500)
const codeText = await page.locator('.ant-modal').filter({ hasText: '已备份到云端' }).locator('span').filter({ hasText: /^[A-Z0-9]{8}$/ }).first().innerText({ timeout: 5000 }).catch(() => '')
console.log('同步码:', codeText)
await page.screenshot({ path: '.shots/cloud-backup.png' })
await page.getByRole('button', { name: /知道了/ }).click()
await page.waitForTimeout(400)

if (codeText) {
  await cloudBtn.click()
  await page.waitForTimeout(300)
  await page.locator('.ant-dropdown-menu-item').filter({ hasText: '从云端恢复' }).click()
  await page.waitForTimeout(400)
  await page.locator('.ant-modal input').last().fill(codeText)
  await page.getByRole('button', { name: /读取并合并/ }).click()
  await page.waitForTimeout(2500)
  const confirm = await page.getByText('确认合并导入').count()
  console.log('出现合并确认:', confirm > 0)
  if (confirm) {
    await page.getByRole('button', { name: /合并导入/ }).click()
    await page.waitForTimeout(1200)
    console.log('合并后提示:', await page.locator('.ant-message').innerText().catch(() => ''))
  }
}

console.log('错误:', errors.slice(0, 6))
await browser.close()
