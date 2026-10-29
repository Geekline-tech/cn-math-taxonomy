import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Tag, theme, Typography } from 'antd'
import { useMemo } from 'react'
import type { Graph, LayoutResult, TopicStatus } from '@/engine/types'

type PathNodeData = {
  name: string
  status: TopicStatus
  isRoot: boolean
  isTarget: boolean
}

const STATUS_COLOR: Record<TopicStatus, string> = {
  mastered: 'green',
  shaky: 'orange',
  weak: 'red',
  unknown: 'default',
}

const STATUS_LABEL: Record<TopicStatus, string> = {
  mastered: '已掌握',
  shaky: '不稳',
  weak: '薄弱',
  unknown: '未测',
}

const BORDER: Record<TopicStatus, string> = {
  mastered: '#52c41a',
  shaky: '#faad14',
  weak: '#ff4d4f',
  unknown: '#d9d9d9',
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

function PathNode({ data }: NodeProps<Node<PathNodeData>>) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        width: NODE_WIDTH,
        padding: '6px 10px',
        borderRadius: token.borderRadiusLG,
        border: `1.5px solid ${BORDER[data.status]}`,
        background: token.colorBgContainer,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 12.5 }}>
        {data.name}
      </Typography.Text>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <Tag color={STATUS_COLOR[data.status]} style={{ marginInlineEnd: 0, fontSize: 10.5, lineHeight: '15px' }}>
          {STATUS_LABEL[data.status]}
        </Tag>
        {data.isRoot ? (
          <Tag color="volcano" style={{ marginInlineEnd: 0, fontSize: 10.5, lineHeight: '15px' }}>
            根因
          </Tag>
        ) : null}
        {data.isTarget ? (
          <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 10.5, lineHeight: '15px' }}>
            目标
          </Tag>
        ) : null}
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { path: PathNode }

export function PathGraph({ graph, layout }: { graph: Graph; layout: LayoutResult }) {
  const { token } = theme.useToken()

  const nodes: Node<PathNodeData>[] = useMemo(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: 'path',
        position: {
          x: (node.col - (node.cols - 1) / 2) * (NODE_WIDTH + 32),
          y: node.layer * (NODE_HEIGHT + 46),
        },
        data: {
          name: graph.byId[node.id]?.name ?? node.id,
          status: node.status,
          isRoot: node.isRoot,
          isTarget: node.isTarget,
        },
        draggable: false,
      })),
    [layout, graph],
  )

  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((edge) => ({
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        style: {
          stroke: edge.direct ? token.colorTextTertiary : token.colorTextQuaternary,
          strokeWidth: 1.5,
          strokeDasharray: edge.direct ? undefined : '5 4',
        },
      })),
    [layout, token],
  )

  return (
    <div style={{ height: 420 }}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      nodesDraggable={false}
      style={{ background: token.colorBgContainer }}
    >
      <Background gap={16} size={1} color={token.colorBorderSecondary} />
      <Controls showInteractive={false} />
    </ReactFlow>
    </div>
  )
}
