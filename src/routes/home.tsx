import { ArrowRightOutlined, ExperimentOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useStats } from '@/lib/use-stats'
import { useSubject } from '@/lib/use-subject'

const { Title, Paragraph, Text } = Typography

const STEPS = [
  {
    title: '选一个知识点',
    content: '按年级、册次或直接搜索。从一年级的认数到高中的导数，每个点都能作为诊断起点。',
  },
  {
    title: '自适应答题',
    content: '先问目标本身。答错出一道更基础的题，仍然错才沿先修关系往回追。',
  },
  {
    title: '拿到根因与路径',
    content: '标出真正薄弱的那一步，并按年级从低到高排出补学顺序。',
  },
]

const DEMO = [
  { color: 'red', name: '配方法', meta: '九上 25.2', tag: '答错', tagColor: 'error' },
  { color: 'red', name: '完全平方公式', meta: '八上 16.3', tag: '答错', tagColor: 'error' },
  { color: 'green', name: '多项式乘多项式', meta: '八上 16.2', tag: '已掌握', tagColor: 'success' },
]

const STAGE_LABEL = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
} as const

const STAGE_COLOR = {
  primary: 'blue',
  junior: 'purple',
  senior: 'magenta',
} as const

export function HomePage() {
  const navigate = useNavigate()
  const { subject } = useSubject()
  const { data, error } = useStats()
  const stats = data?.subjects[subject]
  const maxGradeCount = stats ? Math.max(...stats.grades.map((grade) => grade.count)) : 1
  const stageTotals = stats
    ? (['primary', 'junior', 'senior'] as const)
        .map((stage) => ({
          stage,
          label: STAGE_LABEL[stage],
          count: stats.grades.filter((grade) => grade.stage === stage).reduce((sum, grade) => sum + grade.count, 0),
          grades: stats.grades.filter((grade) => grade.stage === stage).length,
        }))
        .filter((item) => item.count > 0)
    : []

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 24px 0' }}>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[40, 32]} align="middle">
          <Col xs={24} lg={14}>
            <Tag color="blue">对齐 2022 版课程标准 · 人教版</Tag>
            <Title level={1} style={{ margin: '16px 0 12px' }}>
              先找到真正没学会的那一步
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 24 }}>
              数学从小学到高中，语文一至六年级，英语三年级到高中，物理八年级到高中。选一个知识点开始答题，答错就沿先修关系往回追，直到定位到具体的那一步，再按学习顺序排出补学路径。
            </Paragraph>
            <Space wrap>
              <Button type="primary" size="large" onClick={() => navigate('/diagnose')}>
                开始诊断
              </Button>
              <Button size="large" onClick={() => navigate('/explore')}>
                浏览知识图谱
              </Button>
            </Space>
            <div style={{ marginTop: 16 }}>
              <Link to="/diagnose?target=cnm_221&demo=1">
                看演示：从「配方法」追到「完全平方公式」 <ArrowRightOutlined />
              </Link>
            </div>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title="诊断示例" extra={<Tag color="blue">演示</Tag>}>
              <Timeline
                items={DEMO.map((node) => ({
                  color: node.color,
                  children: (
                    <Space direction="vertical" size={0}>
                      <Space size={8}>
                        <Text strong>{node.name}</Text>
                        <Tag color={node.tagColor}>{node.tag}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {node.meta}
                      </Text>
                    </Space>
                  ),
                }))}
              />
              <Alert
                type="warning"
                showIcon
                icon={<ExperimentOutlined />}
                title="根因在「完全平方公式」"
                description="建议从八年级上册 16.3 补起，再回到配方法。"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {[
          { label: '知识点', value: stats?.topics },
          { label: '先修关系', value: stats?.edges.total },
          { label: '题目', value: stats?.questions },
          { label: '课标条目', value: stats?.standards },
        ].map((item) => (
          <Col key={item.label} xs={12} md={6}>
            <Card>
              <Statistic title={item.label} value={item.value ?? 0} loading={!stats && !error} />
            </Card>
          </Col>
        ))}
      </Row>

      {error && (
        <Alert
          style={{ marginTop: 16 }}
          type="error"
          showIcon
          title="统计数据加载失败"
          description={`${error}。运行 npm run data 生成后刷新。`}
        />
      )}

      <Card title="怎么用" style={{ marginTop: 24 }}>
        <Steps items={STEPS} />
      </Card>

      <Card
        title="按年级进入"
        style={{ marginTop: 24 }}
        extra={<Text type="secondary">{stats ? `共 ${stats.grades.length} 个入口` : null}</Text>}
      >
        {stats ? (
          <>
            <Row gutter={[12, 12]}>
              {stageTotals.map((item) => (
                <Col key={item.stage} xs={24} sm={8}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(`/explore?stage=${item.stage}`)}
                    styles={{ body: { padding: '12px 16px' } }}
                  >
                    <Space size={8} align="baseline">
                      <Text strong style={{ fontSize: 15 }}>
                        {item.label}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.grades} 个年级
                      </Text>
                    </Space>
                    <div style={{ marginTop: 2 }}>
                      <Text strong style={{ fontSize: 22 }}>
                        {item.count}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                        个知识点
                      </Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={[12, 12]}>
            {stats.grades.map((grade) => (
              <Col key={grade.grade} xs={12} sm={8} md={6} lg={4}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/explore?grade=${grade.grade}`)}
                  styles={{ body: { padding: 12 } }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space size={6}>
                      <Text strong>{grade.label}</Text>
                      <Tag color={STAGE_COLOR[grade.stage]} style={{ marginInlineEnd: 0 }}>
                        {STAGE_LABEL[grade.stage]}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {grade.count} 个知识点
                    </Text>
                    <Progress
                      percent={Math.round((grade.count / maxGradeCount) * 100)}
                      showInfo={false}
                      size="small"
                      status="normal"
                    />
                  </Space>
                </Card>
              </Col>
            ))}
            </Row>
          </>
        ) : (
          <Skeleton active paragraph={{ rows: 4 }} />
        )}
      </Card>
    </div>
  )
}
