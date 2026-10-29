import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, App as AntdApp, Button, Card, Col, Empty, Flex, Popconfirm, Row, Skeleton, Space, Statistic, Table, Tag, Typography, theme } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { AuthModal } from '@/components/auth-modal'
import { adminDeleteUser, adminOverview, adminUsers, type AdminOverview, type AdminUser } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const { Text, Title } = Typography

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function AdminPage() {
  const { token, signedIn, isAdmin } = useAuth()
  const { message } = AntdApp.useApp()
  const { token: themeToken } = theme.useToken()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)

  const load = useCallback(async () => {
    if (!token || !isAdmin) return
    setLoading(true)
    setError('')
    try {
      const [summary, list] = await Promise.all([adminOverview(token), adminUsers(token)])
      setOverview(summary)
      setUsers(list.users)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  if (!signedIn) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <Card>
          <Empty description="需要管理员账号登录">
            <Button type="primary" onClick={() => setAuthOpen(true)}>
              登录
            </Button>
          </Empty>
        </Card>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <Alert type="warning" showIcon title="这个账号不是管理员" description="当前账号只能使用云端备份，看不到后台数据。" />
      </div>
    )
  }

  const peak = overview?.trend.length ? Math.max(...overview.trend.map((item) => item.count), 1) : 1

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 0' }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          管理后台
        </Title>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {overview ? `更新于 ${formatTime(overview.time)}` : ''}
          </Text>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        </Space>
      </Flex>

      {error ? <Alert type="error" showIcon title="加载失败" description={error} style={{ marginBottom: 16 }} /> : null}

      {loading && !overview ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="注册账号" value={overview?.users ?? 0} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="云端档案" value={overview?.archives ?? 0} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="占用空间" value={formatBytes(overview?.archiveBytes ?? 0)} valueStyle={{ fontSize: 20 }} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="今日 AI" value={overview?.aiToday ?? 0} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="累计 AI" value={overview?.aiTotal ?? 0} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="有效登录" value={overview?.sessions ?? 0} />
              </Card>
            </Col>
          </Row>

          <Card
            size="small"
            title="AI 用量（近 14 天）"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {overview?.model.replace('@cf/', '')}
              </Text>
            }
          >
            {overview?.trend.length ? (
              <Flex align="flex-end" gap={6} style={{ height: 120 }}>
                {overview.trend.map((item) => (
                  <Flex key={item.day} vertical align="center" justify="flex-end" style={{ flex: 1, height: '100%' }}>
                    <Text style={{ fontSize: 10, color: themeToken.colorTextTertiary }}>{item.count}</Text>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${Math.max((item.count / peak) * 78, item.count ? 4 : 1)}%`,
                        background: themeToken.colorPrimary,
                        borderRadius: 3,
                      }}
                    />
                    <Text style={{ fontSize: 10, color: themeToken.colorTextTertiary }}>{item.day.slice(5)}</Text>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有 AI 调用" />
            )}
          </Card>

          <Card size="small" title={`账号列表（${users.length}）`}>
            <Table<AdminUser>
              size="small"
              rowKey="id"
              dataSource={users}
              pagination={{ pageSize: 12, hideOnSinglePage: true }}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: '用户名',
                  dataIndex: 'username',
                  render: (value: string, row) => (
                    <Space size={6}>
                      <Text strong>{value}</Text>
                      {row.role === 'admin' ? <Tag color="gold">管理员</Tag> : null}
                    </Space>
                  ),
                },
                { title: '注册时间', dataIndex: 'created_at', render: (value: string) => formatTime(value) },
                { title: '最后登录', dataIndex: 'last_login_at', render: (value: string | null) => formatTime(value) },
                { title: '云端档案', dataIndex: 'bytes', render: (value: number | null) => formatBytes(value ?? 0) },
                { title: '档案更新', dataIndex: 'updated_at', render: (value: string | null) => formatTime(value) },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, row) => (
                    <Popconfirm
                      title={`删除账号 ${row.username}？`}
                      description="该账号的云端档案和登录状态会一起删除。"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={async () => {
                        try {
                          await adminDeleteUser(token, row.id)
                          message.success('已删除')
                          void load()
                        } catch (reason) {
                          message.error(reason instanceof Error ? reason.message : '删除失败')
                        }
                      }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={row.role === 'admin'} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      )}
    </div>
  )
}
