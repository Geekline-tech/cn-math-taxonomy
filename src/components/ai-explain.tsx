import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Modal, Space, Spin, Tag, Typography, theme } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { apiEnabled, explain, type ExplainInput, type Turn } from '@/lib/api'

const { Text } = Typography

const QUICK_ASKS = ['再举一个例子', '这一步为什么', '换种更简单的讲法', '考试会怎么考']

type Bubble = { role: 'user' | 'assistant'; content: string }

function RichText({ text }: { text: string }) {
  const { token } = theme.useToken()
  const parts = text.replace(/\$/g, '').split(/(\*\*[^*\n]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <span
              key={index}
              style={{
                background: token.colorWarningBg,
                color: token.colorText,
                fontWeight: 600,
                padding: '1px 3px',
                borderRadius: 4,
                boxShadow: `inset 0 -1px 0 ${token.colorWarningBorder}`,
              }}
            >
              {part.slice(2, -2)}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function AiExplain({
  input,
  label = 'AI 讲解',
  size = 'small',
}: {
  input: ExplainInput
  label?: string
  size?: 'small' | 'middle'
}) {
  const { token } = theme.useToken()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Bubble[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scroller.current) return
    scroller.current.scrollTop = scroller.current.scrollHeight
  }, [turns, loading])

  if (!apiEnabled) return null

  const send = async (question?: string) => {
    const text = (question ?? draft).trim()
    if (loading) return
    if (!text && turns.length) return

    setError('')
    setLoading(true)
    const history: Turn[] = turns.map((turn) => ({ role: turn.role, content: turn.content }))
    if (text) setTurns((prev) => [...prev, { role: 'user', content: text }])
    setDraft('')

    try {
      const result = await explain({ ...input, history: text ? history : [], question: text || undefined })
      setTurns((prev) => [...prev, { role: 'assistant', content: result.text }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI 讲解失败')
    } finally {
      setLoading(false)
    }
  }

  const start = () => {
    setOpen(true)
    if (turns.length || loading) return
    void send()
  }

  return (
    <>
      <Button size={size} icon={<RobotOutlined />} onClick={start}>
        {label}
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width="min(680px, 94vw)"
        title={input.topic ? `AI 讲解 · ${input.topic}` : 'AI 讲解'}
        styles={{ body: { paddingTop: 8 } }}
      >
        <div
          ref={scroller}
          style={{
            maxHeight: '56vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 4,
          }}
        >
          {turns.length === 0 && loading ? (
            <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
              <Spin />
              <Text type="secondary">正在按这道题的错误点讲解…</Text>
            </Space>
          ) : null}

          {turns.map((turn, index) =>
            turn.role === 'assistant' ? (
              <div
                key={index}
                style={{
                  background: token.colorFillQuaternary,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 15,
                  lineHeight: 1.85,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <RichText text={turn.content} />
              </div>
            ) : (
              <div
                key={index}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '86%',
                  background: token.colorPrimaryBg,
                  color: token.colorText,
                  borderRadius: 12,
                  padding: '8px 14px',
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {turn.content}
              </div>
            ),
          )}

          {loading && turns.length > 0 ? (
            <Space size={8}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                正在回答…
              </Text>
            </Space>
          ) : null}

          {error ? <Alert type="warning" showIcon title="没能生成回答" description={error} /> : null}
        </div>

        {turns.length ? (
          <Space size={6} wrap style={{ marginTop: 12 }}>
            {QUICK_ASKS.map((item) => (
              <Tag
                key={item}
                style={{ cursor: loading ? 'not-allowed' : 'pointer', marginInlineEnd: 0 }}
                onClick={() => {
                  if (!loading) void send(item)
                }}
              >
                {item}
              </Tag>
            ))}
          </Space>
        ) : null}

        <Space.Compact style={{ width: '100%', marginTop: 12 }}>
          <Input.TextArea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="接着问，比如「为什么这一步要变号」"
            autoSize={{ minRows: 1, maxRows: 3 }}
            maxLength={200}
            onPressEnter={(event) => {
              if (event.shiftKey) return
              event.preventDefault()
              void send()
            }}
          />
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => void send()} />
        </Space.Compact>

        <Space size={8} wrap style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            by geekline.tech
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            · AI 讲解可能有偏差，请对照课本结论
          </Text>
        </Space>
      </Modal>
    </>
  )
}
