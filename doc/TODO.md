# TSBook2 待办事项

> 最后更新: 2026-09-21 | 当前版本: v2.2

***

## v2.2 检测体验与数据健壮性 — ✅ 全部完成

| 项目 | 说明 |
|------|------|
| 完形填空题型 | 新增 `cloze` 题型；`extractClozeSentences()` 提取句子；`wordMeta.sentences` 随 `.transnb` 持久化 |
| 检测进度多槽位 | `savedQuizProgress` 槽位化（`article` / `book_${bookId}`），恢复即消费 |
| 「不认识」按钮 | `DONT_KNOW_ANSWER = 'N'`；F/0 键作答前 = 不认识 / 作答后 = 翻转详情 |
| 完成页停留 | 最后一题答完不再无响应，进入结果页 |
| 远程词书 JSONL | `BookImporter` 降级解析；远程扫描与本地对话框均支持 `.jsonl` |
| 检测日志归属 | 由 ReviewPanel 迁移至 QuizPanel（开始 + 完成各一条） |
| 工作区自动初始化 | `workspaceStore.setWorkspace()` 后立即初始化背诵数据库 |
| 输入归一化 | SettingsDialog 与三个翻译 Provider 统一 `trim()` |
| 搜索稳定性修复 | 新增 `SearchStore` 统一搜索会话；稳定选择器修复「点击搜索即白屏」；分区 ErrorBoundary；检测模式快捷键守卫 / 计时器生命周期 / 待同步结果快照化 |
| 答题自动朗读开关 | `TTSAutoReadSettings`（`question` / `hint` / `answer` / `flip`）按场景控制检测页自动朗读；`hint` 默认关闭；手动朗读不受影响 |
| 文档整理 | 新增 v2.2 API/架构文档；修正 v2.1 文档 14 项不符之处 + v2.0 搜索高亮行为（E-15） |

> 详情 → [v2.2/TODO_v2.2.md](v2.2/TODO_v2.2.md) | [v2.2/architecture/modules.md](v2.2/architecture/modules.md)

***

## v2.1 架构优化 — ✅ 全部完成

| 项目 | 说明 |
|------|------|
| TTSService 单例 | `getTTSService()` 跨 hook 共享，useTTSService + useSpeek |
| TTS 配置拆分 | `ttsSettingStore` 独立管理 |
| outputStore 解耦 | addLog 纯状态，文件写入 → subscribe |
| TranslationService 解耦 | `onTranslateComplete` 回调 |
| quizEngine 提取 | `src/recitation/quizEngine.ts` 纯函数 |
| recitationService stub | `batchImportWords` 标记 TODO |
| 文档更新 | v2.1 完整 API/架构文档 |

> 详情 → [v2.1/architecture/optimization.md](v2.1/architecture/optimization.md)

***

## 待办（从 v2.0 继承）

### 基础功能
- [ ] 翻译错误重试机制
- [ ] 翻译缓存
- [ ] 提示词模板变量替换预览

### 背诵模式
- [ ] 背诵设置面板（SettingsDialog 集成）
- [ ] 文章生成器集成：AI 生成场景文章 → .transnb
- [ ] 新建连线形状类（绘制/渲染答题连线）
- [ ] 设置面板添加答题连线模式选项

### 快捷键
- [ ] `Ctrl+Shift+S` 另存为 / `Ctrl+O` 打开文件 / `Ctrl+Shift+I` 导入文本
- [ ] `Ctrl+B` 切换侧边栏 / `Ctrl+J` 切换底部面板

### UI/UX
- [ ] SVG 图标美化
- [ ] 用户自定义主题
- [ ] 环境变量配置 UI 增强

### 编辑区右键菜单
- [ ] 编辑态右键菜单从占位项（`bold`/`italic`/`underline`，空实现）改为领域标记操作：标记为新词（`**`）/ 标记为复习词（`<u>`）；菜单顶部补充复制 / 粘贴 / 全选
- [ ] **标记落库与检测验证**：确认编辑区产生的 `**word**` / `<u>word</u>` 标记已随单元格内容持久化到 `.transnb` 存储，用于检测背诵模块能否正确识别；若无法识别，需补充落库或同步逻辑
- [ ] （二期）**清除标记**：首期菜单暂不展示。基于选区定向剥离 `**` / `<u>` 标记字符，需处理标记成对感知（避免留下孤立半截标记）与跨块选区（按 textblock 逐块处理）
