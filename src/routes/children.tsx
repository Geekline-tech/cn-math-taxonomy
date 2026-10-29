import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LogoutOutlined,
  PlusOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getArchive, putArchive } from '@/lib/api'
import { AuthModal } from '@/components/auth-modal'
import { useAuth, useAuthStore } from '@/lib/auth'
import type { Child, ChildRecord, ImportSummary } from '@/lib/children-store'
import * as store from '@/lib/children-store'

const { Text } = Typography

const SUBJECT_LABEL = { math: '数学', chinese: '语文', english: '英语', physics: '物理' } as const

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ChildrenPage() {
  const { message, modal } = AntdApp.useApp()
  const navigate = useNavigate()
  const [, forceUpdate] = useReducer((value: number) => value + 1, 0)
  const [editing, setEditing] = useState<Child | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form] = Form.useForm<{ name: string; grade: string; textbook: string }>()
  const [cloudBusy, setCloudBusy] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { token, user, signedIn, isAdmin } = useAuth()
  const clearAuth = useAuthStore((state) => state.clear)

  const children = store.list()
  const active = store.current()
  const records: ChildRecord[] = active ? store.recordsOf(active.id) : []
  const refresh = () => forceUpdate()

  const openAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ textbook: store.TEXTBOOKS[0] })
    setFormOpen(true)
  }

  const openEdit = (child: Child) => {
    setEditing(child)
    form.setFieldsValue({ name: child.name, grade: child.grade, textbook: child.textbook })
    setFormOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const result = editing ? store.update(editing.id, values) : store.add(values)
    if (!result.ok) {
      message.error(result.error ?? '保存失败')
      return
    }
    message.success(editing ? '已更新' : '已创建')
    setFormOpen(false)
    refresh()
  }

  const doExport = () => {
    try {
      const backup = store.exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `origin-档案-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      message.success('备份已导出')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  const doImport = async (file: File) => {
    try {
      const text = await file.text()
      mergeText(text)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '文件解析失败')
    }
    return false
  }

  const mergeText = (text: string) => {
    const backup = store.parseBackup(text)
    const summary: ImportSummary = store.previewImport(backup)
    modal.confirm({
      title: '确认合并导入',
      width: 520,
      content: (
        <Space direction="vertical" size={4}>
          <Text>
            新增孩子 {summary.addedChildren} 个，同名改称 {summary.renamedChildren} 个，匹配到已有档案{' '}
            {summary.matchedChildren} 个。
          </Text>
          <Text>
            新增记录 {summary.addedRecords} 条，更新 {summary.updatedRecords} 条，保留本机较新记录 {summary.keptRecords}{' '}
            条。
          </Text>
          {summary.children.map((item) => (
            <Text key={item.name} type="secondary" style={{ fontSize: 12 }}>
              {item.name}
              {item.action === 'rename' ? `（原 ${item.sourceName}）` : ''} · {item.records} 条记录
            </Text>
          ))}
        </Space>
      ),
      okText: '合并导入',
      cancelText: '取消',
      onOk: () => {
        try {
          store.importBackup(backup, summary.token)
          message.success('导入完成')
          refresh()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '导入失败')
        }
      },
    })
  }

  const doCloudBackup = async () => {
    if (!signedIn) {
      setAuthOpen(true)
      return
    }
    setCloudBusy(true)
    try {
      await putArchive(token, store.exportBackup())
      message.success('已保存到云端账号')
      refresh()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '云端备份失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const doCloudRestore = async () => {
    if (!signedIn) {
      setAuthOpen(true)
      return
    }
    setCloudBusy(true)
    try {
      const result = await getArchive(token)
      if (result.empty || !result.payload) {
        message.info('这个账号还没有云端档案，先备份一次')
        return
      }
      mergeText(JSON.stringify(result.payload))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '云端读取失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const doSignOut = () => {
    clearAuth()
    message.success('已退出云端账号')
    refresh()
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 24px 0' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title="孩子档案"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={children.length >= store.MAX_CHILDREN}>
                新建
              </Button>
            }
          >
            {children.length ? (
              <List
                dataSource={children}
                renderItem={(child) => (
                  <List.Item
                    actions={[
                      <Button
                        key="use"
                        type="link"
                        size="small"
                        disabled={child.id === active?.id}
                        onClick={() => {
                          store.setCurrent(child.id)
                          refresh()
                        }}
                      >
                        {child.id === active?.id ? '当前' : '切换'}
                      </Button>,
                      <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(child)} />,
                      <Popconfirm
                        key="del"
                        title="删除这个孩子？"
                        description="他的诊断记录也会一起删除，且无法恢复。"
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onConfirm={() => {
                          store.remove(child.id)
                          refresh()
                          message.success('已删除')
                        }}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined style={{ fontSize: 20 }} />}
                      title={
                        <Space size={6}>
                          <Text strong>{child.name}</Text>
                          {child.id === active?.id ? <Tag color="blue">当前</Tag> : null}
                        </Space>
                      }
                      description={`${child.grade} · ${child.textbook}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有档案，先建一个">
                <Button type="primary" onClick={openAdd}>
                  新建孩子
                </Button>
              </Empty>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              档案只存在这台设备的浏览器里，不上传、不需要账号。换设备请用下面的备份导出与导入。
            </Text>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={active ? `${active.name} 的诊断记录` : '诊断记录'}
            extra={
              <Space wrap>
                <Dropdown
                  menu={{
                    items: signedIn
                      ? [
                          {
                            key: 'backup',
                            icon: <CloudUploadOutlined />,
                            label: '保存到云端',
                            onClick: () => void doCloudBackup(),
                          },
                          {
                            key: 'restore',
                            icon: <CloudDownloadOutlined />,
                            label: '从云端取回',
                            onClick: () => void doCloudRestore(),
                          },
                          ...(isAdmin
                            ? [
                                {
                                  key: 'admin',
                                  icon: <UserOutlined />,
                                  label: '管理后台',
                                  onClick: () => navigate('/admin'),
                                },
                              ]
                            : []),
                          { type: 'divider' as const },
                          {
                            key: 'signout',
                            icon: <LogoutOutlined />,
                            label: `退出 ${user?.username ?? ''}`,
                            onClick: doSignOut,
                          },
                        ]
                      : [
                          {
                            key: 'signin',
                            icon: <UserOutlined />,
                            label: '登录 / 注册',
                            onClick: () => setAuthOpen(true),
                          },
                        ],
                  }}
                >
                  <Button icon={<CloudUploadOutlined />} loading={cloudBusy}>
                    {signedIn ? user?.username : '云端'}
                  </Button>
                </Dropdown>
                <Button icon={<DownloadOutlined />} onClick={doExport} disabled={!children.length}>
                  导出备份
                </Button>
                <Upload accept=".json" showUploadList={false} beforeUpload={doImport}>
                  <Button icon={<UploadOutlined />}>导入备份</Button>
                </Upload>
              </Space>
            }
          >
            {active ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label="年级">{active.grade}</Descriptions.Item>
                  <Descriptions.Item label="教材">{active.textbook}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{formatTime(active.createdAt)}</Descriptions.Item>
                </Descriptions>
                <Row gutter={12}>
                  <Col span={8}>
                    <Statistic title="记录数" value={records.length} />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="最近一次"
                      value={records.length ? formatTime(records[0].savedAt).slice(0, 10) : '—'}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="覆盖学科"
                      value={new Set(records.map((record) => record.subject)).size}
                    />
                  </Col>
                </Row>
                {records.length ? (
                  <List
                    size="small"
                    dataSource={records}
                    renderItem={(record) => (
                      <List.Item
                        actions={[
                          <Popconfirm
                            key="del"
                            title="删除这条记录？"
                            okText="删除"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => {
                              store.removeRecord(active.id, record.key)
                              refresh()
                            }}
                          >
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space size={8} wrap>
                              <Tag color="blue">{SUBJECT_LABEL[record.subject] ?? record.subject}</Tag>
                              <Text>{record.label || '未命名诊断'}</Text>
                              {record.mode === 'screen' ? <Tag>整册筛查</Tag> : null}
                            </Space>
                          }
                          description={
                            <Space size={12} wrap>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {formatTime(record.savedAt)}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                掌握 {record.mastered?.length ?? 0} · 不稳 {record.shaky?.length ?? 0} · 薄弱{' '}
                                {record.weak?.length ?? 0}
                              </Text>
                              {record.asked != null ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  答 {record.asked} 题
                                </Text>
                              ) : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有诊断记录，去诊断页做一次" />
                )}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选一个孩子" />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={formOpen}
        title={editing ? '编辑孩子' : '新建孩子'}
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="昵称"
            rules={[
              { required: true, message: '请填写昵称' },
              { max: 12, message: '最多 12 个字' },
            ]}
          >
            <Input placeholder="例如 小满" maxLength={12} showCount />
          </Form.Item>
          <Form.Item name="grade" label="年级" rules={[{ required: true, message: '请选择年级' }]}>
            <Select placeholder="选择年级" options={store.GRADES.map((grade) => ({ value: grade, label: grade }))} />
          </Form.Item>
          <Form.Item name="textbook" label="教材版本">
            <Select options={store.TEXTBOOKS.map((book) => ({ value: book, label: book }))} />
          </Form.Item>
        </Form>
      </Modal>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

    </div>
  )
}
