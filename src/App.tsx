import { App as AntdApp, ConfigProvider, Layout, Skeleton, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider, useTheme } from '@/lib/theme'

const HomePage = lazy(() => import('@/routes/home').then((mod) => ({ default: mod.HomePage })))
const ExplorePage = lazy(() => import('@/routes/explore').then((mod) => ({ default: mod.ExplorePage })))
const DiagnosePage = lazy(() => import('@/routes/diagnose').then((mod) => ({ default: mod.DiagnosePage })))
const ChildrenPage = lazy(() => import('@/routes/children').then((mod) => ({ default: mod.ChildrenPage })))

function PageFallback() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  )
}

function AppLayout() {
  const location = useLocation()
  const hideFooter = location.pathname.startsWith('/explore')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <Layout.Content>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/diagnose" element={<DiagnosePage />} />
            <Route path="/children" element={<ChildrenPage />} />
          </Routes>
        </Suspense>
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
