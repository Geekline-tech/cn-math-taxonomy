import dagre from '@dagrejs/dagre'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Tag, theme, Typography } from 'antd'
import { useMemo } from 'react'
import type { Graph, Topic } from '@/engine/types'

export type Depth = 1 | 2 | 3 | 'all'

type TopicNodeData = {
  topic: Topic
  selected: boolean
  relation: 'self' | 'up' | 'down'
}

const NODE_WIDTH = 190
const NODE_HEIGHT = 62

const STAGE_COLOR = { primary: 'blue', junior: 'purple', senior: 'magenta' } as const

function stageOf(grade: number) {
  if (grade <= 6) return 'primary' as const
  if (grade <= 9) return 'junior' as const
  return 'senior' as const
}

function gradeLabel(topic: Topic) {
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (topic.grade <= 9) return `${names[topic.grade - 1] ?? ''}年级`
  return `高${topic.grade <= 11 ? '一' : '二'}`
}

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const { token } = theme.useToken()
  const { topic, selected, relation } = data

  return (
    <div
      style={{
        width: NODE_WIDTH,
        padding: '7px 10px',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        boxShadow: selected ? `0 0 0 2px ${token.colorPrimaryBorder}` : token.boxShadowTertiary,
      }}
    >
      <Typography.Text
        strong
        ellipsis
        style={{ display: 'block', fontSize: 13, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {topic.name}
      </Typography.Text>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
        <Tag color={STAGE_COLOR[stageOf(topic.grade)]} style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>
          {gradeLabel(topic)}
        </Tag>
        {relation === 'down' && (
          <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>后续</Tag>
        )}
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { topic: TopicNode }

function collect(graph: Graph, id: string, depth: Depth) {
  const nodes = new Set<string>([id])
  let frontier = [id]
  let level = 0
  while (frontier.length && (depth === 'all' || level < depth)) {
    const next: string[] = []
    frontier.forEach((current) => {
      ;(graph.prereqs[current] || []).forEach((prereq) => {
        if (!nodes.has(prereq.id)) {
          nodes.add(prereq.id)
          next.push(prereq.id)
        }
      })
    })
    frontier = next
    level += 1
  }
  ;(graph.dependents[id] || []).forEach((dependent) => nodes.add(dependent.id))
  return nodes
}

function buildLayout(graph: Graph, selectedId: string, depth: Depth) {
  const ids = collect(graph, selectedId, depth)
  const ancestors = new Set<string>()
  const queue = [selectedId]
  while (queue.length) {
    const current = queue.shift() as string
    ;(graph.prereqs[current] || []).forEach((prereq) => {
      if (ids.has(prereq.id) && !ancestors.has(prereq.id)) {
        ancestors.add(prereq.id)
        queue.push(prereq.id)
      }
    })
  }

  const edges: { from: string; to: string; strength: string }[] = []
  ids.forEach((to) => {
    ;(graph.prereqs[to] || []).forEach((prereq) => {
      if (ids.has(prereq.id)) edges.push({ from: prereq.id, to, strength: prereq.strength })
    })
  })

  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'TB', nodesep: 20, ranksep: 54, marginx: 20, marginy: 20 })
  ids.forEach((id) => layout.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((edge) => layout.setEdge(edge.from, edge.to))
  dagre.layout(layout)

  const nodes: Node<TopicNodeData>[] = [...ids].map((id) => {
    const point = layout.node(id)
    const topic = graph.byId[id]
    return {
      id,
      type: 'topic',
      position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 },
      data: {
        topic,
        selected: id === selectedId,
        relation: id === selectedId ? 'self' : ancestors.has(id) ? 'up' : 'down',
      },
      draggable: false,
    }
  })

  return { nodes, edges }
}

type TopicGraphProps = {
  graph: Graph
  selectedId: string
  depth: Depth
  onSelect: (id: string) => void
}

export function TopicGraph({ graph, selectedId, depth, onSelect }: TopicGraphProps) {
  const { token } = theme.useToken()
  const { nodes, edges } = useMemo(() => buildLayout(graph, selectedId, depth), [graph, selectedId, depth])

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        style: {
          stroke: edge.strength === 'soft' ? token.colorTextQuaternary : token.colorTextTertiary,
          strokeWidth: 1.5,
          strokeDasharray: edge.strength === 'soft' ? '5 4' : undefined,
        },
      })),
    [edges, token],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      fitView
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable
      style={{ background: token.colorBgContainer }}
    >
      <Background gap={16} size={1} color={token.colorBorderSecondary} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
