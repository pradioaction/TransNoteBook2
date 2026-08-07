# TSBook2 API 接口文档

> 当前版本: v2.1 | 最后更新: 2026-07-21

本文档为 TSBook2 API 的章节索引。完整内容按模块拆分如下：

---

## 1. Electron IPC API

Electron 主进程与渲染进程之间的 IPC 通信接口。

> 完整内容 → [v2.1/api/electron-ipc.md](v2.1/api/electron-ipc.md) | v2.0 原始版 → [v2.0/api/electron-ipc.md](v2.0/api/electron-ipc.md)

---

## 2. 类型定义 API

应用核心类型定义。v2.1 变更：`TTSSettings` 拆分到 `ttsSettingStore`，`TranslationServiceDeps` 新增 `onTranslateComplete`。

> 完整内容 → [v2.1/api/types.md](v2.1/api/types.md) | v2.0 原始版 → [v2.0/api/types.md](v2.0/api/types.md)

---

## 3. 文件工具 API

parseNotebookFile / serializeNotebookFile / splitTextIntoParagraphs

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md) | v2.0 原始版 → [v2.0/api/utilities-examples.md](v2.0/api/utilities-examples.md)

---

## 4. 状态管理 API

8 个 Zustand Store（v2.1 新增 `ttsSettingStore`）：useNotebookStore / useWorkspaceStore / useThemeStore / useSettingStore / **useTTSSettingStore** / useOutputStore / useRecitationStore / useWorkspaceConfigStore

v2.1 变更：outputStore 日志写入解耦到 subscribe，recitationStore 测验引擎委托给 quizEngine。

> 完整内容 → [v2.1/api/stores-hooks-services.md](v2.1/api/stores-hooks-services.md) | v2.0 原始版 → [v2.0/api/stores-hooks-services.md](v2.0/api/stores-hooks-services.md)

---

## 5. React Hooks API

useTheme / useKeyboard / useBookmark / useRecitationService / useTTSService / useSpeek

v2.1 变更：useTTSService + useSpeek 共用 `getTTSService()` 单例。

> 完整内容 → [v2.1/api/stores-hooks-services.md](v2.1/api/stores-hooks-services.md)

---

## 6. 主题系统 API

lightTheme / darkTheme 关键色值

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)

---

## 7. 配置设置 API

默认设置结构及持久化策略。v2.1 变更：TTS 配置由 `ttsSettingStore` 独立管理。

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)

---

## 8. 典型调用流程

打开文件 / 保存 / 导入文本 / 编辑单元格 / 切换主题 / 翻译单元格 / 单元格收藏 — 完整代码示例

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)

---

## 9. 单元测试 API

Vitest + jsdom 配置、notebookStore + fileUtils 测试覆盖

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)

---

## 10. Electron 配置说明

BrowserWindow 配置、开发/生产模式、启动流程

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)

---

## 11. 服务层 API

FileService / CellService / TranslationService / RecitationService / LogService / TTSService

v2.1 变更：TranslationService 通过 `onTranslateComplete` 回调解耦保存；RecitationService 的 `batchImportWords` 标记 TODO；TTSService 通过 `getTTSService()` 单例导出。

> 完整内容 → [v2.1/api/stores-hooks-services.md](v2.1/api/stores-hooks-services.md)

---

## 12. 翻译服务 API

TranslationProvider 接口 / OllamaProvider / OpenAIProvider / ArkProvider / ProviderFactory / useTranslationService Hook

v2.1 变更：`TranslationServiceDeps.onTranslateComplete` 回调解耦。

> 完整内容 → [v2.1/api/translation.md](v2.1/api/translation.md)

---

## 13. TTS 语音朗读 API

TTSProvider 接口 / WebSpeechProvider / ProviderFactory / TTSService / useTTSService / useSpeek

v2.1 修正：模块路径、`getTTSService()` 单例、`ttsSettingStore` 独立配置。

> 完整内容 → [v2.1/api/tts.md](v2.1/api/tts.md)

---

## 14. 背诵/词书管理 API

Book / Word / BookWithProgress / RecitationService / quizEngine / 远程词书导入

v2.1 新增：`quizEngine.ts` 测验引擎纯函数。

> 完整内容 → [v2.1/api/recitation.md](v2.1/api/recitation.md)

---

## 15. 代码风格与约定

命名规范、文件组织、路径别名

> 完整内容 → [v2.1/api/utilities-examples.md](v2.1/api/utilities-examples.md)
