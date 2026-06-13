# TSBook2 待办事项

## 1. 🔄 单元格编辑/阅读模式切换

**现状**: 源码区有编辑/阅读模式（TipTap 编辑态 ↔ 只读态），译文区有编辑/阅读模式（textarea ↔ marked 渲染）。但：

- **问题 1**: 两个区域**无法自由切换**。当前是首次进入时都是编辑态，双击切换到只读后无法切换回来，也没有对阅读模式的特定 UI 提示
- **问题 2**: 阅读模式下源码区应当渲染为 Markdown（当前 TipTap 在只读态下虽然渲染 HTML，但行为和视图不够"阅读"）
- **问题 3**: 译文区阅读模式已通过 marked 渲染，但切换回编辑态的交互不够清晰

**目标**: 统一两个区域的切换行为

### 具体要求

- [x] 源码区：进入阅读模式时，TipTap 设置为 `editable: false`，显示为干净只读的 Markdown 渲染视图；双击（或右上角 Edit 按钮）进入编辑态，顶部显示编辑工具栏（Done/Cancel）
- [x] 译文区：阅读模式（marked 渲染）→ 双击 / Edit 按钮 → 编辑模式（textarea + 顶部 toolbar）→ Done/Cancel → 回到阅读模式
- [x] 两个区域在阅读模式下要有清晰的 "Double-click to edit" 提示（光标、tooltip 或底部指示线）
- [x] 新增快捷键：`Ctrl+Shift+E` 切换当前选中 Cell 的源码区编辑/阅读模式

***

## 2. 📖 译文区阅读模式 Markdown 渲染（已部分实现）

**现状**: CellOutput 已通过 `marked` 实现阅读模式的 Markdown HTML 渲染（含 `.md-body` 样式）。
**问题**: 源码区（CellEditor）在阅读模式下仍通过 TipTap 渲染 HTML，样式表现不够清晰

### 待办（已完成）

- [x] 源码区阅读模式也引入 `marked` 渲染（`stripHtml` + `marked.parse`，样式与 CellOutput 一致）
- [x] 统一两个区域的阅读模式 CSS 变量（字体、间距、颜色从 ThemeConfig 和 `readingFontSize` 读取）

***

## 3. 🤖 模型设置与翻译功能完善

### 3.1 已完成

- [x] 翻译服务层 `TranslationService`（`src/services/translationService.ts`）
- [x] `OllamaProvider` — POST `/api/generate`，连接测试通过 `/api/tags`
- [x] `OpenAIProvider` — POST `/chat/completions`，支持代理和环境变量 API Key
- [x] `ArkProvider` — 火山引擎 Ark OpenAI 兼容 API（自定义提供者）
- [x] `ProviderFactory` — 内置/自定义提供者热插拔
- [x] `useTranslationService` React Hook — 翻译/取消/状态轮询/连接测试
- [x] CellToolbar ▶ 按钮绑定翻译动作
- [x] 设置面板（SettingsDialog）连接测试按钮
- [x] 批量翻译所有单元格（`translateAll`）
- [x] 设置持久化 500ms 防抖（`debouncedSave`）

### 3.2 待办

- [x] 翻译进度可视化增强（状态栏或底部面板显示实时进度）
- [ ] 翻译错误重试机制
- [ ] 翻译缓存（相同原文不重复翻译）
- [ ] 后台翻译不阻塞 UI（当前为顺序 async/await，翻译大量单元格时可能卡顿）

***

## 4. 📚 背诵模式功能开发

对标原 TransNb 的 `src/recitation/` 模块，实现完整的单词学习系统。（TranslationService 已预留 `generateSceneText` 接口）

### 4.1 数据层

- [ ] 定义数据模型：`Book`, `Word`, `UserStudy`（参考原项目 `models.py`）
- [ ] 实现 SQLite 数据库管理（IndexedDB 或通过 Electron IPC + better-sqlite3）
- [ ] 实现数据访问层：`BookDAL`, `WordDAL`, `UserStudyDAL`, `StatDAL`
- [ ] 实现词书导入器：解析 KyleBing 格式 JSON

### 4.2 学习算法

- [ ] 实现艾宾浩斯遗忘曲线算法（8 个复习阶段）
- [ ] 实现 `StudyService`：每日新词/复习逻辑、权重计算
- [ ] 实现 `BookService`：词书管理、进度计算

### 4.3 UI

- [ ] 背诵模式主页面（词书列表、学习进度、今日单词）
- [ ] 单词检测/自测页面（QuizPage）
- [ ] 背诵模式设置面板（每日新词数、复习数）
- [ ] 侧边栏新增背诵模式 Tab
- [ ] 文章生成器集成（AI 生成包含今日单词的场景文章 → 保存为 .transnb 文件）

***

## 5. 📝 工程优化

- [ ] 设置面板环境变量配置 UI 增强（方便添加/编辑 `ARK_API_KEY`、`OPENAI_API_KEY` 等）
- [ ] 提示词模板的变量替换预览（`{input}` 占位符实时预览）
- [ ] 翻译进度反馈（状态栏或底部面板显示进度）
- [ ] 应用关闭时强制保存设置（`saveToDisk` 立即执行，跳过防抖）

***

## 6. ⌨️ 快捷键完善

**现状**: `useKeyboard` Hook 已注册单元格操作快捷键（插入/删除/复制/合并/折叠/导航），但缺少常见的文件操作快捷键（保存/打开/另存为/导入）和部分单元格操作快捷键（翻译/编辑模式切换）。

### 待办

#### 文件操作快捷键

- [ ] `Ctrl+S` — 保存当前文件（`fileService.saveFile()`）
- [ ] `Ctrl+Shift+S` — 另存为（`fileService.saveFileAs()`）
- [ ] `Ctrl+O` — 打开文件（`fileService.openFile()`）
- [ ] `Ctrl+Shift+O` — 从文件管理器打开文件（预留）
- [ ] `Ctrl+Shift+I` — 导入文本文件（`fileService.importText()`）

#### 单元格操作快捷键

- [ ] `Ctrl+Shift+E` — 切换当前选中单元格的编辑/阅读模式
- [ ] `Ctrl+Enter` — 翻译当前选中单元格
- [ ] `Ctrl+Shift+Enter` — 翻译全部单元格
- [ ] `Ctrl+Z` — 撤销（撤回上一步单元格内容更改，预留）
- [ ] `Ctrl+Shift+Z` / `Ctrl+Y` — 重做（预留）

#### 显示/导航快捷键

- [ ] `Ctrl+Shift+Q` — 全部折叠原文（已有 `Ctrl+Shift+Q`，但快捷键表中缺失 `Ctrl+Q` 的描述——单个原文折叠当前单元格）
- [ ] `Ctrl+Shift+W` — 全部折叠译文（同上，`Ctrl+W` 单个译文折叠描述缺失）
- [ ] `Ctrl+B` — 切换侧边栏显示
- [ ] `Ctrl+J` — 切换底部面板显示

***

## 7. 🏷️ 新建文件支持标题修改文件名

**现状**: 新建文件时标题（NotebookEditor 顶部文件名）只读显示，不可编辑。

**目标**: 允许用户在新建未保存的文件时，双击标题或点击重命名按钮修改文件名（无需打开系统重命名对话框），修改后同步更新 `notebook.name`。

- [ ] NotebookEditor 顶部文件名在未保存状态（`path === null`）可点击编辑
- [ ] 点击后变为内联输入框，支持 Enter 确认、Escape 取消
- [ ] 确认后更新 `notebookStore.setFilePath` 更新文件名

***

## 8. 🎨 UI/UX 改进

### 8.1 图标美化

**现状**: 软件中的图标（搜索、文件夹、设置等）使用 Unicode 字符或简单符号，视觉风格不够统一。

- [ ] 替换 ActivityBar 图标为 SVG 图标（搜索、文件夹、设置）
- [ ] 替换 FileExplorer 中的文件夹/文件图标
- [ ] 替换侧边栏切换按钮图标
- [ ] 统一图标风格和尺寸

### 8.2 用户自定义主题

**现状**: 仅支持 light/dark 两套固定主题色，用户无法自定义。

**目标**: 允许用户自定义主题颜色（背景色、前景色、编辑器背景色等关键色），实现个性化界面。

- [ ] `settingStore` 新增 `customTheme: Partial<ThemeConfig> | null` 字段
- [ ] `themeStore` 支持合并自定义主题覆盖（customTheme + light/dark 基础主题）
- [ ] `SettingsDialog` 新增 "Appearance" 标签页，包含颜色选择器
- [ ] 允许用户修改至少以下关键色：背景色、前景色、编辑器背景色、主色调
- [ ] 自定义主题持久化到 settings.json

