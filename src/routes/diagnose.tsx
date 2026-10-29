import {
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Empty,
  Flex,
  Input,
  List,
  Progress,
  Radio,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  theme,
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PathGraph } from '@/components/path-graph'
import { AiExplain } from '@/components/ai-explain'
import DiagEngine from '@/engine/diag-engine'
import type { Graph, Question, Result, Session, SubjectKey, Topic } from '@/engine/types'
import * as store from '@/lib/children-store'
import { SUBJECTS } from '@/lib/subjects'
import { useGraph } from '@/lib/use-graph'
import { useSubject } from '@/lib/use-subject'

const { Title, Text, Paragraph } = Typography

type Phase = 'pick' | 'quiz' | 'result'

type LastAnswer = {
  topicId: string
  question: Question
  result: Result
  text?: string
}

function gradeText(grade: number) {
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (grade <= 9) return `${names[grade - 1] ?? ''}年级`
  if (grade === 10) return '高一'
  if (grade === 11) return '高二'
  return `选必${['一', '二', '三', '四'][grade - 12] ?? ''}`
}

function Figure({ svg }: { svg?: string }) {
  if (!svg) return null
  return (
    <div
      style={{ margin: '8px 0', maxWidth: 420 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function PickPane({
  graph,
  subject,
  onStart,
  confirm,
  onConfirm,
}: {
  graph: Graph
  subject: SubjectKey
  onStart: (targets: string[], label: string, mode: 'target' | 'screen') => void
  confirm: number
  onConfirm: (value: number) => void
}) {
  const { token } = theme.useToken()
  const [query, setQuery] = useState('')
  const [volume, setVolume] = useState<string | undefined>()
  const [chapter, setChapter] = useState<string | undefined>()

  const volumes = useMemo(() => {
    const map = new Map<string, Map<string, Topic[]>>()
    graph.topics
      .filter((topic) => !topic.external)
      .forEach((topic) => {
        const parsed = DiagEngine.parseChapter(topic.chapter)
        const volumeKey = parsed.volume || '其他'
        const chapterKey = [parsed.chapterNo, parsed.chapterName].filter(Boolean).join(' ') || topic.chapter
        if (!map.has(volumeKey)) map.set(volumeKey, new Map())
        const chapters = map.get(volumeKey) as Map<string, Topic[]>
        if (!chapters.has(chapterKey)) chapters.set(chapterKey, [])
        ;(chapters.get(chapterKey) as Topic[]).push(topic)
      })
    return map
  }, [graph])

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return []
    return graph.topics
      .filter(
        (topic) =>
          !topic.external &&
          (topic.name.toLowerCase().includes(keyword) ||
            topic.chapter.toLowerCase().includes(keyword) ||
            topic.id.toLowerCase().includes(keyword)),
      )
      .slice(0, 20)
  }, [graph, query])

  const chapterTopics = volume && chapter ? (volumes.get(volume)?.get(chapter) ?? []) : []

  const grades = useMemo(
    () => [...new Set(graph.topics.filter((topic) => !topic.external).map((topic) => topic.grade))].sort((a, b) => a - b),
    [graph],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Text>连续答对几题算掌握</Text>
        <Segmented
          value={confirm}
          options={[2, 3, 5].map((value) => ({ value, label: `${value} 题` }))}
          onChange={(value) => onConfirm(Number(value))}
        />
      </Space>

      <Tabs
        items={[
          {
            key: 'search',
            label: '搜索知识点',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input.Search
                  allowClear
                  placeholder="输入名称、章节或编号，例如 配方法 / cnm_221"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <List
                  size="small"
                  dataSource={results}
                  locale={{ emptyText: query ? '没有匹配的知识点' : '输入关键词开始搜索' }}
                  renderItem={(topic) => (
                    <List.Item
                      actions={[
                        <Button key="start" type="link" onClick={() => onStart([topic.id], topic.name, 'target')}>
                          诊断
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={topic.name}
                        description={`${gradeText(topic.grade)} · ${topic.chapter}`}
                      />
                    </List.Item>
                  )}
                />
              </Space>
            ),
          },
          {
            key: 'book',
            label: '按册选择',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap>
                  <Select
                    style={{ width: 200 }}
                    placeholder="选择册次"
                    value={volume}
                    onChange={(value) => {
                      setVolume(value)
                      setChapter(undefined)
                    }}
                    options={[...volumes.keys()].map((key) => ({ value: key, label: key }))}
                  />
                  <Select
                    style={{ width: 260 }}
                    placeholder="选择章节"
                    value={chapter}
                    onChange={setChapter}
                    disabled={!volume}
                    options={[...(volumes.get(volume ?? '')?.keys() ?? [])].map((key) => ({ value: key, label: key }))}
                  />
                  {chapterTopics.length ? (
                    <Button type="primary" onClick={() => onStart(chapterTopics.map((topic) => topic.id), chapter ?? '', 'target')}>
                      整章诊断（{chapterTopics.length} 个点）
                    </Button>
                  ) : null}
                </Space>
                <List
                  size="small"
                  dataSource={chapterTopics}
                  locale={{ emptyText: '先选册次和章节' }}
                  renderItem={(topic) => (
                    <List.Item
                      actions={[
                        <Button key="start" type="link" onClick={() => onStart([topic.id], topic.name, 'target')}>
                          诊断
                        </Button>,
                      ]}
                    >
                      <Space size={8}>
                        <Text>{topic.name}</Text>
                        <Tag style={{ marginInlineEnd: 0 }}>{topic.id}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Space>
            ),
          },
          {
            key: 'grade',
            label: '整册筛查',
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  title="整册筛查只在本册范围内出题"
                  description="不会回溯到更低年级的先修，适合开学前摸底或期末查漏。"
                />
                <Space wrap>
                  {grades.map((grade) => {
                    const scope = gradeText(grade)
                    const targets = DiagEngine.gradeTargets(graph, scope, subject)
                    return (
                      <Button
                        key={grade}
                        disabled={!targets}
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                          if (targets) onStart(targets.ids, `${targets.label}（整体筛查）`, 'screen')
                        }}
                      >
                        {scope}
                        {targets ? ` · ${targets.ids.length} 点` : ' · 无'}
                      </Button>
                    )
                  })}
                </Space>
              </Space>
            ),
          },
        ]}
      />
      <Text type="secondary" style={{ fontSize: 12, color: token.colorTextTertiary }}>
        答错会先补一道更基础的题确认。确认题也错，才沿先修关系往回追。
      </Text>
    </Space>
  )
}

export function DiagnosePage() {
  const { subject } = useSubject()
  const { graph, error } = useGraph(subject)
  const [params] = useSearchParams()
  const { token } = theme.useToken()

  const [phase, setPhase] = useState<Phase>('pick')
  const [session, setSession] = useState<Session | null>(null)
  const [label, setLabel] = useState('')
  const [last, setLast] = useState<LastAnswer | null>(null)
  const [input, setInput] = useState('')
  const [selfEval, setSelfEval] = useState(false)
  const [confirm, setConfirm] = useState(3)
  const [started, setStarted] = useState(false)
  const [archive, setArchive] = useState<{ status: 'idle' | 'saved' | 'nofile' | 'failed'; name?: string }>({
    status: 'idle',
  })
  const savedRef = useRef('')

  useEffect(() => {
    setPhase('pick')
    setSession(null)
    setLast(null)
    setInput('')
    setSelfEval(false)
    setArchive({ status: 'idle' })
    setStarted(false)
    savedRef.current = ''
  }, [subject])

  const item = useMemo(
    () => (graph && session && phase === 'quiz' && !last ? DiagEngine.nextItem(graph, session) : null),
    [graph, session, phase, last],
  )

  const summary = useMemo(
    () => (graph && session && phase === 'result' ? DiagEngine.summarize(graph, session) : null),
    [graph, session, phase],
  )

  const layout = useMemo(
    () => (graph && session && summary ? DiagEngine.layout(graph, session, summary) : null),
    [graph, session, summary],
  )

  const chapters = useMemo(
    () => (graph && session && phase === 'result' ? DiagEngine.chapterSummary(graph, session) : []),
    [graph, session, phase],
  )

  useEffect(() => {
    if (phase !== 'result' || !summary || !session || !summary.asked) return
    const key = [subject, session.seed, session.targets.join(',')].join('|')
    if (savedRef.current === key) return
    savedRef.current = key
    const child = store.current()
    if (!child) {
      setArchive({ status: 'nofile' })
      return
    }
    const ok = store.saveRecord(child.id, {
      key,
      subject,
      label,
      mode: summary.mode,
      asked: summary.asked,
      targets: summary.mode === 'screen' || summary.targets.length > 6 ? undefined : summary.targets,
      counts: {
        weak: summary.weak.length,
        shaky: summary.shaky.length,
        mastered: summary.mastered.length,
        untested: summary.untested.length,
      },
      weak: summary.weak,
      roots: summary.roots.map((root) => root.id),
      shaky: summary.shaky,
      mastered: summary.mastered,
      savedAt: '',
    })
    setArchive(ok ? { status: 'saved', name: child.name } : { status: 'failed' })
  }, [phase, summary, session, subject, label])

  const start = (targets: string[], nextLabel: string, mode: 'target' | 'screen') => {
    if (!graph) return
    const created = DiagEngine.createSession(graph, targets, {
      mode,
      confirm,
      limit: mode === 'screen' ? DiagEngine.SCREEN_LIMIT : DiagEngine.DEFAULT_LIMIT,
    })
    setSession(created)
    setLabel(nextLabel)
    setLast(null)
    setInput('')
    setPhase('quiz')
    setArchive({ status: 'idle' })
    savedRef.current = ''
  }

  useEffect(() => {
    if (!graph || started) return
    const target = params.get('target')
    if (!target) return
    const ids = DiagEngine.resolveTargets(target, {})
    const valid = ids.filter((id) => graph.byId[id])
    if (!valid.length) return
    setStarted(true)
    start(valid, graph.byId[valid[0]]?.name ?? '', 'target')
  }, [graph, params, started])

  const commit = (result: Result, text?: string) => {
    if (!graph || !session || !item) return
    setSession(DiagEngine.applyAnswer(graph, session, item.topicId, result, { text }))
    setLast({ topicId: item.topicId, question: item.question, result, text })
    setInput('')
    setSelfEval(false)
  }

  const proceed = () => {
    if (!graph || !session) return
    setLast(null)
    if (!DiagEngine.nextItem(graph, session)) setPhase('result')
  }

  const submit = () => {
    if (!item) return
    const verdict = DiagEngine.judgeQuestion(item.question, input)
    if (verdict.verdict === 'manual') {
      setSelfEval(true)
      return
    }
    commit(verdict.verdict === 'correct' ? 'correct' : 'wrong', input)
  }

  if (error) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <Alert type="error" showIcon title="数据加载失败" description={error} />
      </div>
    )
  }

  if (!graph) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  const wrap = (children: React.ReactNode) => (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 24px 0' }}>{children}</div>
  )

  if (phase === 'pick') {
    return wrap(
      <Card
        title={
          <Space>
            <Text strong style={{ fontSize: 18 }}>
              选择诊断目标
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              一次 5 到 10 分钟
            </Text>
          </Space>
        }
      >
        <PickPane
          key={subject}
          graph={graph}
          subject={subject}
          onStart={start}
          confirm={confirm}
          onConfirm={setConfirm}
        />
      </Card>,
    )
  }

  if (phase === 'quiz' && session) {
    if (last) {
      const correct = last.result === 'correct'
      return wrap(
        <Card>
          <Flex vertical gap={12}>
            <Space size={8}>
              {correct ? (
                <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 20 }} />
              ) : (
                <CloseCircleFilled style={{ color: token.colorError, fontSize: 20 }} />
              )}
              <Text strong style={{ fontSize: 16 }}>
                {correct ? '答对了' : last.result === 'skip' ? '标记为不会' : '答错了'}
              </Text>
              <Text type="secondary">{graph.byId[last.topicId]?.name}</Text>
            </Space>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Text type="secondary">参考答案</Text>
              <Paragraph style={{ marginBottom: 4, fontSize: 15 }}>{last.question.answer}</Paragraph>
              {last.question.explanation ? (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {last.question.explanation}
                </Text>
              ) : null}
            </div>
            <Space wrap>
              <Button type="primary" icon={<RightOutlined />} onClick={proceed}>
                下一题
              </Button>
              {correct ? null : (
                <AiExplain
                  size="middle"
                  label="让 AI 讲讲这道题"
                  input={{
                    subject: SUBJECTS.find((entry) => entry.key === subject)?.label,
                    grade: gradeText(graph.byId[last.topicId]?.grade ?? 0),
                    topic: graph.byId[last.topicId]?.name,
                    chapter: graph.byId[last.topicId]?.chapter,
                    prompt: last.question.prompt,
                    answer: last.question.answer,
                    studentAnswer: last.text,
                    explanation: last.question.explanation,
                  }}
                />
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                已答 {session.answers.length} / 上限 {session.limit}
              </Text>
            </Space>
          </Flex>
        </Card>,
      )
    }

    if (!item) {
      return wrap(
        <Card>
          <Empty description="本轮题目已答完" />
          <Flex justify="center">
            <Button type="primary" onClick={() => setPhase('result')}>
              查看结果
            </Button>
          </Flex>
        </Card>,
      )
    }

    const topic = graph.byId[item.topicId]
    const question = item.question
    const isChoice = question.type === 'choice' && question.choices?.length

    return wrap(
      <Card>
        <Flex vertical gap={16}>
          <Flex justify="space-between" align="center" wrap gap={8}>
            <Space size={8} wrap>
              <Tag color="blue">第 {session.answers.length + 1} 题</Tag>
              <Text strong>{topic?.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {topic?.chapter}
              </Text>
            </Space>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.attempt > 1 ? `第 ${item.attempt} 次尝试` : `已答 ${session.answers.length} / 上限 ${session.limit}`}
              </Text>
              <Progress
                percent={Math.round((session.answers.length / session.limit) * 100)}
                showInfo={false}
                size="small"
                style={{ width: 100 }}
              />
            </Space>
          </Flex>

          <div>
            <Paragraph style={{ fontSize: 16, marginBottom: 8 }}>{question.prompt}</Paragraph>
            <Figure svg={question.figure} />
          </div>

          {isChoice ? (
            <Radio.Group
              value={input}
              onChange={(event) => setInput(event.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {question.choices?.map((choice) => (
                <Radio key={choice.key} value={choice.key} style={{ alignItems: 'flex-start' }}>
                  <Space align="start">
                    <Text strong>{choice.key}</Text>
                    {choice.figure ? (
                      <div dangerouslySetInnerHTML={{ __html: choice.figure }} style={{ maxWidth: 200 }} />
                    ) : question.hideChoiceText ? null : (
                      <Text>{choice.text}</Text>
                    )}
                  </Space>
                </Radio>
              ))}
            </Radio.Group>
          ) : (
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 4 }}
              placeholder="写出你的答案"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          )}

          <Space wrap>
            <Button type="primary" onClick={submit} disabled={!input && !isChoice}>
              提交
            </Button>
            <Button onClick={() => setSelfEval(true)}>看参考答案并自评</Button>
            <Button danger onClick={() => commit('skip')}>
              不会
            </Button>
          </Space>

          {selfEval ? (
            <Alert
              type="info"
              showIcon
              title={`参考答案：${question.answer}`}
              description={
                <Space style={{ marginTop: 8 }}>
                  <Button size="small" type="primary" onClick={() => commit('correct', input)}>
                    我答对了
                  </Button>
                  <Button size="small" danger onClick={() => commit('wrong', input)}>
                    我答错了
                  </Button>
                </Space>
              }
            />
          ) : null}
        </Flex>
      </Card>,
    )
  }

  if (phase === 'result' && summary && layout) {
    const rootNames = summary.roots.map((root) => root.id)
    return wrap(
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Flex justify="space-between" align="center" wrap gap={12}>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                诊断结果：{label}
              </Title>
              <Text type="secondary">
                已答 {summary.asked} 题，上限 {summary.limit}。掌握 {summary.mastered.length} 个，不稳{' '}
                {summary.shaky.length} 个，薄弱 {summary.weak.length} 个。
              </Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => setPhase('pick')}>
              重新诊断
            </Button>
          </Flex>
          {archive.status === 'saved' ? (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              showIcon
              title={`已存入「${archive.name}」的学习档案`}
              description={
                <>
                  薄弱点与根因已记录下来，下次诊断同一知识点时会对比进步。
                  <Link to="/children" style={{ marginLeft: 8 }}>
                    查看档案
                  </Link>
                </>
              }
            />
          ) : null}
          {archive.status === 'nofile' ? (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              title="这次结果没有存进档案"
              description={
                <>
                  还没有建立孩子档案，结果只在本次浏览有效。
                  <Link to="/children" style={{ marginLeft: 8 }}>
                    去建一个档案
                  </Link>
                </>
              }
            />
          ) : null}
          {archive.status === 'failed' ? (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title="结果没能写入档案"
              description="浏览器不允许保存本地数据（可能是隐私模式或存储已满），本次结果请自行截图留存。"
            />
          ) : null}
          {summary.limitReached ? (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title="题量已到上限，仍有知识点没测到"
              description="下面标为「未测」的点不代表已掌握，可以换一组目标再测。"
            />
          ) : null}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="掌握" value={summary.mastered.length} valueStyle={{ color: token.colorSuccess }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="不稳" value={summary.shaky.length} valueStyle={{ color: token.colorWarning }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="薄弱" value={summary.weak.length} valueStyle={{ color: token.colorError }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="未测" value={summary.untested.length} />
            </Card>
          </Col>
        </Row>

        <Card title={`薄弱的先修知识点（根因 ${rootNames.length}）`}>
          {rootNames.length ? (
            <List
              dataSource={summary.roots}
              renderItem={(root) => {
                const topic = graph.byId[root.id]
                const record = session?.answers.find((entry) => entry.id === root.id)
                const bank = graph.bank[root.id] ?? []
                const question = bank.find((entry) => entry.id === record?.qid) ?? bank[0]
                return (
                  <List.Item
                    actions={
                      topic
                        ? [
                            <AiExplain
                              key="ai"
                              input={{
                                subject: SUBJECTS.find((entry) => entry.key === subject)?.label,
                                grade: gradeText(topic.grade),
                                topic: topic.name,
                                chapter: topic.chapter,
                                prompt: question?.prompt,
                                answer: question?.answer,
                                studentAnswer: record?.text,
                                explanation: question?.explanation,
                              }}
                            />,
                          ]
                        : undefined
                    }
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space size={8} wrap>
                        <Tag color="red">根因</Tag>
                        <Text strong>{topic?.name ?? root.id}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {topic?.chapter}
                        </Text>
                      </Space>
                      {root.pendingPrereqs.length ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          还有先修没测到：{root.pendingPrereqs.map((id) => graph.byId[id]?.name ?? id).join('、')}
                        </Text>
                      ) : null}
                      {root.outOfScopePrereqs.length ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          本册范围之外的先修：{root.outOfScopePrereqs.map((id) => graph.byId[id]?.name ?? id).join('、')}
                        </Text>
                      ) : null}
                    </Space>
                  </List.Item>
                )
              }}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有定位到薄弱先修" />
          )}
        </Card>

        <Card title={`推荐学习路径（${summary.path.length} 个点，按年级从低到高）`}>
          {summary.path.length ? (
            <Timeline
              items={summary.path.map((node) => {
                const topic = graph.byId[node.id]
                return {
                  color: node.isRoot ? 'red' : node.status === 'shaky' ? 'orange' : 'gray',
                  children: (
                    <Space size={8} wrap>
                      <Text strong>{topic?.name ?? node.id}</Text>
                      {node.isRoot ? <Tag color="red">根因</Tag> : null}
                      {node.isTarget ? <Tag color="blue">目标</Tag> : null}
                      <Tag color={node.status === 'shaky' ? 'orange' : 'default'}>
                        {node.status === 'shaky' ? '不稳' : '待补'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {topic ? `${gradeText(topic.grade)} · ${topic.chapter}` : ''}
                      </Text>
                    </Space>
                  ),
                }
              })}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="不需要补学" />
          )}
        </Card>

        <Card title="路径图" styles={{ body: { padding: 0 } }}>
          <PathGraph graph={graph} layout={layout} />
        </Card>

        <Card title="按章汇总">
          <Table
            size="small"
            rowKey="key"
            pagination={{ pageSize: 8, size: 'small', hideOnSinglePage: true }}
            dataSource={chapters.filter((chapter) => chapter.weak + chapter.shaky > 0)}
            columns={[
              { title: '章节', dataIndex: 'label', ellipsis: true },
              { title: '总数', dataIndex: 'total', width: 70 },
              { title: '掌握', dataIndex: 'mastered', width: 70 },
              { title: '不稳', dataIndex: 'shaky', width: 70 },
              { title: '薄弱', dataIndex: 'weak', width: 70 },
              { title: '未测', dataIndex: 'untested', width: 70 },
            ]}
          />
        </Card>

        <Card title="答题记录">
          <Collapse
            items={[
              {
                key: 'answers',
                label: `共 ${session?.answers.length ?? 0} 条`,
                children: (
                  <List
                    size="small"
                    dataSource={session?.answers ?? []}
                    renderItem={(answer, index) => (
                      <List.Item>
                        <Space size={8}>
                          <Text type="secondary">{index + 1}</Text>
                          <Text>{graph.byId[answer.id]?.name ?? answer.id}</Text>
                          <Tag color={answer.result === 'correct' ? 'green' : answer.result === 'skip' ? 'default' : 'red'}>
                            {answer.result === 'correct' ? '对' : answer.result === 'skip' ? '不会' : '错'}
                          </Tag>
                          {answer.text ? <Text type="secondary">{answer.text}</Text> : null}
                        </Space>
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>,
    )
  }

  return null
}

