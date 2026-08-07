# TSBook2 软件架构文档

> 当前版本: v2.1 | 最后更新: 2026-07-21

本文档为 TSBook2 架构的章节索引。完整内容按模块拆分如下：

---

## 1. 项目概述

项目定位、核心理念、技术栈、与原项目 TransNb 的对比。

> 完整内容 → [v2.1/architecture/overview.md](v2.1/architecture/overview.md) | v2.0 原始版 → [v2.0/architecture/overview.md](v2.0/architecture/overview.md)

---

## 2. 系统架构

### 2.1 整体架构图

Electron 主进程与 React 渲染进程的完整目录树。

v2.1 变更：新增 `ttsSettingStore`、`quizEngine.ts`，TTS 服务路径修正。

### 2.2 进程架构

Main Process ↔ preload.ts (contextBridge) ↔ Renderer Process 的 ASCII 架构图。

> 完整内容 → [v2.1/architecture/overview.md](v2.1/architecture/overview.md)

---

## 3. 核心模块详解

v2.1 变更章节：3.14 TTS 模块修正、3.15 quizEngine 新增、3.16 outputStore 解耦、3.17 TranslationService 解耦。

> 完整内容 → [v2.1/architecture/modules.md](v2.1/architecture/modules.md) | v2.0 原始版 → [v2.0/architecture/modules.md](v2.0/architecture/modules.md)

---

## 4. 数据流程

v2.1 更新：日志写入流程（subscribe 解耦）、翻译保存流程（onTranslateComplete 解耦）、设置加载流程（ttsSettingStore 并行加载）。

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 5. 扩展点

v2.1 新增：TTS 配置项扩展（`ttsSettingStore`）。

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 6. 依赖关系

AppShell → 各组件的依赖树

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 7. 目录结构

v2.1 新增：`src/store/ttsSettingStore.ts`、`src/recitation/quizEngine.ts`

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 8. 设计模式

v2.1 新增：subscribe 解耦模式（outputStore）、回调解耦模式（TranslationService）、纯函数引擎模式（quizEngine）

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 9. 与原项目的架构差异

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 10. 性能考虑

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 11. 安全考虑

> 完整内容 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 12. 版本状态

### v2.1 — 架构优化（当前）
- TTSService 单例跨 hook 共享
- TTS 配置独立 `ttsSettingStore`
- outputStore 日志副作用解耦（subscribe）
- TranslationService 保存解耦（onTranslateComplete 回调）
- 测验引擎提取 `quizEngine.ts`
- recitationService stub 标记 TODO

### v2.0
远程词书导入 / 侧边栏搜索 / 词书 UI 改进 / TTS 语音朗读

### v1.4
IPC Handler 模块化 / 单元格收藏 / 词书操作增强 / 日志模块重构

> 完整清单 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md) | [v2.1/architecture/optimization.md](v2.1/architecture/optimization.md)
