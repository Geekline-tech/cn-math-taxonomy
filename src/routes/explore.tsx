import {
  ApartmentOutlined,
  CopyOutlined,
  NodeIndexOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  Grid,
  Input,
  List,
  Segmented,
  Select,
  Skeleton,
  Space,
  Splitter,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AiExplain } from '@/components/ai-explain'
import { TopicGraph, type Depth } from '@/components/topic-graph'
import { loadBase } from '@/data/core'
import DiagEngine from '@/engine/diag-engine'
import type { Graph, StandardItem, SubjectKey, Topic } from '@/engine/types'
import { gradeLabel, missingStages, STAGE_LABEL, stageOf, stagesOf, type Stage } from '@/lib/grades'
import { SUBJECTS } from '@/lib/subjects'
import { useGraph } from '@/lib/use-graph'
import { useSubject } from '@/lib/use-subject'

const { Text, Title, Paragraph } = Typography

const DEPTH_OPTIONS = [
  { value: '1', label: '1 层' },
  { value: '2', label: '2 层' },
  { value: '3', label: '3 层' },
  { value: 'all', label: '全部' },
]

const STAGE_COLOR = { primary: 'blue', junior: 'purple', senior: 'magenta' } as const

function volumeLabel(volume: string) {
  const match = /^([一二三四五六七八九])([上下全])$/.exec(volume)
  if (match) return `${match[1]}年级${match[2] === '全' ? '全一册' : `${match[2]}册`}`
  return volume
}

type ChapterGroup = { key: string; label: string; topics: Topic[] }
type VolumeGroup = { key: string; label: string; count: number; chapters: ChapterGroup[] }

function groupTopics(topics: Topic[]): VolumeGroup[] {
  const volumes = new Map<string, Map<string, ChapterGroup>>()
  topics.forEach((topic) => {
    const parsed = DiagEngine.parseChapter(topic.chapter)
    const volumeKey = parsed.volume || '其他'
    const chapterKey = `${parsed.chapterNo} ${parsed.chapterName}`.trim()
    if (!volumes.has(volumeKey)) volumes.set(volumeKey, new Map())
    const chapters = volumes.get(volumeKey) as Map<string, ChapterGroup>
    if (!chapters.has(chapterKey)) {
      chapters.set(chapterKey, {
        key: chapterKey,
        label: [parsed.chapterNo, parsed.chapterName].filter(Boolean).join(' ') || topic.chapter,
        topics: [],
      })
    }
    ;(chapters.get(chapterKey) as ChapterGroup).topics.push(topic)
  })

  return [...volumes.entries()].map(([volume, chapters]) => {
    const list = [...chapters.values()]
    return {
      key: volume,
      label: volumeLabel(volume),
      count: list.reduce((sum, chapter) => sum + chapter.topics.length, 0),
      chapters: list,
    }
  })
}

function useStandards() {
  const [items, setItems] = useState<StandardItem[]>([])
  useEffect(() => {
    loadBase()
      .then((base) => setItems(base.standards.items))
      .catch(() => setItems([]))
  }, [])
  return items
}

type ListPaneProps = {
  graph: Graph
  subject: SubjectKey
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  onQuery: (value: string) => void
  stage: string
  onStage: (value: string) => void
  grade?: number
  onGrade: (value?: number) => void
  domain?: string
  onDomain: (value?: string) => void
}

function ListPane(props: ListPaneProps) {
  const { graph, subject, selectedId, onSelect, query, onQuery, stage, onStage, grade, onGrade, domain, onDomain } = props
  const { token } = theme.useToken()

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return graph.topics.filter((topic) => {
      if (topic.external) return false
      if (stage !== 'all' && stageOf(topic.grade) !== stage) return false
      if (grade && topic.grade !== grade) return false
      if (domain && topic.domain !== domain) return false
      if (!keyword) return true
      return (
        topic.name.toLowerCase().includes(keyword) ||
        topic.chapter.toLowerCase().includes(keyword) ||
        topic.id.toLowerCase().includes(keyword)
      )
    })
  }, [graph, query, stage, grade, domain])

  const groups = useMemo(() => groupTopics(filtered), [filtered])
  const allGrades = useMemo(
    () => [...new Set(graph.topics.filter((topic) => !topic.external).map((topic) => topic.grade))].sort((a, b) => a - b),
    [graph],
  )
  const stageOptions = useMemo(
    () => [
      { value: 'all', label: '全部' },
      ...stagesOf(allGrades).map((item) => ({ value: item, label: STAGE_LABEL[item] })),
    ],
    [allGrades],
  )
  const absent = useMemo(() => missingStages(allGrades), [allGrades])
  const grades = useMemo(
    () =>
      stage === 'all' ? allGrades : allGrades.filter((item) => stageOf(item) === stage),
    [allGrades, stage],
  )
  const domains = useMemo(
    () => [...new Set(graph.topics.filter((topic) => !topic.external).map((topic) => topic.domain))],
    [graph],
  )

  const signature = groups.map((group) => group.key).join('|')
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const lastSignature = useRef('')

  useEffect(() => {
    if (signature === lastSignature.current) return
    lastSignature.current = signature
    const keys = groups.map((group) => group.key)
    setOpenKeys(keys.length ? [keys[0]] : [])
  }, [signature, groups])

  useEffect(() => {
    if (!selectedId) return
    const target = groups.find((group) =>
      group.chapters.some((chapter) => chapter.topics.some((topic) => topic.id === selectedId)),
    )?.key
    if (target) setOpenKeys((prev) => (prev.includes(target) ? prev : [...prev, target]))
  }, [selectedId, groups])

  return (
    <Flex vertical style={{ height: '100%', padding: 16, gap: 12 }}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索名称、章节或编号"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <Segmented block size="small" value={stage} options={stageOptions} onChange={(value) => onStage(String(value))} />
      <Space.Compact block>
        <Select
          style={{ flex: 1 }}
          placeholder="全部年级"
          allowClear
          value={grade}
          onChange={(value) => onGrade(value)}
          options={grades.map((item) => ({ value: item, label: gradeLabel(subject, item) }))}
        />
        <Select
          style={{ flex: 1 }}
          placeholder="全部领域"
          allowClear
          value={domain}
          onChange={(value) => onDomain(value)}
          options={domains.map((item) => ({ value: item, label: item }))}
        />
      </Space.Compact>
      <Space direction="vertical" size={2}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          共 {filtered.length} 个知识点
        </Text>
        {absent.length ? (
          <Text style={{ fontSize: 12, color: token.colorWarning }}>
            {SUBJECTS.find((item) => item.key === subject)?.label}目前只收录
            {stagesOf(allGrades).map((item) => STAGE_LABEL[item]).join('、')}内容，
            {absent.map((item) => STAGE_LABEL[item]).join('、')}还没有题库数据。
          </Text>
        ) : null}
      </Space>
      <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {groups.length ? (
          <Collapse
            ghost
            activeKey={openKeys}
            onChange={(keys) => setOpenKeys(Array.isArray(keys) ? keys : [keys])}
            items={groups.map((group) => ({
              key: group.key,
              label: (
                <Space size={6}>
                  <Text strong>{group.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {group.count}
                  </Text>
                </Space>
              ),
              children: group.chapters.map((chapter) => (
                <div key={chapter.key} style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {chapter.label}
                  </Text>
                  <List
                    size="small"
                    split={false}
                    dataSource={chapter.topics}
                    renderItem={(topic) => (
                      <List.Item
                        style={{
                          padding: '4px 8px',
                          cursor: 'pointer',
                          borderRadius: token.borderRadiusSM,
                          background: topic.id === selectedId ? token.colorPrimaryBg : undefined,
                        }}
                        onClick={() => onSelect(topic.id)}
                      >
                        <Text
                          style={{ fontSize: 13 }}
                          type={topic.id === selectedId ? undefined : 'secondary'}
                          strong={topic.id === selectedId}
                          ellipsis
                        >
                          {topic.name}
                        </Text>
                      </List.Item>
                    )}
                  />
                </div>
              )),
            }))}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的知识点" style={{ marginTop: 32 }} />
        )}
      </div>
    </Flex>
  )
}

type DetailPaneProps = {
  graph: Graph
  subject: SubjectKey
  topic: Topic
  standards: StandardItem[]
  onSelect: (id: string) => void
}

function DetailPane({ graph, subject, topic, standards, onSelect }: DetailPaneProps) {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const prereqs = graph.prereqs[topic.id] || []
  const dependents = graph.dependents[topic.id] || []
  const standardItems = (topic.standards || [])
    .map((entry) => standards.find((item) => item.id === entry.id))
    .filter((item): item is StandardItem => !!item)

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            {topic.name}
          </Title>
          <Space size={4} wrap>
            <Tag color={STAGE_COLOR[stageOf(topic.grade)]}>{gradeLabel(subject, topic.grade)}</Tag>
            <Tag>{topic.domain}</Tag>
            {topic.type ? <Tag color="default">{topic.type}</Tag> : null}
            <Tag color="default">{topic.id}</Tag>
          </Space>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {topic.chapter}
        </Text>
        {topic.description ? <Paragraph style={{ marginBottom: 0 }}>{topic.description}</Paragraph> : null}

        <Space wrap>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => navigate(`/diagnose?target=${topic.id}`)}>
            诊断这个知识点
          </Button>
          <AiExplain
            size="middle"
            label="AI 讲讲这个点"
            input={{
              subject: SUBJECTS.find((item) => item.key === subject)?.label,
              grade: gradeLabel(subject, topic.grade),
              topic: topic.name,
              chapter: topic.chapter,
              context: [topic.description, ...(topic.mastery_criteria ?? [])].filter(Boolean).join('；'),
            }}
          />
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?id=${topic.id}`
              navigator.clipboard?.writeText(url).then(
                () => message.success('链接已复制'),
                () => message.warning('复制失败，请手动复制地址栏'),
              )
            }}
          >
            复制链接
          </Button>
        </Space>

        {topic.mastery_criteria?.length ? (
          <Descriptions column={1} size="small" title="掌握标准" styles={{ label: { width: 72 } }}>
            {topic.mastery_criteria.map((item, index) => (
              <Descriptions.Item key={item} label={`第 ${index + 1} 条`}>
                {item}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}

        <div>
          <Text strong>先修（{prereqs.length}）</Text>
          {prereqs.length ? (
            <List
              size="small"
              dataSource={prereqs}
              renderItem={(edge) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space size={6} wrap>
                      <Tag color={edge.strength === 'hard' ? 'red' : 'default'} style={{ marginInlineEnd: 0 }}>
                        {edge.strength === 'hard' ? '硬' : '软'}
                      </Tag>
                      <a onClick={() => onSelect(edge.id)}>{graph.byId[edge.id]?.name ?? edge.id}</a>
                    </Space>
                    {edge.reason ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {edge.reason}
                      </Text>
                    ) : null}
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              没有先修，是这条链的起点。
            </Text>
          )}
        </div>

        <div>
          <Text strong>后续（{dependents.length}）</Text>
          {dependents.length ? (
            <List
              size="small"
              dataSource={dependents.slice(0, 30)}
              renderItem={(edge) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <Space size={6}>
                    <Tag color={edge.strength === 'hard' ? 'red' : 'default'} style={{ marginInlineEnd: 0 }}>
                      {edge.strength === 'hard' ? '硬' : '软'}
                    </Tag>
                    <a onClick={() => onSelect(edge.id)}>{graph.byId[edge.id]?.name ?? edge.id}</a>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              没有后续知识点。
            </Text>
          )}
        </div>

        {standardItems.length ? (
          <div>
            <Text strong>课标条目</Text>
            <List
              size="small"
              dataSource={standardItems}
              renderItem={(item) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <Space direction="vertical" size={0}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.id}
                      {item.page_or_ref ? ` · ${item.page_or_ref}` : ''}
                    </Text>
                    <Text style={{ fontSize: 13 }}>{item.text}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        ) : null}
      </Space>
    </div>
  )
}

export function ExplorePage() {
  const { subject } = useSubject()
  const { graph, error } = useGraph(subject, false)
  const standards = useStandards()
  const screens = Grid.useBreakpoint()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState(() => params.get('stage') ?? 'all')
  const [grade, setGrade] = useState<number | undefined>(() => {
    const raw = params.get('grade')
    return raw ? Number(raw) : undefined
  })
  const [domain, setDomain] = useState<string | undefined>(undefined)
  const [depth, setDepth] = useState<string>('2')
  const [tab, setTab] = useState<'list' | 'graph' | 'detail'>('list')
  const isMobile = !screens.lg

  const selectedId = params.get('id')
  const selected = selectedId && graph ? graph.byId[selectedId] : undefined

  const availableStages = useMemo(
    () => (graph ? stagesOf(graph.topics.filter((topic) => !topic.external).map((topic) => topic.grade)) : []),
    [graph],
  )

  useEffect(() => {
    if (!graph || !availableStages.length) return
    if (stage !== 'all' && !availableStages.includes(stage as Stage)) setStage('all')
    if (grade && !graph.topics.some((topic) => topic.grade === grade && !topic.external)) setGrade(undefined)
  }, [graph, availableStages, stage, grade])

  const firstVisible = graph
    ? graph.topics.find(
        (topic) =>
          !topic.external &&
          (stage === 'all' || stageOf(topic.grade) === stage) &&
          (!grade || topic.grade === grade) &&
          (!domain || topic.domain === domain),
      )
    : undefined

  useEffect(() => {
    if (selectedId || !firstVisible) return
    const next = new URLSearchParams(params)
    next.set('id', firstVisible.id)
    setParams(next, { replace: true })
  }, [selectedId, firstVisible, params, setParams])

  const select = (id: string, next?: 'list' | 'graph' | 'detail') => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('id', id)
    setParams(nextParams, { replace: true })
    if (next && isMobile) setTab(next)
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 24 }}>
        <Alert type="error" showIcon title="图谱加载失败" description={error} />
      </div>
    )
  }

  if (!graph) {
    return (
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  const listPane = (
    <ListPane
      graph={graph}
      subject={subject}
      selectedId={selectedId}
      onSelect={(id) => select(id, 'graph')}
      query={query}
      onQuery={setQuery}
      stage={stage}
      onStage={(value) => {
        setStage(value)
        const next = new URLSearchParams(params)
        if (value === 'all') next.delete('stage')
        else next.set('stage', value)
        setParams(next, { replace: true })
      }}
      grade={grade}
      onGrade={setGrade}
      domain={domain}
      onDomain={setDomain}
    />
  )

  const graphPane = (
    <Flex vertical style={{ height: '100%' }}>
      <Flex align="center" justify="space-between" style={{ padding: '10px 16px', gap: 12 }} wrap>
        <Space size={6}>
          <ApartmentOutlined />
          <Text strong>局部先修图</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selected ? selected.name : '未选中'}
          </Text>
        </Space>
        <Space size={12} wrap>
          <Space size={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              向上
            </Text>
            <Segmented
              size="small"
              value={depth}
              options={DEPTH_OPTIONS}
              onChange={(value) => setDepth(String(value))}
            />
          </Space>
          <Space size={4}>
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              小学
            </Tag>
            <Tag color="purple" style={{ marginInlineEnd: 0 }}>
              初中
            </Tag>
            <Tag color="magenta" style={{ marginInlineEnd: 0 }}>
              高中
            </Tag>
          </Space>
        </Space>
      </Flex>
      <div style={{ flex: 1, minHeight: 320 }}>
        {selected ? (
          <TopicGraph
              graph={graph}
              selectedId={selected.id}
              depth={depth === 'all' ? 'all' : (Number(depth) as Depth)}
              onSelect={(id) => select(id, 'detail')}
            />
        ) : (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="从左侧选一个知识点，这里只画它附近的先修与后续"
            >
              {firstVisible ? (
                <Button type="primary" icon={<NodeIndexOutlined />} onClick={() => select(firstVisible.id, 'graph')}>
                  先看看「{firstVisible.name}」
                </Button>
              ) : null}
            </Empty>
          </Flex>
        )}
      </div>
    </Flex>
  )

  const detailPane = selected ? (
    <DetailPane graph={graph} subject={subject} topic={selected} standards={standards} onSelect={select} />
  ) : (
    <Flex align="center" justify="center" style={{ height: '100%' }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选一个知识点查看详情" />
    </Flex>
  )

  if (!screens.lg) {
    return (
      <div style={{ padding: 12 }}>
        <Card styles={{ body: { padding: 0 } }}>
          <Tabs
            centered
            activeKey={tab}
            onChange={(key) => setTab(key as typeof tab)}
            items={[
              { key: 'list', label: '目录', children: <div style={{ height: '70vh' }}>{listPane}</div> },
              { key: 'graph', label: '图谱', children: <div style={{ height: '70vh' }}>{tab === 'graph' ? graphPane : null}</div> },
              { key: 'detail', label: '详情', children: <div style={{ height: '70vh' }}>{detailPane}</div> },
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <Splitter>
        <Splitter.Panel defaultSize="22%" min="16%" max="32%">
          {listPane}
        </Splitter.Panel>
        <Splitter.Panel>
          {graphPane}
        </Splitter.Panel>
        <Splitter.Panel defaultSize="26%" min="18%" max="36%">
          {detailPane}
        </Splitter.Panel>
      </Splitter>
    </div>
  )
}
