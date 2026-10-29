import { readFile, writeFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'

const DATA = 'public/data'
const SRC = 'data-src'
const SUBJECT = 'chinese'
const GRADE_OF = { 七: 7, 八: 8 }
const CODE_OF = { 阅读理解: 'YD', 古诗文积累: 'GS', 习作基础: 'XZ', 名著阅读: 'MZ' }

const read = async (file) => JSON.parse(await readFile(`${DATA}/${file}`, 'utf8'))

const files = readdirSync(SRC)
  .filter((name) => name.startsWith('chinese-junior-') && name.endsWith('.json'))
  .sort()

const topics = []
const dependencies = []
const questions = []

for (const file of files) {
  const book = JSON.parse(await readFile(`${SRC}/${file}`, 'utf8'))
  let previous = null
  for (const item of book.topics) {
    const match = /^([七八])年级([上下])册 (第\d+单元) (.+)$/.exec(item.chapter)
    if (!match) throw new Error(`章节格式不对：${item.chapter}`)
    const [, gradeChar, semester, unit, section] = match
    const code = CODE_OF[item.domain]
    if (!code) throw new Error(`未知领域：${item.domain}`)

    topics.push({
      id: item.id,
      name: item.name,
      domain: item.domain,
      grade: GRADE_OF[gradeChar],
      semester,
      chapter: item.chapter,
      type: item.type,
      description: item.desc,
      mastery_criteria: item.m,
      diagnostic_question: { question: item.dq[0], answer: item.dq[1] },
      external: false,
      subject: SUBJECT,
      standards: [
        {
          id: `ccs-2022:4.${code}.01`,
          confidence: 'inferred',
          note: '第四学段（7—9 年级）的常见教学内容。编号由本图谱自编，内容为公开转述，未逐页核对教材原文。',
        },
      ],
    })

    if (previous) {
      dependencies.push({
        topicId: item.id,
        prerequisiteId: previous.id,
        strength: 'soft',
        reason: `按统编教材的编排顺序，先学「${previous.name}」，再学「${item.name}」。`,
      })
    }
    previous = item

    item.qs.forEach((q, index) => {
      if (q.o.length !== 4) throw new Error(`${item.id} 选项不是 4 个`)
      if (!['A', 'B', 'C', 'D'].includes(q.a)) throw new Error(`${item.id} 答案不是 ABCD`)
      const keys = ['A', 'B', 'C', 'D']
      const answerText = q.o[keys.indexOf(q.a)]
      questions.push({
        id: `${item.id}_q${index + 1}`,
        topicId: item.id,
        difficulty: q.d,
        type: 'choice',
        prompt: q.p,
        choices: q.o.map((text, i) => ({ key: keys[i], text })),
        answer: q.a,
        explanation: q.e,
        verify: JSON.stringify(answerText),
      })
    })
  }
}

const allTopics = await read('topics.json')
const allDeps = await read('dependencies.json')
const allQuestions = await read('questions.json')

const newIds = new Set(topics.map((topic) => topic.id))
const keptTopics = allTopics.filter((topic) => !newIds.has(topic.id))
const keptDeps = allDeps.filter((dep) => !newIds.has(dep.topicId))
const keptQuestions = allQuestions.filter((question) => !newIds.has(question.topicId))

const lastPrimary = keptTopics
  .filter((topic) => topic.subject === SUBJECT)
  .reduce((best, topic) => (topic.id > best ? topic.id : best), '')
const bridge = lastPrimary
  ? [
      {
        topicId: topics[0].id,
        prerequisiteId: lastPrimary,
        strength: 'soft',
        reason: `小学语文读完，进入统编七年级上册，先学「${topics[0].name}」。`,
      },
    ]
  : []

const dump = (value) => `${JSON.stringify(value, null, 2)}\n`

await writeFile(`${DATA}/topics.json`, dump([...keptTopics, ...topics]))
await writeFile(`${DATA}/dependencies.json`, dump([...keptDeps, ...bridge, ...dependencies]))
await writeFile(`${DATA}/questions.json`, dump([...keptQuestions, ...questions]))

console.log('新增知识点', topics.length, '先修边', dependencies.length + bridge.length, '题目', questions.length)
console.log('知识库总量', keptTopics.length + topics.length)
