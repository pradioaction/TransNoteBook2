# TSBook2 API 接口文档

本文档为 TSBook2 API 的章节索引。完整内容按模块拆分如下：

---

## 1. Electron IPC API

Electron 主进程与渲染进程之间的 IPC 通信接口：文件操作、对话框、背诵模式等方法完整清单及 preload.ts 桥接定义。

> 完整内容 → [v1.3/api/electron-ipc.md](v1.3/api/electron-ipc.md)

---

## 2. 类型定义 API

应用核心类型定义：NotebookCell、ThemeConfig、Book/Word/UserStudy、StageDistribution、今日单词结果、NotebookStore、SettingStore 等所有接口。

> 完整内容 → [v1.3/api/types.md](v1.3/api/types.md)

---

## 3. 文件工具 API

parseNotebookFile / serializeNotebookFile / splitTextIntoParagraphs

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 4. 状态管理 API

6 个 Zustand Store：useNotebookStore / useWorkspaceStore / useThemeStore / useSettingStore / useOutputStore / useRecitationStore

> 完整内容 → [v1.3/api/stores-hooks-services.md](v1.3/api/stores-hooks-services.md)

---

## 5. React Hooks API

useTheme（CSS 变量映射）/ useKeyboard（快捷键表）/ useRecitationService

> 完整内容 → [v1.3/api/stores-hooks-services.md](v1.3/api/stores-hooks-services.md)

---

## 6. 主题系统 API

lightTheme / darkTheme 关键色值

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 7. 配置设置 API

默认设置结构及持久化策略（`{userData}/settings.json`）

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 8. 典型调用流程

打开文件 / 保存 / 导入文本 / 编辑单元格 / 切换主题 / 翻译单元格 — 完整代码示例

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 9. 单元测试 API

Vitest + jsdom 配置、notebookStore + fileUtils 测试覆盖

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 10. Electron 配置说明

BrowserWindow 配置、开发/生产模式、启动流程

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)

---

## 11. 服务层 API

FileService / CellService / TranslationService（逐单元格追踪）/ RecitationService（含 v1.3 扩展）

> 完整内容 → [v1.3/api/stores-hooks-services.md](v1.3/api/stores-hooks-services.md)

---

## 12. 翻译服务 API

TranslationProvider 接口 / OllamaProvider / OpenAIProvider / ArkProvider / ProviderFactory / useTranslationService Hook

> 完整内容 → [v1.3/api/translation.md](v1.3/api/translation.md)

---

## 13. 代码风格与约定

命名规范、文件组织、路径别名

> 完整内容 → [v1.3/api/utilities-examples.md](v1.3/api/utilities-examples.md)
