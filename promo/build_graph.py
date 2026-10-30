import json, math, os, random
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'public', 'data')
OUT = os.path.join(ROOT, 'promo', 'graph3d.json')

SUBJECT_OF = {'math': 'math', 'chinese': 'chinese', 'english': 'english', 'physics': 'physics'}
QUOTA = {'math': 168, 'chinese': 104, 'english': 104, 'physics': 54}
SEED = 20261031

rng = random.Random(SEED)
nprng = np.random.default_rng(SEED)

topics = json.load(open(os.path.join(DATA, 'topics.json'), encoding='utf-8'))
deps = json.load(open(os.path.join(DATA, 'dependencies.json'), encoding='utf-8'))

by_id = {}
for t in topics:
    sid = t.get('subject') or 'math'
    if sid not in SUBJECT_OF:
        continue
    by_id[t['id']] = {
        'id': t['id'],
        'name': t.get('name', ''),
        'subject': sid,
        'grade': int(t.get('grade') or 1),
        'domain': t.get('domain', ''),
    }

edges_all = [(e['prerequisiteId'], e['topicId'], e.get('strength', 'hard')) for e in deps
             if e.get('prerequisiteId') in by_id and e.get('topicId') in by_id]

deg = {}
for a, b, _ in edges_all:
    deg[a] = deg.get(a, 0) + 1
    deg[b] = deg.get(b, 0) + 1

pool = {'math': [], 'chinese': [], 'english': [], 'physics': []}
for nid, n in by_id.items():
    pool[n['subject']].append(nid)

chosen = []
for sid, quota in QUOTA.items():
    ids = pool[sid]
    ids.sort(key=lambda i: (-deg.get(i, 0), rng.random()))
    head = ids[: int(quota * 0.7)]
    tail = ids[int(quota * 0.7):]
    rng.shuffle(tail)
    chosen.extend(head + tail[: quota - len(head)])

adj_all = {}
for a, b, s in edges_all:
    adj_all.setdefault(a, []).append(b)


def find_math(name):
    for nid, n in by_id.items():
        if n['name'] == name and n['subject'] == 'math':
            return nid
    return None


src_id = find_math('有理数的分类')
dst_id = find_math('配方法')
path_ids = []
if src_id and dst_id:
    prev = {src_id: None}
    queue = [src_id]
    while queue:
        cur = queue.pop(0)
        if cur == dst_id:
            break
        for nxt in adj_all.get(cur, []):
            if nxt in prev or nxt not in by_id or by_id[nxt]['subject'] != 'math':
                continue
            prev[nxt] = cur
            queue.append(nxt)
    cur = dst_id
    while cur is not None:
        path_ids.append(cur)
        cur = prev.get(cur)
    path_ids.reverse()
    chosen.extend([nid for nid in path_ids if nid not in chosen])

chosen = sorted(set(chosen))
index = {nid: i for i, nid in enumerate(chosen)}
N = len(chosen)

edges = [(index[a], index[b], s) for a, b, s in edges_all if a in index and b in index]

grade = np.array([by_id[nid]['grade'] for nid in chosen], dtype=np.float64)
subject = np.array([by_id[nid]['subject'] for nid in chosen], dtype=object)

shell = np.where(grade <= 6, 2.15 + (grade - 1) * 0.16,
                 np.where(grade <= 9, 3.30 + (grade - 7) * 0.20,
                          4.10 + (grade - 10) * 0.22))

golden = math.pi * (3.0 - math.sqrt(5.0))
idx = np.arange(N, dtype=np.float64) + nprng.random(N) * 0.6
y = 1 - (idx / max(1.0, N - 1)) * 2
radius = np.sqrt(np.clip(1 - y * y, 0, 1))
theta = golden * idx
base = np.stack([np.cos(theta) * radius, y, np.sin(theta) * radius], axis=1)

pos = base * shell[:, None]
pos += nprng.normal(0, 0.28, pos.shape)
pos *= 1.0

ea = np.array([e[0] for e in edges], dtype=int)
eb = np.array([e[1] for e in edges], dtype=int)
ew = np.array([1.0 if e[2] == 'hard' else 0.55 for e in edges])

for it in range(260):
    delta = pos[eb] - pos[ea]
    dist = np.linalg.norm(delta, axis=1) + 1e-6
    target = 1.05
    force = (dist - target)[:, None] * 0.014 * ew[:, None]
    step = delta / dist[:, None] * force
    acc = np.zeros_like(pos)
    np.add.at(acc, ea, step)
    np.add.at(acc, eb, -step)

    diff = pos[:, None, :] - pos[None, :, :]
    d2 = (diff * diff).sum(axis=2) + 0.05
    rep = 0.055 / d2
    np.fill_diagonal(rep, 0.0)
    acc += (diff * rep[:, :, None]).sum(axis=1) / N

    norm = np.linalg.norm(pos, axis=1) + 1e-6
    acc += (shell - norm)[:, None] * (pos / norm[:, None]) * 0.05
    acc += nprng.normal(0, 0.006, pos.shape)
    pos += acc

norm = np.linalg.norm(pos, axis=1)
pos *= np.clip(4.85 / np.percentile(norm, 96), 0.6, 1.6)

CLUSTER_DIR = {
    'math': np.array([-0.62, 0.42, 0.10]),
    'chinese': np.array([0.62, 0.46, -0.08]),
    'english': np.array([-0.58, -0.48, -0.12]),
    'physics': np.array([0.58, -0.44, 0.14]),
}
CLUSTER_R = 4.35
cluster = np.zeros_like(pos)
for sid, d in CLUSTER_DIR.items():
    m = subject == sid
    d = d / np.linalg.norm(d)
    center = d * CLUSTER_R
    local = pos[m] - pos[m].mean(axis=0)
    ln = np.linalg.norm(local, axis=1) + 1e-6
    local = local / ln[:, None] * np.minimum(ln, 1.55)[:, None]
    cluster[m] = center + local * 0.95

path = path_ids


def r(v):
    return [round(float(x), 4) for x in v]

nodes = []
for i, nid in enumerate(chosen):
    n = by_id[nid]
    nodes.append({
        'i': i,
        'id': nid,
        'name': n['name'],
        'subject': n['subject'],
        'grade': n['grade'],
        'domain': n['domain'],
        'deg': deg.get(nid, 0),
        'p': r(pos[i]),
        'c': r(cluster[i]),
    })

payload = {
    'stats': {
        'topics': len(topics),
        'edges': len(deps),
        'math': sum(1 for t in topics if not t.get('subject')),
        'chinese': sum(1 for t in topics if t.get('subject') == 'chinese'),
        'english': sum(1 for t in topics if t.get('subject') == 'english'),
        'physics': sum(1 for t in topics if t.get('subject') == 'physics'),
    },
    'nodes': nodes,
    'edges': [[int(a), int(b), round(float(w), 2)] for a, b, w in zip(ea, eb, ew)],
    'path': [index[n] for n in path],
    'pathNames': [by_id[n]['name'] for n in path],
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)

print('nodes', len(nodes), 'edges', len(payload['edges']), 'path', payload['pathNames'])
print('stats', payload['stats'])
