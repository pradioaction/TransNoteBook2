# TSBook2 待办事项

> 最后更新: 2026-07-21 | 当前版本: v2.1

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

### 快捷键
- [ ] `Ctrl+Shift+S` 另存为 / `Ctrl+O` 打开文件 / `Ctrl+Shift+I` 导入文本
- [ ] `Ctrl+B` 切换侧边栏 / `Ctrl+J` 切换底部面板

### UI/UX
- [ ] SVG 图标美化
- [ ] 用户自定义主题
- [ ] 环境变量配置 UI 增强
