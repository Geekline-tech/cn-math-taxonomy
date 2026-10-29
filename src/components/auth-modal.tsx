import { App as AntdApp, Form, Input, Modal, Tabs, Typography } from 'antd'
import { useState } from 'react'
import { login, register } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

const { Text } = Typography

type Mode = 'login' | 'register'

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = AntdApp.useApp()
  const setSession = useAuthStore((state) => state.setSession)
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<{ username: string; password: string }>()

  const submit = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const result = mode === 'login' ? await login(values.username, values.password) : await register(values.username, values.password)
      setSession(result.token, result.user)
      message.success(mode === 'login' ? `已登录：${result.user.username}` : '注册成功，已登录')
      form.resetFields()
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={mode === 'login' ? '登录' : '注册并登录'}
      cancelText="取消"
      confirmLoading={loading}
      width="min(420px, 92vw)"
      title="云端账号"
      destroyOnHidden
    >
      <Tabs
        activeKey={mode}
        onChange={(key) => setMode(key as Mode)}
        items={[
          { key: 'login', label: '登录' },
          { key: 'register', label: '注册' },
        ]}
      />
      <Form form={form} layout="vertical" style={{ marginTop: 4 }} onFinish={submit}>
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
          extra={mode === 'register' ? '3 到 20 位，中文、字母、数字、下划线' : undefined}
        >
          <Input placeholder="用户名" autoComplete="username" maxLength={20} />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '至少 6 位' },
          ]}
        >
          <Input.Password placeholder="密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={64} />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12 }}>
          账号只用来把学习档案存到云端，换设备登录就能取回。AI 讲解不需要登录。
        </Text>
      </Form>
    </Modal>
  )
}
