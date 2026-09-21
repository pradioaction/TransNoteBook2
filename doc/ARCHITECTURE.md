# TSBook2 软件架构文档

> 当前版本: v2.2 | 最后更新: 2026-09-20

本文档为 TSBook2 架构的章节索引。完整内容按模块拆分如下：

| 版本 | 定位 | 入口 |
|------|------|------|
| **v2.2**（当前） | 检测体验与数据健壮性 + v2.1 文档勘误 | [v2.2/architecture/](v2.2/architecture/overview.md) |
| v2.1 | 架构优化（TTS / Store 拆分 / 解耦） | [v2.1/architecture/](v2.1/architecture/overview.md) |
| v2.0 | 远程词书导入 / 侧边栏搜索 / TTS 语音朗读 | [v2.0/architecture/](v2.0/architecture/overview.md) |
| v1.4 | IPC Handler 模块化 / 收藏 / 日志重构 | [v1.4/architecture/](v1.4/architecture/overview.md) |
| v1.3 | — | [v1.3/architecture/](v1.3/architecture/overview.md) |

> 历史版本目录（v1.3–v2.1）为**冻结快照**，不再修改；与当前代码的差异统一记录在 v2.2 文档的勘误章节。

---

## 1. 项目概述

项目定位、核心理念、技术栈、与原项目 TransNb 的对比（v2.2 无变化）。

> 完整内容 → [v2.2/architecture/overview.md](v2.2/architecture/overview.md) §1 | v2.0 原始版 → [v2.0/architecture/overview.md](v2.0/architecture/overview.md)

---

## 2. 系统架构

### 2.1 整体架构图

Electron 主进程与 React 渲染进程的完整目录树。

v2.2 变更：`recitationStore` 检测进度槽位化、`workspaceStore` 自动初始化背诵库、`articleUtils` 新增 `extractClozeSentences()`。

### 2.2 进程架构

Main Process ↔ preload.ts (contextBridge) ↔ Renderer Process 的 ASCII 架构图（v2.2 无结构变化；`preload.ts` 现暴露 `recitationAPI` / `tts` / `edgeTts` 三组桥接）。

> 完整内容 → [v2.2/architecture/overview.md](v2.2/architecture/overview.md) §2 | v2.1 版 → [v2.1/architecture/overview.md](v2.1/architecture/overview.md)

---

## 3. 核心模块详解

v2.2 新增章节：

| 编号 | 模块 |
|------|------|
| 3.19 | 完形填空题型（cloze） |
| 3.20 | 检测进度多槽位暂存（Slot Registry） |
| 3.21 | 远程词书 JSONL 支持 |
| 3.22 | 检测日志归属迁移（ReviewPanel → QuizPanel） |
| 3.23 | 工作区自动初始化背诵数据库 |
| 3.24 | 设置与 Provider 输入归一化 |
| 3.25 | 侧边栏单词显示优化 |
| **3.26** | **v2.1 文档勘误（14 项）** |
| **3.27** | **搜索面板稳定性与搜索会话收口** |

v2.1 章节（3.14 TTS 模块修正、3.15 quizEngine、3.16 outputStore 解耦、3.17 TranslationService 解耦、3.18 Kokoro TRT 引擎）保持有效。

> 完整内容 → [v2.2/architecture/modules.md](v2.2/architecture/modules.md) | v2.1 版 → [v2.1/architecture/modules.md](v2.1/architecture/modules.md) | v2.0 原始版 → [v2.0/architecture/modules.md](v2.0/architecture/modules.md)

---

## 4. 数据流程

v2.2 新增：4.11 完形填空题目生成流程、4.12 检测进度槽位持久化与恢复流程、4.13 JSONL 词书导入流程。
（v2.1 的 4.6 设置加载、4.8 日志写入、4.10 翻译后保存流程保持有效）

> 完整内容 → [v2.2/architecture/reference.md](v2.2/architecture/reference.md) | v2.1 版 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 5. 扩展点

v2.2 新增：5.10 新增检测题型、5.11 新增检测进度槽位、5.12 新增 TTS/翻译 Provider（同 v2.1）。

> 完整内容 → [v2.2/architecture/reference.md](v2.2/architecture/reference.md#5-扩展点) | v2.1 版 → [v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 6. 依赖关系

AppShell → 各组件的依赖树（v2.2 无变化）。

> 完整内容 → [v2.2/architecture/overview.md](v2.2/architecture/overview.md) §2、[v2.1/architecture/reference.md](v2.1/architecture/reference.md)

---

## 7. 目录结构

v2.2 变更：`electron/recitation/bookImporter.ts`（JSONL 解析）、`electron/recitation/githubBookFetcher.ts`（`.jsonl` 扫描）、`electron/handlers/dialogHandlers.ts`（词书对话框过滤器）、`src/utils/articleUtils.ts`（`extractClozeSentences`）、`src/store/searchStore.ts`（搜索会话）、`src/components/common/ErrorBoundary.tsx`（分区错误边界）。

> 完整内容 → [v2.2/architecture/reference.md](v2.2/architecture/reference.md#7-目录结构v22)

---

## 8. 设计模式

v2.2 新增：**槽位化持久化（Slot Registry）**、**降级解析（Fallback Parsing）**、**哨兵值作答（Sentinel Answer）**。
（v2.1 的 subscribe 解耦 / 回调解耦 / 纯函数引擎 / 模块级单例保持有效）

> 完整内容 → [v2.2/architecture/reference.md](v2.2/architecture/reference.md#8-设计模式v22)

---

## 9. 与原项目的架构差异

> 完整内容 → [v2.2/architecture/overview.md](v2.2/architecture/overview.md) §1、[v2.0/architecture/overview.md](v2.0/architecture/overview.md) §1
> 说明：v2.1 文档曾将该章节指向 `reference.md`，实际内容位于 `overview.md`。

---

## 10. 性能考虑

> 完整内容 → [v2.0/architecture/reference.md](v2.0/architecture/reference.md) §10（v1.3/v1.4/v2.0 均有该章节；**v2.1 起未再单独成章**，v2.2 无新增性能相关改动）

---

## 11. 安全考虑

> 完整内容 → [v2.0/architecture/reference.md](v2.0/architecture/reference.md) §11（同上）

> **索引勘误**：v2.1 版 ARCHITECTURE.md 将 §9/§10/§11 均指向 `v2.1/architecture/reference.md`，但该文件实际只含 4/5/7/8/12 五节，属失效链接。

---

## 12. 版本状态

### v2.2 — 检测体验与数据健壮性（当前）
- 完形填空题型 `cloze` + `extractClozeSentences()`
- 「不认识」按钮与 F/0 键语义（`DONT_KNOW_ANSWER`，0 为右手区等效键）
- 最后一题停留复习 + 完成页
- 检测进度多槽位暂存（`article` / `book_${bookId}`）
- 检测日志迁至 QuizPanel
- 远程/本地词书 JSONL 支持
- 工作区加载后自动初始化背诵数据库
- 设置与翻译 Provider 输入归一化（`trim()`）
- 侧边栏单词显示优化
- 搜索稳定性与收口：新增 `SearchStore` 统一搜索会话、稳定选择器修复「点击搜索即白屏」、分区 ErrorBoundary、检测模式快捷键守卫 / 计时器生命周期 / 待同步结果快照化
- v2.1 文档勘误 14 项 + v2.0 搜索高亮行为勘误（E-15）

### v2.1
TTSService 单例 / TTS 配置独立 `ttsSettingStore` / outputStore 日志副作用解耦（subscribe） / TranslationService 保存解耦（onTranslateComplete） / 测验引擎提取 `quizEngine.ts` / Kokoro GPU TTS 引擎（Electron 集成待修复）

### v2.0
远程词书导入 / 侧边栏搜索 / 词书 UI 改进 / TTS 语音朗读

### v1.4
IPC Handler 模块化 / 单元格收藏 / 词书操作增强 / 日志模块重构

> 完整清单 → [v2.2/architecture/reference.md](v2.2/architecture/reference.md#12-版本状态) | [v2.2/TODO_v2.2.md](v2.2/TODO_v2.2.md)
