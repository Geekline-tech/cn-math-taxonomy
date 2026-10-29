import { App as AntdApp, ConfigProvider, Layout, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { ChildrenPage } from '@/routes/children'
import { DiagnosePage } from '@/routes/diagnose'
import { ExplorePage } from '@/routes/explore'
import { HomePage } from '@/routes/home'

function AppLayout() {
  const location = useLocation()
  const hideFooter = location.pathname.startsWith('/explore')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <Layout.Content>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/diagnose" element={<DiagnosePage />} />
          <Route path="/children" element={<ChildrenPage />} />
        </Routes>
      </Layout.Content>
      {hideFooter ? null : <SiteFooter />}
    </Layout>
  )
}

function Shell() {
  const { resolved } = useTheme()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  )
}
