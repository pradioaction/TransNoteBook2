# TSBook2 API — 工具函数、配置与调用示例

## 3. 文件工具 API (utils/fileUtils.ts)

### 3.1 parseNotebookFile
```typescript
function parseNotebookFile(content: string): NotebookData
```
参数: content - JSON 格式文件内容. 返回值: NotebookData.
兼容 v1.0 (自动填充缺失字段) 和 v2.0 格式. 无效 JSON 返回空数据.

### 3.2 serializeNotebookFile
```typescript
function serializeNotebookFile(cells: NotebookCell[]): string
```
返回格式化 JSON (缩进 2 空格). 输出格式示例:
```json
{
  "version": "2.0",
  "cells": [{ "type": "markdown", "content": "...", "output": "...", "id": "uuid-...", "parentId": null, "indentLevel": 0, "isCollapsed": false, "isInputCollapsed": false, "isOutputCollapsed": false }]
}
```

### 3.3 splitTextIntoParagraphs
```typescript
function splitTextIntoParagraphs(text: string): string[]
```
\r\n → \n, 按 \n\n+ 分割, 过滤空白段落.

## 6. 主题系统 API (styles/themes.ts)

```typescript
const lightTheme: ThemeConfig  // 浅色主题
const darkTheme: ThemeConfig   // 深色主题（默认）
```

浅色主题关键色: foreground #333333, background #f5f5f5, cellBorder #1a73e8, primaryButton #007acc.
深色主题关键色: foreground #d4d4d4, background #1e1e1e, cellBorder #0e639c, primaryButton #0e639c.

## 7. 配置设置 API (electron/main.ts)

### 7.1 默认设置结构
```typescript
const defaultSettings = {
  theme: 'dark',
  readingFontSize: 14,
  cellWidthRatio: 70,
  translation: { enabled: false, currentProvider: 'system_Ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:0.5b' }, openai: { apiKeyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', timeout: 60, proxy: '' } },
  promptTemplates: { translation: '请翻译{input}', analysis: '请解析{input}', scenery: '请完成一篇包含{input}的文章' },
  customModels: [],
  recentFiles: [],
  envVars: [],
}
```

### 7.2 设置持久化
存储位置: {userData}/settings.json, JSON 缩进 2 空格, 自动创建目录.

## 8. 典型调用流程

### 8.1 打开 .transnb 文件
```typescript
const filePath = await api.openFileDialog()
const content = await api.readFile(filePath)
const data = parseNotebookFile(content)
notebookStore.openFile({ path: filePath, name: fileName, isModified: false, cells: data.cells })
workspaceStore.addRecentFile(filePath)
```

### 8.2 保存文件
if notebook.path exists: serialize → writeFile → setModified(false)
else: saveFileDialog → serialize → writeFile → setFilePath → setModified(false)

### 8.3 导入文本
openImportDialog → splitTextIntoParagraphs → create cells → openFile({ path: null, name, isModified: true, cells })

### 8.4 编辑单元格内容
CellEditor onChange → store.updateCellContent(index, newContent) → isModified = true → StatusBar 显示修改标记

### 8.5 切换主题
useThemeStore.getState().setTheme('light') → 所有 useTheme() 组件自动重渲染

### 8.6 翻译单元格
```typescript
const { translateCell, translateAll, status, cancel, listProviders } = useTranslationService()
await translateCell(0)
// status: { state: 'idle' | 'translating' | 'error', progress: 0-100 }
```

## 9. 单元测试 API (tests/)

框架: Vitest, 环境: jsdom, 辅助库: @testing-library/jest-dom.
运行: npm run test, npm run test:watch.
测试覆盖: notebookStore (初始化/选择/更新/多文件/切换/关闭), fileUtils (v2.0 解析/v1.0 迁移/无效 JSON/序列化/分割).

## 10. Electron 配置说明

### 10.1 BrowserWindow 配置
width: 1400, height: 900, minWidth: 800, minHeight: 600, nodeIntegration: false, contextIsolation: true, preload, show: false, backgroundColor: '#1e1e1e'.

### 10.2 开发/生产模式
dev: loadURL('http://localhost:5173') + openDevTools()
prod: loadFile('../dist/index.html')

### 10.3 开发启动流程
tsc → vite (port 5173) → wait-on → electron.
脚本: npm run electron:dev

## 13. 代码风格与约定

- 组件命名: PascalCase (CellContainer, NotebookEditor)
- 文件命名: camelCase (notebookStore.ts, useKeyboard.ts)
- 状态管理: use 前缀 Hook (useNotebookStore)
- 服务层: create*Service() 工厂, use*Service() Hook
- 类型文件: 全局类型在 types/notebook.ts, 翻译相关在 translation/types.ts
- 样式: React inline styles + ThemeConfig
- 路径别名: @/ 映射到 src/
