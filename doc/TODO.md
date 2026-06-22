# TSBook2 待办事项

> 最后更新: 2026-06-13 | 当前版本: v1.2

***

## 1. 📝 基础功能完善

### 1.1 ✅ 已完成 (v1.1)

- [x] 单元格编辑/阅读模式切换（源码区 TipTap 编辑态 ↔ 只读态，译文区 textarea ↔ marked）
- [x] 源码区阅读模式使用 `marked` 渲染 Markdown（`stripHtml` + `marked.parse`）
- [x] 统一两个区域的阅读模式 CSS 变量
- [x] Escape 键退出编辑模式
- [x] 快捷键：`Ctrl+Shift+E` 切换编辑/阅读模式（`useKeyboard`）

### 1.2 🔄 待优化

- [ ] **翻译错误重试机制**: 翻译失败时自动重试或提供手动重试按钮
- [ ] **翻译缓存**: 相同原文不重复翻译（基于原文 hash 缓存）
- [ ] **后台翻译非阻塞**: 当前为顺序 async/await，翻译大量单元格时可能卡顿

***

## 2. 📚 背诵模式功能

**现状**: 对标原 TransNb 的 `src/recitation/` 模块，已完成完整的单词学习系统开发。

### 2.1 ✅ 已完成

#### 数据层 (electron/recitation/)

- [x] 定义数据模型：`Book`, `Word`, `UserStudy`（`src/recitation/types.ts`）
- [x] SQLite 数据库管理（`database.ts` — better-sqlite3）
- [x] 数据访问层：`BookDAL`, `WordDAL`, `UserStudyDAL`, `StatDAL`, `RecitationDAL`
- [x] 词书导入器：解析 KyleBing 格式 JSON（`bookImporter.ts`）

#### 学习算法

- [x] 艾宾浩斯遗忘曲线算法（8 个复习阶段，`ebbinghaus.ts`）
- [x] `StudyService` — 每日新词/复习逻辑
- [x] `BookService` — 词书管理、进度计算

#### IPC 通道 (electron/)

- [x] 完整的 `recitationAPI` IPC 处理器（init / CRUD 词书和单词 / 学习流程 / 配置读写）
- [x] 单词增删改 IPC 通道（`addWord`, `updateWord`, `deleteWord`）

#### 前端服务层

- [x] `RecitationService` 接口 + `createRecitationService()`（`src/services/recitationService.ts`）
- [x] `useRecitationService()` React Hook（模块级单例）
- [x] `RecitationStore`（Zustand，管理 UI 状态：模式/阶段/侧边栏数据/检测状态）
- [ ] 词书管理欠缺很多基础功能

#### UI 组件

- [x] `RecitationShell` — 背诵模式主容器（替换 NotebookEditor 区域）
- [x] `BookManagerPanel` + `BookCard` — 词书管理界面（列表/进度/导入/删除）
- [x] `WordSidebar` — 右侧单词侧边栏（新词/复习批次/勾选操作）
- [x] `QuizPanel` + `FloatingOptions` — 单词检测界面（4 选 1/悬浮选项动画）
- [x] `ReviewPanel` — 回顾总结界面（答题结果统计）
- [x] `WordManagerDialog` + `WordEditorDialog` — 单词管理弹窗（CRUD）
- [x] `ResizeHandle` — 主区域/侧边栏拖拽分割
- [x] `WordListItem` — 单词条目渲染

#### 主题系统

- [x] `ThemeConfig` 扩展 16 个背诵相关颜色键（`recitationBackground`, `quizCard*`, `wordNewColor` 等）
- [x] 浅色/深色主题均已完成背诵色值

#### 布局集成

- [x] `ActivityBar` 新增背诵模式图标切换
- [x] `AppShell` 条件渲染（正常模式 ↔ 背诵模式）
- [x] 场景文章生成预留（`TranslationService.generateSceneText`）

### 2.2 📋 待优化

- [x] **每日新词数/复习数设置**: 通过 `recitationAPI.setConfig` 配置 `daily_new_words` / `daily_review_words`
- [ ] **背诵设置面板**: 在 SettingsDialog 中集成背诵模式配置
- [ ] **文章生成器集成**: AI 生成包含今日单词的场景文章 → 保存为 .transnb 文件
- [x] **背诵统计可视化**: 学习时长、正确率趋势等图表

***

## 3. ⌨️ 快捷键完善

**现状**: `useKeyboard` Hook 已注册单元格操作快捷键和部分背诵模式快捷键。

### 3.1 ✅ 已完成

- [x] `Ctrl+N` — 插入下方（已有）
- [x] `Ctrl+Shift+A` — 插入上方（已有）
- [x] `Delete` — 删除选中（已有）
- [x] `Ctrl+D` — 复制（已有）
- [x] `Ctrl+M` — 合并（已有）
- [x] `Ctrl+F` — 从属关系切换（已有）
- [x] `Ctrl+E` — 折叠/展开（已有）
- [x] `Ctrl+Q` / `Ctrl+Shift+Q` — 原文折叠（已有）
- [x] `Ctrl+W` / `Ctrl+Shift+W` — 译文折叠（已有）

### 3.2 📋 待添加

#### 文件操作

- [x] `Ctrl+S` — 保存当前文件（`fileService.saveFile()`）
- [ ] `Ctrl+Shift+S` — 另存为（`fileService.saveFileAs()`）
- [ ] `Ctrl+O` — 打开文件（`fileService.openFile()`）
- [ ] `Ctrl+Shift+I` — 导入文本文件（`fileService.importText()`）
- [ ] -\`Ctrl+Shift+-\` — 在编辑模式下光标位置分割单元格，分割的单元格继承单元格的层级，若自己拥有从属单元格则由后半段分割出的单元格插入到前半段分割出的单元的从属单元格的最前端。输出栏的内容复制双分给两个单元格

  你觉得完成这
- [ ] <br />

#### 单元格操作

- [ ] `Ctrl+Enter` — 翻译当前选中单元格
- [ ] `Ctrl+Shift+Enter` — 翻译全部单元格
- [ ] `Ctrl+Z` / `Ctrl+Shift+Z` — 撤销/重做（预留）
- [ ]  `Ctrl+Shift+-` — 在编辑模式下光标位置分割单元格，分割的单元格继承单元格的层级，若自己拥有从属单元格则由后半段分割出的单元格插入到前半段分割出的单元的从属单元格的最前端。输出栏的内容复制双分给两个单元格

#### 显示/导航

- [ ] `Ctrl+B` — 切换侧边栏显示
- [ ] `Ctrl+J` — 切换底部面板显示

***

## 4. 🏷️ 文件与导入改进

### 4.1 已完成

- [x] 新建未保存文件时双击标题可编辑（内联输入框，Enter 确认、Escape 取消）
- [x] 导入流程：文本分割（`splitTextIntoParagraphs`）、文件类型过滤
- [x] `wordMeta` 字段支持（`NotebookData.wordMeta` — 文章关联词书单词元数据）

### 4.2 待完善

- [ ] **翻译进度可视化**: ✅ 已完成（底部 Panel + 单元格状态指示器 + "翻译全部"按钮）
- [ ] **环境变量配置 UI 增强**: 方便添加/编辑 `ARK_API_KEY`、`OPENAI_API_KEY` 等
- [ ] **提示词模板变量替换预览**: `{input}` 占位符实时预览
- [ ] **应用关闭时强制保存设置**: 跳过防抖

***

## 5. 🎨 UI/UX 改进

### 5.1 图标美化

- [ ] 替换 ActivityBar 图标为 SVG（搜索、文件夹、设置、背诵）
- [ ] 替换 FileExplorer 中的文件夹/文件图标
- [ ] 统一图标风格和尺寸

### 5.2 用户自定义主题

- [ ] `settingStore` 新增 `customTheme: Partial<ThemeConfig> | null`
- [ ] `themeStore` 支持合并自定义主题覆盖
- [ ] `SettingsDialog` 新增 "Appearance" 标签页，包含颜色选择器
- [ ] 支持修改关键色：背景色、前景色、编辑器背景色、主色调
- [ ] 自定义主题持久化到 settings.json

***

## 6. 工程优化 (已完成)

- [x] **v1.1 服务层提取**: 从 `notebookStore` 提取业务逻辑到独立 Service Hooks
- [x] **v1.2 代码质量重构**:
  - [x] 删除死代码（`services/fileService.ts`, `services/cellService.ts`）
  - [x] 统一类型定义（消除 5+ 组重复类型）
  - [x] 解耦 Store 交叉引用（settingStore ↔ themeStore 通过回调解耦）
  - [x] 消除 `recentFiles` 职责冗余（workspaceStore → settingStore）
  - [x] IPC 类型安全（`as unknown` → 具体类型）
  - [x] 创建 `src/types/electron.ts` 共享 IPC 类型
  - [x] 修复 IPC 字段命名不一致（移除 snake\_case fallback）
  - [x] `useFileService` 通过回调解耦（不再直接调用 settingStore）
- [x] **翻译进度可视化增强**: 逐单元格状态跟踪 + 底部 Panel 进度 + 单元格状态指示器
- [x] **设置持久化 500ms 防抖**
- [x] **翻译模块策略模式**: Ollama / OpenAI / Ark Provider
- [x] **背诵模式完整实现**: 数据层 → IPC → 服务层 → UI

## 7.阅读界面

- [ ] 阅读计时功能

