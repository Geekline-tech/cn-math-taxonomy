import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, process.env.DATA_DIR || 'public/data')
const outFile = join(root, 'public/data/stats.json')

const readJson = async (name) => JSON.parse(await readFile(join(dataDir, name), 'utf8'))

const SUBJECTS = [
  { key: 'math', prefix: 'cnm_', label: '数学', std: ['cms-2022', 'cms-2017'] },
  { key: 'chinese', prefix: 'cnc_', label: '语文', std: ['ccs-2022'] },
  { key: 'english', prefix: 'cne_', label: '英语', std: ['ces-2022', 'ces-2017'] },
  { key: 'physics', prefix: 'cnp_', label: '物理', std: ['cps-2022', 'cps-hs-2017'] },
]

const JUNIOR = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

function gradeLabel(subject, grade) {
  if (grade <= 9) return `${JUNIOR[grade - 1]}年级`
  if (subject === 'english') {
    const names = ['必修一', '必修二', '必修三', '选必一', '选必二', '选必三', '选必四']
    return names[grade - 10] || `${grade} 年级`
  }
  const names = ['高一', '高二', '选必一', '选必二', '选必三', '选必四']
  return names[grade - 10] || `${grade} 年级`
}

function stageOf(subject, grade) {
  if (grade <= 6) return 'primary'
  if (grade <= 9) return 'junior'
  return 'senior'
}

const [topics, deps, questions, standards] = await Promise.all([
  readJson('topics.json'),
  readJson('dependencies.json'),
  readJson('questions.json'),
  readJson('cn-curriculum-standards.json'),
])

const subjects = {}
for (const s of SUBJECTS) {
  const own = topics.filter((t) => t.id.startsWith(s.prefix))
  const ids = new Set(own.map((t) => t.id))
  const edges = deps.filter((e) => ids.has(e.topicId))
  const qs = questions.filter((q) => ids.has(q.topicId))

  const grades = new Map()
  for (const t of own) {
    const g = grades.get(t.grade) || { grade: t.grade, count: 0 }
    g.count += 1
    grades.set(t.grade, g)
  }

  const domains = new Map()
  for (const t of own) {
    domains.set(t.domain, (domains.get(t.domain) || 0) + 1)
  }

  subjects[s.key] = {
    key: s.key,
    label: s.label,
    topics: own.length,
    edges: {
      total: edges.length,
      hard: edges.filter((e) => e.strength === 'hard').length,
      soft: edges.filter((e) => e.strength === 'soft').length,
    },
    questions: qs.length,
    standards: standards.items.filter((i) => s.std.some((p) => i.id.startsWith(`${p}:`))).length,
    grades: [...grades.values()]
      .sort((a, b) => a.grade - b.grade)
      .map((g) => ({ ...g, label: gradeLabel(s.key, g.grade), stage: stageOf(s.key, g.grade) })),
    domains: [...domains.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'public/data',
  subjects,
}

await mkdir(dirname(outFile), { recursive: true })
await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

const summary = Object.values(subjects)
  .map((s) => `${s.label} ${s.topics} 点 / ${s.edges.total} 边 / ${s.questions} 题`)
  .join('，')
console.log(`stats.json 已生成：${summary}`)
