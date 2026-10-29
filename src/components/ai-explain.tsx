import { RobotOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Space, Spin, Tag, Typography } from 'antd'
import { useState } from 'react'
import { apiEnabled, explain, type ExplainInput } from '@/lib/api'

const { Paragraph, Text } = Typography

export function AiExplain({ input, label = 'AI 讲解' }: { input: ExplainInput; label?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [meta, setMeta] = useState<{ model: string; cached: boolean } | null>(null)
  const [error, setError] = useState('')

  if (!apiEnabled) return null

  const start = () => {
    setOpen(true)
    if (text || loading) return
    setLoading(true)
    setError('')
    explain(input)
      .then((result) => {
        setText(result.text)
        setMeta({ model: result.model, cached: result.cached })
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'AI 讲解失败')
      })
      .finally(() => setLoading(false))
  }

  return (
    <>
      <Button size="small" icon={<RobotOutlined />} onClick={start}>
        {label}
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        title={input.topic ? `AI 讲解 · ${input.topic}` : 'AI 讲解'}
      >
        {loading ? (
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '32px 0' }}>
            <Spin />
            <Text type="secondary">正在按这道题的错误点讲解…</Text>
          </Space>
        ) : null}
        {error ? <Alert type="warning" showIcon title="没能生成讲解" description={error} /> : null}
        {text ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 15, lineHeight: 1.85 }}>
              {text}
            </Paragraph>
            {meta ? (
              <Space size={8} wrap>
                <Tag>{meta.model.replace('@cf/', '')}</Tag>
                {meta.cached ? <Tag color="default">命中缓存</Tag> : null}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI 讲解只针对这一次作答，可能有偏差，请对照课本结论。
                </Text>
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </>
  )
}
