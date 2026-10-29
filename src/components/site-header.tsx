import { Button, Layout, Menu, Segmented, Space, theme } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { SUBJECTS, type SubjectKey } from '@/lib/subjects'
import { useSubject } from '@/lib/use-subject'

const NAV = [
  { key: '/', label: '首页' },
  { key: '/explore', label: '知识图谱' },
  { key: '/diagnose', label: '诊断' },
  { key: '/children', label: '档案' },
]

export function SiteHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const { subject, setSubject } = useSubject()

  const selected = NAV.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ?? '/'

  return (
    <Layout.Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingInline: 24,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: token.colorPrimary }}>
        <Logo />
        <span style={{ fontSize: 18, fontWeight: 600, color: token.colorText, letterSpacing: '-0.02em' }}>
          Origin
        </span>
      </Link>

      <Menu
        mode="horizontal"
        selectedKeys={[selected]}
        items={NAV}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent' }}
      />

      <Space size={8}>
        <Segmented
          size="small"
          value={subject}
          options={SUBJECTS.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(value) => setSubject(value as SubjectKey)}
        />
        <ThemeToggle />
        <Button type="primary" onClick={() => navigate('/diagnose')}>
          开始诊断
        </Button>
      </Space>
    </Layout.Header>
  )
}
