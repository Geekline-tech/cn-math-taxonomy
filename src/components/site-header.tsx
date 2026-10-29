import { MenuOutlined } from '@ant-design/icons'
import { Button, Divider, Drawer, Flex, Grid, Layout, Menu, Segmented, Space, theme } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { SUBJECTS, type SubjectKey } from '@/lib/subjects'
import { useAuth } from '@/lib/auth'
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
  const { isAdmin } = useAuth()
  const nav = isAdmin ? [...NAV, { key: '/admin', label: '管理' }] : NAV
  const screens = Grid.useBreakpoint()
  const [menuOpen, setMenuOpen] = useState(false)
  const mobile = !screens.md

  const selected = nav.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ?? '/'
  const go = (key: string) => {
    navigate(key)
    setMenuOpen(false)
  }

  const subjectSwitch = (
    <Segmented
      size="small"
      value={subject}
      options={SUBJECTS.map((item) => ({ value: item.key, label: item.label }))}
      onChange={(value) => setSubject(value as SubjectKey)}
    />
  )

  return (
    <Layout.Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: mobile ? 8 : 16,
        paddingInline: mobile ? 12 : 24,
        height: mobile ? 56 : undefined,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Link
        to="/"
        style={{ display: 'flex', alignItems: 'center', gap: 8, color: token.colorPrimary, flexShrink: 0 }}
      >
        <Logo />
        {mobile ? null : (
          <span style={{ fontSize: 18, fontWeight: 600, color: token.colorText, letterSpacing: '-0.02em' }}>
            Origin
          </span>
        )}
      </Link>

      {mobile ? (
        <>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>{subjectSwitch}</div>
          <Button
            type="text"
            aria-label="菜单"
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(true)}
            style={{ flexShrink: 0 }}
          />
        </>
      ) : (
        <>
          <Menu
            mode="horizontal"
            selectedKeys={[selected]}
            items={nav}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent' }}
          />
          <Space size={8}>
            {subjectSwitch}
            <ThemeToggle />
            <Button type="primary" onClick={() => navigate('/diagnose')}>
              开始诊断
            </Button>
          </Space>
        </>
      )}

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement="right"
        width={240}
        title="Origin"
        styles={{ body: { paddingTop: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={nav}
          onClick={({ key }) => go(key)}
          style={{ border: 'none' }}
        />
        <Divider style={{ margin: '12px 0' }} />
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Button type="primary" block onClick={() => go('/diagnose')}>
            开始诊断
          </Button>
          <Flex justify="space-between" align="center">
            <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>外观</span>
            <ThemeToggle />
          </Flex>
        </Space>
      </Drawer>
    </Layout.Header>
  )
}
