import { BulbOutlined, CheckOutlined } from '@ant-design/icons'
import { Button, Dropdown, type MenuProps } from 'antd'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { mode, setMode } = useTheme()

  const items: MenuProps['items'] = [
    { key: 'light', label: '浅色', icon: mode === 'light' ? <CheckOutlined /> : null },
    { key: 'dark', label: '深色', icon: mode === 'dark' ? <CheckOutlined /> : null },
    { key: 'system', label: '跟随系统', icon: mode === 'system' ? <CheckOutlined /> : null },
  ]

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items,
        selectable: true,
        selectedKeys: [mode],
        onClick: ({ key }) => setMode(key as 'light' | 'dark' | 'system'),
      }}
    >
      <Button type="text" icon={<BulbOutlined />} aria-label="切换主题" />
    </Dropdown>
  )
}
