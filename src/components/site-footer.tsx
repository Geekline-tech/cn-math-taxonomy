import { Layout, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/explore', label: '知识图谱' },
  { to: '/diagnose', label: '诊断' },
  { to: '/children', label: '学习档案' },
]

export function SiteFooter() {
  return (
    <Layout.Footer style={{ textAlign: 'center' }}>
      <Space direction="vertical" size={8}>
        <Space size={16} wrap>
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
          <a href="https://github.com/xiaoyang111222/cn-math-taxonomy" target="_blank" rel="noreferrer">
            数据仓库
          </a>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Origin · 对齐 2022 版课程标准与人教版教材。内容为 AI 生成初稿，未经一线教师审核，先修关系与答案请以教学实际为准。
        </Typography.Text>
      </Space>
    </Layout.Footer>
  )
}
