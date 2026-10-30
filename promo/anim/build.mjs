import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = JSON.parse(fs.readFileSync(path.join(here, '..', 'graph3d.json'), 'utf8'))

const SUBJ = { math: 0, chinese: 1, english: 2, physics: 3 }
const LIMIT = 240
const keep = new Set(src.path)

const order = src.nodes.slice().sort((a, b) => b.deg - a.deg)
for (const n of order) {
  if (keep.size >= LIMIT) break
  keep.add(n.i)
}

const picked = src.nodes.filter((n) => keep.has(n.i))
const index = new Map(picked.map((n, i) => [n.i, i]))

let maxR = 0
for (const n of picked) {
  const r = Math.hypot(n.p[0], n.p[1], n.p[2])
  if (r > maxR) maxR = r
}

const nodes = picked.map((n) => [
  +(n.p[0] / maxR).toFixed(3),
  +(n.p[1] / maxR).toFixed(3),
  +(n.p[2] / maxR).toFixed(3),
  SUBJ[n.subject],
  n.grade,
  n.deg,
])

const edges = []
for (const [a, b] of src.edges) {
  if (index.has(a) && index.has(b)) edges.push([index.get(a), index.get(b)])
}

const pathIdx = src.path.filter((i) => index.has(i)).map((i) => index.get(i))
const pathNames = src.pathNames.slice(-1)

const payload = {
  n: nodes,
  e: edges,
  p: pathIdx,
  pn: pathNames,
  stat: src.stats,
}

const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
const outDir = path.join(here, '..', '..', 'animations', 'origin-promo')
fs.mkdirSync(outDir, { recursive: true })
const html = tpl.replace('/*__GRAPH__*/null', JSON.stringify(payload))
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8')

console.log('nodes', nodes.length, 'edges', edges.length, 'path', pathIdx.length)
console.log('out', path.join(outDir, 'index.html'), html.length, 'bytes')
