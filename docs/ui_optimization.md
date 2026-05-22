# UI 优化指南

本文档介绍前端 UI 组件的优化方案。

## 新增组件

### 设计系统 (`ui/DesignSystem.tsx`)

提供统一的设计 Token 和基础组件：

```tsx
import { tokens, Button, Input, Card, Badge, Spinner, Avatar } from './ui';
```

**Design Tokens:**
- `tokens.radius` - 圆角规范 (sm/md/lg/xl/full)
- `tokens.shadow` - 阴影规范 (sm/md/lg/glow)
- `tokens.transition` - 过渡动画时长

**基础组件:**
- `Button` - 支持 primary/secondary/ghost/danger 变体
- `Input` - 支持 label、error、icon
- `Textarea` - 多行输入
- `Select` - 下拉选择
- `Card` - 卡片容器，支持 hover 效果
- `Badge` - 徽章标签
- `Spinner` - 加载动画
- `Avatar` - 用户头像
- `Tooltip` - 工具提示
- `Divider` - 分隔线
- `EmptyState` - 空状态展示

### 增强组件

#### 1. 聊天视图 (`EnhancedChatView.tsx`)

改进的消息展示界面：
- 头像和用户名
- 消息时间戳
- 渐变背景的消息气泡
- 代码块样式优化
- 打字动画
- 自动滚动指示器

```tsx
import { EnhancedChatView } from './ui';

<EnhancedChatView
  messages={messages}
  loading={loading}
  userName="You"
  aiName="AI Assistant"
/>
```

#### 2. 消息输入框 (`EnhancedMessageInput.tsx`)

增强的输入组件：
- 自动调整高度
- 字符计数
- 词数统计
- 发送按钮动画
- 上下文信息徽章

```tsx
import { EnhancedMessageInput } from './ui';

<EnhancedMessageInput
  onSend={handleSend}
  disabled={loading}
  contextInfo={{ type: 'chapter', mode: 'chat' }}
/>
```

#### 3. 新建对话对话框 (`EnhancedNewConversationDialog.tsx`)

美化的对话框：
- 模式选择卡片
- 技能标签选择
- 动画过渡效果

```tsx
import { EnhancedNewConversationDialog } from './ui';
```

#### 4. 对话标签 (`EnhancedConversationTabs.tsx`)

改进的标签栏：
- 模式图标
- 时间显示
- 内联重命名
- 悬停显示操作按钮

```tsx
import { EnhancedConversationTabs } from './ui';
```

#### 5. 空状态组件 (`EnhancedEmptyStates.tsx`)

多种空状态：
- `ProjectEmptyState` - 项目列表为空
- `ConversationEmptyState` - 对话列表为空
- `FileTreeEmptyState` - 文件树为空
- `SkillsEmptyState` - 技能列表为空
- `LoadingState` - 加载中
- `ErrorState` - 错误状态

```tsx
import { ProjectEmptyState, LoadingState, ErrorState } from './ui';
```

### 完整面板组件

#### `EnhancedLayout.tsx`

完整的三栏布局：
- 可折叠的左右面板
- 区域指示器（文件/终端/AI/编辑器）
- 拖拽调整宽度
- 主题切换

#### `EnhancedLeftPanel.tsx`

左侧文件树面板：
- 项目标题带指示灯
- 可调整高度的技能面板
- 空状态美化

#### `EnhancedCenterPanel.tsx`

中央编辑器面板：
- 增强的标签栏（图标、脏标记）
- 视图模式切换（Source/Split/Rendered）
- 编译按钮和结果提示
- 终端显示/隐藏

#### `EnhancedRightPanel.tsx`

右侧 AI 助手面板：
- 整合所有增强组件
- 统一的设计语言

#### `EnhancedLandingPage.tsx`

首页/项目列表：
- 搜索功能
- 项目卡片网格
- 新建项目对话框
- 加载/错误/空状态

## 第二轮优化组件

### 动画与交互 (`EnhancedAnimations.tsx`)

#### Toast 通知系统
```tsx
import { ToastProvider, useToast } from './ui';

// 在组件中使用
const { addToast } = useToast();
addToast({ type: 'success', title: '保存成功', message: '文件已保存到服务器' });
```

#### 键盘快捷键显示
```tsx
<KeyboardShortcut keys={['Ctrl', 'S']} label="保存" />
```

#### 进度条
```tsx
<Progress value={75} label="编译进度" showValue size="md" />
```

#### 骨架屏
```tsx
<Skeleton width="100%" height={20} variant="text" />
```

#### 右键菜单
```tsx
<ContextMenu
  items={[
    { label: '复制', icon: '📋', onClick: handleCopy },
    { label: '删除', icon: '🗑️', onClick: handleDelete, danger: true },
  ]}
  position={{ x: 100, y: 200 }}
  onClose={() => setMenuOpen(false)}
/>
```

#### 下拉菜单
```tsx
<Dropdown
  trigger={<Button>菜单</Button>}
  items={[
    { label: '设置', icon: '⚙️', onClick: handleSettings },
    { label: '退出', icon: '🚪', onClick: handleLogout, danger: true },
  ]}
/>
```

#### 标签页
```tsx
<Tabs
  tabs={[
    { id: 'chat', label: '对话', icon: '💬', badge: 3 },
    { id: 'agent', label: 'Agent', icon: '🤖' },
    { id: 'tools', label: '工具', icon: '🔧' },
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
  variant="pills"
/>
```

#### 步骤指示器
```tsx
<Stepper
  steps={[
    { label: '创建项目', description: '设置基本信息' },
    { label: '编写内容', description: '编辑论文章节' },
    { label: '编译发布', description: '生成最终 PDF' },
  ]}
  currentStep={1}
/>
```

#### 确认对话框
```tsx
<ConfirmDialog
  title="确认删除"
  message="此操作不可撤销，确定要删除吗？"
  confirmLabel="删除"
  confirmVariant="danger"
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
/>
```

### 导航与状态栏 (`EnhancedBars.tsx`)

#### 状态栏
```tsx
<StatusBar
  items={[
    { id: 'left-mode', label: 'Markdown', icon: '📝' },
    { id: 'right-encoding', label: 'UTF-8' },
  ]}
  right={<ThemeToggle />}
/>
```

#### 面包屑导航
```tsx
<Breadcrumb
  items={[
    { label: '项目', icon: '📁', onClick: () => navigate('/') },
    { label: '论文标题' },
    { label: 'sec/intro.tex' },
  ]}
/>
```

#### 命令面板 (Ctrl+K)
```tsx
<CommandPalette
  commands={[
    { id: 'save', label: '保存文件', icon: '💾', shortcut: ['Ctrl', 'S'], action: handleSave },
    { id: 'compile', label: '编译 PDF', icon: '📄', action: handleCompile },
  ]}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onExecute={(cmd) => cmd.action()}
/>
```

#### 通知铃铛
```tsx
<NotificationBell
  notifications={[
    { id: '1', type: 'success', title: '编译完成', message: 'PDF 已生成', timestamp: Date.now() },
  ]}
  onNotificationClick={(n) => handleClick(n)}
  onMarkAllRead={() => setNotifications([])}
/>
```

#### 快捷操作浮动按钮
```tsx
<QuickActionsBar
  actions={[
    { id: 'save', icon: '💾', label: '保存', onClick: handleSave },
    { id: 'compile', icon: '📄', label: '编译', onClick: handleCompile, color: '#10b981' },
  ]}
/>
```

#### 帮助模态框
```tsx
<HelpModal
  isOpen={helpOpen}
  onClose={() => setHelpOpen(false)}
  sections={[
    {
      title: '编辑器',
      shortcuts: [
        { keys: ['Ctrl', 'S'], description: '保存文件' },
        { keys: ['Ctrl', 'Z'], description: '撤销' },
      ],
    },
  ]}
/>
```

### 终极布局 (`UltimateLayout.tsx`)

整合所有优化组件的完整布局：

```tsx
import { UltimateLayoutWithToast } from './ui';

function EditorPage() {
  return (
    <AppProvider projectId={projectId}>
      <UltimateLayoutWithToast />
    </AppProvider>
  );
}
```

**特性：**
- 顶部导航栏（Logo、面包屑、命令面板、主题、通知、帮助）
- 可折叠的左右面板
- 状态栏
- 键盘快捷键支持
- 命令面板 (Ctrl+K)
- Toast 通知系统
- 完整的帮助模态框

## 使用方法

### 方式一：逐步替换

可以在现有组件中逐步引入新组件：

```tsx
// 替换 ChatView
import { EnhancedChatView } from './ui';

function MyComponent() {
  return <EnhancedChatView messages={[]} loading={false} />;
}
```

### 方式二：使用完整布局

```tsx
// 替换 Layout
import { UltimateLayoutWithToast } from './ui';

function EditorPage() {
  return (
    <AppProvider projectId={projectId}>
      <UltimateLayoutWithToast />
    </AppProvider>
  );
}
```

### 方式三：使用设计系统

```tsx
import { Button, Card, Input, tokens } from './ui';

function MyForm() {
  return (
    <Card padding="lg">
      <Input label="用户名" placeholder="输入用户名" />
      <Button variant="primary">提交</Button>
    </Card>
  );
}
```

## 设计原则

1. **一致性** - 使用统一的设计 Token
2. **可访问性** - 支持键盘导航和焦点状态
3. **动画反馈** - 悬停、点击、加载等状态有动画
4. **空状态** - 每种状态都有友好的提示
5. **响应式** - 面板可调整大小

## 主题支持

所有组件都支持现有的主题系统：
- Basic Light
- GitHub Dark
- Dracula
- Cyber Tech (赛博科技)

组件会自动读取 CSS 变量来适配主题。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 打开命令面板 |
| `Ctrl + /` | 打开帮助 |
| `Ctrl + B` | 切换左侧面板 |
| `Ctrl + J` | 切换右侧面板 |
| `Ctrl + S` | 保存文件 |
| `Esc` | 关闭模态框/取消操作 |