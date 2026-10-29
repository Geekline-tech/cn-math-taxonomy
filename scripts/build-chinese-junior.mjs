import { readFile, writeFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'

const DATA = 'public/data'
const SRC = 'data-src'
const SUBJECT = 'chinese'
const GRADE_OF = { 七: 7, 八: 8 }
const CODE_OF = { 阅读理解: 'YD', 古诗文积累: 'GS', 习作基础: 'XZ', 名著阅读: 'MZ' }

const WY = [
  '咏雪', '陈太丘与友期行', '《论语》十二章', '诫子书', '狼', '孙权劝学', '卖油翁',
  '陋室铭', '爱莲说', '三峡', '答谢中书书', '记承天寺夜游', '与朱元思书',
  '得道多助，失道寡助', '富贵不能淫', '生于忧患，死于安乐', '愚公移山', '周亚夫军细柳',
  '桃花源记', '小石潭记', '核舟记', '北冥有鱼', '庄子与惠子游于濠梁之上',
  '虽有嘉肴', '大道之行也', '马说', '活板',
]
const XW = ['消息二则', '中国人首次进入自己的空间站', '首届诺贝尔奖颁发', '「飞天」凌空', '一着惊海天', '国行公祭，为佑世界和平']
const SM = ['中国石拱桥', '苏州园林', '人民英雄永垂不朽', '梦回繁华', '大自然的语言', '恐龙无处不有', '被压扁的沙子', '月亮是从哪里来的', '时间的脚印']
const YL = ['纪念白求恩', '有为有不为', '敬业与乐业', '应有格物致知精神', '最后一次讲演', '我一生中的重要抉择']
const XS = ['小圣施威降大圣', '台阶', '驿路梨花', '带上她的眼睛', '社戏']
const POEM = ['黄河颂', '假如生活欺骗了你', '未选择的路']

const TRACK = {
  wy: { label: '文言文', reason: (a, b) => `同属文言文，先读《${a}》，再读《${b}》，在已积累的实词与句式上继续。` },
  gs: { label: '古诗词', reason: (a, b) => `同属诗歌，先读《${a}》，再读《${b}》，在已建立的意象与手法上继续积累。` },
  jy: { label: '记叙类文本', reason: (a, b) => `同属记叙类文本，先读《${a}》，再读《${b}》，继续练人物、细节与情感的表达。` },
  xs: { label: '小说', reason: (a, b) => `同属小说，先读《${a}》，再读《${b}》，继续练情节、人物与叙述视角。` },
  sw: { label: '说明文', reason: (a, b) => `同属说明文，先读《${a}》，再读《${b}》，继续练说明顺序与说明方法。` },
  xw: { label: '新闻', reason: (a, b) => `同属新闻作品，先读《${a}》，再读《${b}》，继续练新闻的结构与语言。` },
  yj: { label: '议论性文章', reason: (a, b) => `同属议论性文章，先读《${a}》，再读《${b}》，继续练观点、论据与论证。` },
}

const base = (name) => name.replace(/（[^（）]*）$/, '')
const set = (list) => new Set(list)

const WY_SET = set(WY)
const XW_SET = set(XW)
const SM_SET = set(SM)
const YL_SET = set(YL)
const XS_SET = set(XS)
const POEM_SET = set(POEM)

function trackOf(item) {
  const key = base(item.name)
  if (WY_SET.has(key)) return 'wy'
  if (XW_SET.has(key)) return 'xw'
  if (SM_SET.has(key)) return 'sw'
  if (YL_SET.has(key)) return 'yj'
  if (XS_SET.has(key)) return 'xs'
  if (item.domain === '古诗文积累' || POEM_SET.has(key)) return 'gs'
  return 'jy'
}

const read = async (file) => JSON.parse(await readFile(`${DATA}/${file}`, 'utf8'))

const files = readdirSync(SRC)
  .filter((name) => name.startsWith('chinese-junior-') && name.endsWith('.json'))
  .sort()

const topics = []
const dependencies = []
const questions = []
const lastOfTrack = new Map()

for (const file of files) {
  const book = JSON.parse(await readFile(`${SRC}/${file}`, 'utf8'))
  let previous = null
  for (const item of book.topics) {
    const match = /^([七八])年级([上下])册 (第\d+单元) (.+)$/.exec(item.chapter)
    if (!match) throw new Error(`章节格式不对：${item.chapter}`)
    const [, gradeChar, semester] = match
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

    const track = trackOf(item)
    const last = lastOfTrack.get(track)
    if (last) {
      dependencies.push({
        topicId: item.id,
        prerequisiteId: last.id,
        strength: 'hard',
        reason: TRACK[track].reason(base(last.name), base(item.name)),
      })
    }
    lastOfTrack.set(track, item)

    item.qs.forEach((q, index) => {
      if (q.o.length !== 4) throw new Error(`${item.id} 选项不是 4 个`)
      if (!['A', 'B', 'C', 'D'].includes(q.a)) throw new Error(`${item.id} 答案不是 ABCD`)
      const keys = ['A', 'B', 'C', 'D']
      questions.push({
        id: `${item.id}_q${index + 1}`,
        topicId: item.id,
        difficulty: q.d,
        type: 'choice',
        prompt: q.p,
        choices: q.o.map((text, i) => ({ key: keys[i], text })),
        answer: q.a,
        explanation: q.e,
        verify: JSON.stringify(q.o[keys.indexOf(q.a)]),
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

const primary = keptTopics.filter((topic) => topic.subject === SUBJECT)
const lastOf = (test) => primary.filter(test).reduce((best, topic) => (topic.id > best ? topic.id : best), '')
const lastModern = lastOf((topic) => topic.domain !== '古诗文积累')
const lastPoem = lastOf((topic) => topic.domain === '古诗文积累')
const lastWenyan = lastOf((topic) => /文言/.test(topic.name))

const idOf = (name) => topics.find((topic) => base(topic.name) === name)?.id

const curated = [
  ['阿长与《山海经》', '从百草园到三味书屋', '同为鲁迅的回忆性散文，先读百草园的童年视角，再读阿长身上由厌到敬的情感转折。'],
  ['藤野先生', '阿长与《山海经》', '同为鲁迅写人的散文，先练通过具体事件写一个人，再练把个人遭遇放到时代背景里写。'],
  ['社戏', '藤野先生', '先能读懂回忆性散文里的「我」，再读小说里虚构的「我」，注意叙述视角的差别。'],
  ['白杨礼赞', '井冈翠竹', '同属托物言志的散文，先读由竹及人，再读由树及人，注意象征的层层递进。'],
  ['紫藤萝瀑布', '雨的四季', '同属写景散文，先练把景写活，再练由景入理、从花写到人。'],
  ['昆明的雨', '紫藤萝瀑布', '先练借景抒情，再练用平淡的语言写出味道，体会「淡而有味」。'],
  ['龟虽寿', '观沧海', '同为曹操的四言诗，先读吞吐日月的胸襟，再读老当益壮的进取。'],
  ['石壕吏', '春望', '同为杜甫写安史之乱的诗，先读国破之痛，再读官府抓丁之惨。'],
  ['马说', '生于忧患，死于安乐', '同为议论性文言，先学在说理中层层推进，再学托物寓意、以马喻人。'],
  ['核舟记', '活板', '同为说明性文言，先读程序说明，再读空间说明，注意说明顺序的不同。'],
]

const extra = curated
  .map(([target, source, reason]) => ({ topicId: idOf(target), prerequisiteId: idOf(source), strength: 'hard', reason }))
  .filter((edge) => edge.topicId && edge.prerequisiteId)

const anchors = [
  { topicId: idOf('春'), prerequisiteId: lastModern, reason: '小学阶段的记叙文读完，进入初中第一课写景散文，继续练写景的顺序与感官角度。' },
  { topicId: idOf('咏雪'), prerequisiteId: lastWenyan, reason: '小学已读过《学弈》等浅易文言，初中第一篇文言文在此基础上练「言」与「文」并重。' },
  { topicId: idOf('观沧海'), prerequisiteId: lastPoem, reason: '小学积累的古诗词读完，初中第一首古诗在已有的意象与朗读经验上继续。' },
  { topicId: idOf('消息二则'), prerequisiteId: idOf('驿路梨花'), reason: '消息的六要素来自记叙文要素，先能读清一件事，再学用最简省的话报道一件事。' },
  { topicId: idOf('中国石拱桥'), prerequisiteId: idOf('白杨礼赞'), reason: '状物要先抓住特征，说明文在此基础上把特征说得准确、有条理。' },
  { topicId: idOf('纪念白求恩'), prerequisiteId: idOf('从百草园到三味书屋'), reason: '议论要从记叙中提炼观点，先能读懂一篇记叙文的主旨，再学直接表明看法。' },
]
  .filter((edge) => edge.topicId && edge.prerequisiteId)
  .map((edge) => ({ ...edge, strength: 'hard' }))
  .concat(extra)

const merged = []
const seenEdge = new Set()
for (const edge of [...anchors, ...dependencies]) {
  const key = `${edge.topicId}<${edge.prerequisiteId}`
  if (seenEdge.has(key)) continue
  seenEdge.add(key)
  merged.push(edge)
}

const dump = (value) => `${JSON.stringify(value, null, 2)}\n`

await writeFile(`${DATA}/topics.json`, dump([...keptTopics, ...topics]))
await writeFile(`${DATA}/dependencies.json`, dump([...keptDeps, ...merged]))
await writeFile(`${DATA}/questions.json`, dump([...keptQuestions, ...questions]))

const hard = merged.filter((dep) => dep.strength === 'hard').length
console.log('新增知识点', topics.length, '先修边', merged.length, `（硬 ${hard} / 软 ${merged.length - hard}）`, '题目', questions.length)
console.log('文体分布', [...lastOfTrack.keys()].map((key) => `${TRACK[key].label}${topics.filter((topic) => trackOf({ name: topic.name, domain: topic.domain }) === key).length}`).join(' '))
