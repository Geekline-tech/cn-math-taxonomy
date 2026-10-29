import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const base = process.env.BASE_URL || 'https://origin.new.tg'
const out = 'docs/screenshots'
await mkdir(out, { recursive: true })

const bank = JSON.parse(await readFile('public/data/questions-math.json', 'utf8'))
const byPrompt = new Map()
for (const question of Array.isArray(bank) ? bank : bank.questions) {
  if (typeof question.prompt === 'string' && question.prompt.trim()) {
    byPrompt.set(question.prompt.trim(), question)
  }
}
const prompts = [...byPrompt.keys()].sort((a, b) => b.length - a.length)

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []

async function newPage(width = 1280, height = 820) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  return page
}

async function findQuestion(page) {
  const text = await page.locator('.ant-card').first().innerText().catch(() => '')
  const lines = text.split('\n').map((line) => line.trim())
  const hit = lines.find((line) => byPrompt.has(line))
  return hit ? byPrompt.get(hit) : null
}

async function answerOne(page, question, correct) {
  const isChoice = question.type === 'choice' && question.choices?.length
  if (isChoice) {
    const keys = question.choices.map((choice) => choice.key)
    const wrong = keys.find((key) => key !== question.answer) ?? keys[0]
    const key = correct ? question.answer : wrong
    const index = keys.indexOf(key)
    await page.locator('.ant-radio-wrapper').nth(index).click()
  } else {
    const box = page.locator('.ant-card textarea').first()
    await box.fill(correct ? String(question.answer ?? '') : '不会')
  }
  await page.waitForTimeout(120)
  await page.getByRole('button', { name: /提\s*交/ }).first().click()
  await page.waitForTimeout(220)
}

const desktop = await newPage()

await desktop.goto(`${base}/`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(1800)
await desktop.screenshot({ path: `${out}/home.png` })

await desktop.goto(`${base}/explore?subject=math&id=cnm_221`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(2600)
await desktop.screenshot({ path: `${out}/explore.png` })

await desktop.evaluate(() => {
  const child = { id: 'c1', name: '小星', grade: '八年级', textbook: '人教版', createdAt: new Date().toISOString() }
  localStorage.setItem('cnmChildren.v1', JSON.stringify({ v: 1, current: 'c1', children: [child] }))
  localStorage.removeItem('cnmChildren.records.v1')
})

await desktop.goto(`${base}/diagnose?target=cnm_221`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(1600)

const next = desktop.getByRole('button', { name: /下一\s*题/ })
const view = desktop.getByRole('button', { name: /查看\s*结果/ })
const result = desktop.getByText('诊断结果：')

let answered = 0
for (let step = 0; step < 48; step += 1) {
  if (await result.count()) break
  if (await next.count()) {
    await next.click()
    await desktop.waitForTimeout(160)
    continue
  }
  if (await view.count()) {
    await view.click()
    await desktop.waitForTimeout(260)
    continue
  }
  const question = await findQuestion(desktop)
  if (!question) break
  await answerOne(desktop, question, answered >= 4)
  answered += 1
}

await desktop.waitForTimeout(1500)
await desktop.screenshot({ path: `${out}/diagnose.png` })

const aiButton = desktop.getByRole('button', { name: /AI\s*讲解/ }).first()
if (await aiButton.count()) {
  await aiButton.scrollIntoViewIfNeeded()
  await aiButton.click()
  await desktop.waitForTimeout(9000)
  await desktop.screenshot({ path: `${out}/ai.png` })
  await desktop.keyboard.press('Escape')
}

await desktop.goto(`${base}/children`, { waitUntil: 'networkidle' })
await desktop.waitForTimeout(1600)
await desktop.screenshot({ path: `${out}/children.png` })

const mobile = await newPage(390, 844)
await mobile.goto(`${base}/`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(1800)
await mobile.screenshot({ path: `${out}/mobile.png` })

await mobile.goto(`${base}/explore?subject=math&id=cnm_221`, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(2200)
await mobile.screenshot({ path: `${out}/mobile-explore.png` })

console.log('截图完成，答题', answered, '题，错误:', errors.slice(0, 3))
await browser.close()
