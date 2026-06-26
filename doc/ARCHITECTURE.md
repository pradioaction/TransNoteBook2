# TSBook2 软件架构文档

本文档为 TSBook2 架构的章节索引。完整内容按模块拆分如下：

---

## 1. 项目概述

项目定位、核心理念、技术栈、与原项目 TransNb 的对比。

> 完整内容 → [v1.3/architecture/overview.md](v1.3/architecture/overview.md)

---

## 2. 系统架构

### 2.1 整体架构图

Electron 主进程（main.ts / preload.ts / recitation/）与 React 渲染进程的完整目录树。

### 2.2 进程架构

Main Process ↔ preload.ts (contextBridge) ↔ Renderer Process 的 ASCII 架构图，含正常模式与背诵模式的组件树。

> 完整内容 → [v1.3/architecture/overview.md](v1.3/architecture/overview.md)

---

## 3. 核心模块详解

### 3.1 Electron 主进程
main.ts（IPC 处理器清单 + 安全设计）/ preload.ts（桥接 API）/ recitation/（DAL + Service）

### 3.2 状态管理层
6 个 Zustand Store（notebookStore / workspaceStore / themeStore / settingStore / recitationStore / outputStore）

### 3.3 布局层
AppShell / ActivityBar / Sidebar / StatusBar / Panel

### 3.4-3.7 业务组件
NotebookEditor / NotebookToolbar / CellContainer / CellEditor / CellOutput / FileExplorer / SettingsDialog

### 3.8 工具层
fileUtils / useKeyboard（快捷键表）/ useTheme

### 3.9 类型系统
types/（notebook.ts / electron.ts）/ recitation/（types.ts / quizTypes.ts / wordSidebarTypes.ts）

### 3.10 主题系统
themes.ts（40 颜色键）/ global.css

### 3.11 服务层
FileService / CellService / TranslationService / RecitationService 接口定义及实现模式

### 3.12 翻译模块
TranslationProvider 策略模式 / OllamaProvider / OpenAIProvider / ArkProvider / ProviderFactory

> 完整内容 → [v1.3/architecture/modules.md](v1.3/architecture/modules.md)

---

## 4. 数据流程

文件打开 / 保存 / 导入 / 单元格编辑 / 选中 / 设置加载保存 / 主题切换 — 完整流程图

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 5. 扩展点

新增翻译提供者 / 侧边栏面板 / 设置标签页 / 单元格操作 / 主题的步骤

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 6. 依赖关系

AppShell → 各组件的依赖树

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 7. 目录结构

```
TSBook2/ ├── electron/ ├── src/ └── doc/
```

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 8. 设计模式

12 种设计模式及应用位置表

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 9. 与原项目的架构差异

TransNb（PyQt5）与 TSBook2（Electron + React）全方位对比表

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 10. 性能考虑

Zustand 不可变更新 / key 优化 / 按需创建 / 主进程 I/O / debounced 持久化

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 11. 安全考虑

contextIsolation / API Key 环境变量 / 文件过滤 / 路径安全

> 完整内容 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)

---

## 12. 版本状态

> 当前版本: **v1.3** | 最后更新: 2026-06-26

### v1.1 完成
单元格编辑/阅读切换、译文渲染、翻译引擎、宽度控制、服务层

### v1.2 完成
背诵模式、翻译进度可视化、代码质量重构、单词 CRUD、欢迎页

### v1.3 完成
学习统计面板、阶段筛选、测验结果反馈、Ctrl+范围选择、已测单词追踪、pairText 切换、API 扩展

### v1.4 (当前开发中)
阅读界面计时器 (ReadingTimer)、工作区日志模块 (logService + outputStore 持久化)、工具栏 i18n 国际化、测验结果日志输出

### 待办
翻译重试/缓存、文章生成器、环境变量 UI、用户自定义主题

> 完整版本清单 → [v1.3/architecture/reference.md](v1.3/architecture/reference.md)
