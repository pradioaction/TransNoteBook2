# TSBook2

一个灵感源自 VSCode 界面的电子词书学习与翻译笔记工具。采用 Electron + React + TypeScript 构建。

> 详细文档请参阅 [`doc/`](doc/) 目录，包含架构设计、API 接口、版本规划等。当前版本 v1.4。

---

## 环境准备与编译

### 系统要求

| 依赖 | 版本要求 |
|------|----------|
| **Node.js** | >= 18.x（推荐 20.x LTS） |
| **npm** | >= 9.x（随 Node.js 附带） |
| **操作系统** | Windows 10+ / macOS / Linux |

### 安装步骤

#### 1. 克隆代码

```bash
git clone <仓库地址>
cd TSBook2
```

#### 2. 安装依赖

```bash
npm install
```

npm 会自动安装所有依赖，包括：
- 前端运行时依赖（React、Tiptap、Zustand 等）
- 开发工具（Vite、TypeScript、Electron 等）
- Electron 运行时（Node.js 原生模块 better-sqlite3 及其编译工具）

如果在 Windows 上安装 `better-sqlite3` 时报编译错误，请确保已安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)（选择「使用 C++ 的桌面开发」工作负载），或直接安装 CMake：

```bash
npm install -g cmake-js
```

### 运行

#### 开发模式（仅前端）

```bash
npm run dev
```

启动 Vite 开发服务器（默认 http://localhost:5173），仅预览前端界面。部分依赖 Electron API 的功能（文件操作、词书数据库等）不可用。

#### Electron 开发模式（完整功能）

```bash
npm run electron:dev
```

此命令会：
1. 编译 Electron 主进程代码（TypeScript → JavaScript，输出到 `dist-electron/`）
2. 同时启动 Vite 开发服务器
3. 等待 Vite 就绪后自动启动 Electron 窗口

所有功能均可使用，支持热重载。

### 构建

#### 构建前端 + Electron 主进程

```bash
npm run build
```

依次执行 TypeScript 编译（`tsc`）和 Vite 构建，输出到：
- `dist/` — 前端静态资源
- `dist-electron/` — Electron 主进程代码

#### 构建可分发桌面应用

```bash
npm run electron:build
```

在 `npm run build` 的基础上，使用 [electron-builder](https://www.electron.build/) 打包为可执行文件：

| 平台 | 输出格式 | 文件 |
|------|----------|------|
| Windows | 便携版（Portable） | `release/TSBook2-Portable-{version}.exe` |
| macOS | 待配置 | — |
| Linux | 待配置 | — |

### 其他命令

```bash
npm run typecheck        # 类型检查（tsc --noEmit）
npm test                 # 运行单元测试（vitest）
npm run test:watch       # 监听模式运行测试
npm run preview          # 预览 Vite 构建产物
```

### 项目结构

```
TSBook2/
├── doc/                     # 项目文档
│   ├── v1.1/                # v1.1 重构计划
│   ├── v1.2/                # v1.2 重构计划
│   ├── v1.3/                # v1.3 API 与架构文档
│   │   ├── api/             #   API 接口文档
│   │   └── architecture/    #   架构设计文档
│   ├── API.md               # API 总览
│   ├── ARCHITECTURE.md      # 架构总览
│   └── TODO.md              # 待办事项
├── electron/                # Electron 主进程代码
│   ├── main.ts              # 主进程入口，IPC 处理器注册（~66 行）
│   ├── preload.ts           # preload 脚本（contextBridge）
│   ├── state.ts             # 共享状态单例（recitationState + 设置管理）
│   ├── types.ts             # 共享 Electron 类型（FileEntry, DirEntry, ImportResult）
│   ├── handlers/            # IPC 处理器模块（v1.4 模块化重构）
│   │   ├── fileHandlers.ts             # 文件操作
│   │   ├── dialogHandlers.ts           # 原生对话框
│   │   ├── settingsHandlers.ts         # 设置持久化
│   │   ├── recitationHandlers.ts       # 背诵模式 CRUD + 学习流程
│   │   └── workspaceConfigHandlers.ts  # 工作区级配置
│   ├── workspace/           # 工作区通用能力
│   │   └── configProvider.ts           # ConfigProvider + FileBasedConfig
│   └── recitation/          # 背诵模式数据层
│       ├── database.ts      # SQLite 数据库管理
│       ├── bookService.ts   # 词书管理服务
│       ├── bookImporter.ts  # 词书 JSON 解析器
│       ├── bookDAL.ts       # 词书数据访问层
│       ├── wordDAL.ts       # 单词数据访问层
│       ├── userStudyDAL.ts  # 学习记录数据访问层
│       ├── studyService.ts  # 学习/复习服务
│       ├── recitationDAL.ts # 背诵数据访问总入口
│       ├── ebbinghaus.ts    # 艾宾浩斯算法
│       └── statDAL.ts       # 统计查询
├── src/                     # 前端代码（React + TypeScript）
│   ├── main.tsx             # 前端入口
│   ├── App.tsx              # 应用根组件
│   ├── components/          # UI 组件
│   │   ├── layout/          # 布局组件（AppShell、ActivityBar、Sidebar 等）
│   │   ├── notebook/        # 笔记编辑器（NotebookEditor、NotebookToolbar）
│   │   ├── cells/           # Cell 组件（CellContainer、CellEditor 等）
│   │   ├── recitation/      # 背诵模式组件
│   │   │   ├── RecitationShell.tsx    # 背诵模式主容器
│   │   │   ├── BookManagerPanel.tsx   # 词书管理面板
│   │   │   ├── BookCard.tsx           # 词书卡片
│   │   │   ├── CreateBookDialog.tsx   # 创建词书对话框
│   │   │   ├── WordManagerDialog.tsx  # 单词管理弹窗
│   │   │   ├── WordListItem.tsx       # 单词条目渲染
│   │   │   ├── WordSidebar.tsx        # 单词侧边栏
│   │   │   ├── QuizPanel.tsx          # 检测界面
│   │   │   ├── ReviewPanel.tsx        # 检测回顾界面
│   │   │   ├── StatsPanel.tsx         # 统计面板
│   │   │   └── ResizeHandle.tsx       # 拖拽分割条
│   │   ├── file/            # 文件浏览器
│   │   ├── import/          # 文本导入对话框
│   │   ├── settings/        # 设置对话框
│   │   ├── welcome/         # 欢迎页
│   │   └── icons.tsx        # SVG 图标组件
│   ├── store/               # Zustand 状态管理
│   ├── hooks/               # React Hooks
│   ├── services/            # 前端服务层
│   ├── translation/         # 翻译服务（Ollama、OpenAI 等）
│   ├── recitation/          # 背诵模式前端逻辑与类型
│   ├── utils/               # 工具函数
│   ├── types/               # TypeScript 类型定义
│   └── styles/              # 主题配置
├── tests/                   # 单元测试
├── scripts/                 # 开发脚本
├── package.json
├── tsconfig.json            # 前端 TypeScript 配置
├── tsconfig.node.json       # 主进程 TypeScript 配置
├── vite.config.ts           # Vite 配置
└── electron-builder.yml     # 打包配置
```

---

## 一、词书相关

### 功能概览

- **词书背诵** — 导入词书 → 学习单词 → 艾宾浩斯间隔复习 → 选择题测验
- **AI 文章生成** — 选中单词，让 AI 生成包含这些单词的短文，保存为笔记
- **AI 写作批阅** — 在笔记中编写英文，选中 Cell 由 AI 进行语法检查、用词建议和评分

### 词书导入（将单词存入数据库）

TSBook2 使用 SQLite 数据库存储词书和单词数据。要开始背单词，第一步是导入一本词书。

#### 支持格式

只支持 **JSON 格式的词书文件**（扩展名 `.json`），具体为 **KyleBing 格式**。该格式是开源社区常用的英语词书格式，每个单词条目包含单词、音标、释义和例句。

#### 导入步骤

1. 首先**设置工作区** — 选择一个本地文件夹作为工作区，所有数据将存储在该目录下
2. 点击左侧活动栏中的背诵图标进入**背诵模式**
3. 在词书管理面板中点击 **「导入词书」** 按钮
4. 在弹出的文件选择对话框中选择一个 `.json` 词书文件
5. 系统自动解析文件内容，将单词逐条存入本地数据库
6. 导入完成后，词书列表中会出现该词书，显示单词总数和学习进度

> **提示**：导入的词书名称取自 JSON 文件名（不含扩展名）。例如 `CET4.json` → 词书名称 "CET4"。

#### 可接受的 JSON 结构

词书文件可以是以下两种结构之一：

**结构一：顶层数组**
```json
[
  { "headWord": "abandon", "content": { "word": { "content": { ... } } } },
  { "headWord": "ability", "content": { "word": { "content": { ... } } } }
]
```

**结构二：对象嵌套数组**
```json
{
  "words": [
    { "headWord": "abandon", "content": { ... } }
  ]
}
```
可用的顶层键：`words`、`data`、`list`、`items`

#### 系统如何解析每个单词

| 数据项 | 解析路径 | 说明 |
|--------|----------|------|
| **单词** | `headWord` 或 `word` 字段 | 必填，无单词则跳过该条目 |
| **音标** | `content.word.content.usphone` 或 `phone` | 优先取美式音标 |
| **释义** | `content.word.content.trans[]` 数组 | 提取每个 `pos`（词性）+ `tranCn`（中文释义） |
| **例句** | `content.word.content.sentence.sentences[]` | 提取 `sContent`（英文）+ `sCn`（中文） |
| **原始数据** | 整个条目的 JSON 字符串 | 完整保留，以备后续扩展 |

#### 获取词书资源

以下开源项目提供 KyleBing 格式的词库 JSON 文件，下载后可直接导入：

| 资源 | 说明 |
|------|------|
| [KyleBing English Vocabulary](https://github.com/kyle-bing/english-vocabulary) | 四级、六级、考研、雅思、托福等常见词库 |
| [KyleBing COCA Word List](https://github.com/kyle-bing/COCA_word_list) | 基于 COCA 语料库的词频词库 |

#### 单词的其他管理方式

导入词书后，在词书列表中点击 **「查看单词」** 可打开单词管理器，支持：

- **浏览** — 以表格形式查看当前词书的所有单词（单词、音标、释义、例句）
- **新增** — 手动添加单词
- **编辑** — 双击或点击编辑按钮修改单词信息
- **删除** — 删除指定单词
- **搜索** — 按单词文本搜索

### 背诵模式

#### 日常学习流程

1. 进入背诵模式，选择一本词书
2. 右侧侧边栏展示今日学习计划：
   - **新词** — 当日待学的新单词（默认每日 20 个）
   - **复习** — 到期的复习单词，按阶段分组（绿/蓝/橙/紫/红色标识）
3. 勾选需要学习的单词，点击 **「开始测验」**
4. 完成选择题（每个单词两道题：单词→释义、释义→单词）
5. 系统根据答题结果更新艾宾浩斯复习计划
6. **检测回顾** — 查看答题统计（正确率、用时），可将答错单词收藏到指定词书，或一键重新检测

#### 艾宾浩斯间隔复习

每个单词的学习分为 5 个阶段（stage 0→4）：

| 阶段 | 含义 | 答对后下一阶段 | 答错后回退至 |
|------|------|---------------|-------------|
| 0 | 未学习 | stage 1 | — |
| 1 | 已学1次 | stage 2 | stage 0 |
| 2 | 已学2次 | stage 3 | stage 1 |
| 3 | 已学3次 | stage 4 | stage 2 |
| 4 | 已掌握 | stage 4（不再升级） | stage 3 |

各阶段的复习间隔递增，遵循艾宾浩斯遗忘曲线。

#### 每日学习量调整

词书管理面板右上角可调整每日参数：

- **每日新词数** — 默认 20，范围 5–100
- **每日复习数** — 默认 50，范围 10–200

#### 词书进度

每本词书以卡片形式展示进度：

- 进度条 + 掌握百分比
- 已学单词数 / 总单词数
- 待复习单词数

### AI 文章生成

在词书面板中选中单词，点击 **「生成文章」**：

1. 将选中的新词和复习词发送给 AI（支持 Ollama、OpenAI 兼容接口）
2. AI 返回一篇英文短文
3. 系统自动在文章中标注单词：**新词加粗**，复习词加下划线
4. 按段落拆分为笔记 Cell，自动提取标题
5. 保存为 `.transnb` 笔记文件，按日期归档到工作区

> 生成的笔记文件独立于词书数据库，仅用于阅读和后续的单词测验。

### 词书数据存储

词书和单词数据存储在**工作区目录**下的 `.TransRead/` 隐藏文件夹中：

```
工作区目录/
└── .TransRead/                    # 隐藏文件夹（Windows 上自动设隐藏属性）
    ├── words.db                   # SQLite 数据库文件
    └── studywordmode.json         # 背诵配置
```

**数据库中包含三张表：**

| 表名 | 存储内容 | 说明 |
|------|----------|------|
| `book` | 词书信息 | 名称、来源文件路径、单词总数、创建时间 |
| `word` | 单词条目 | 单词、音标、释义、例句、原始 JSON |
| `user_study` | 学习记录 | 当前阶段、权重、上次复习时间、下次复习时间 |

每次导入词书时做的事情：解析 JSON → 在 `book` 表创建一条记录 → 将所有单词批量写入 `word` 表。

---

## 二、笔记相关

### 功能概览

- **Cell 编辑器** — 以 Cell 为单位的 markdown 笔记，每个 Cell 可独立编辑
- **文件管理** — 新建、打开、保存、重命名、删除 `.transnb` 文件
- **文本导入** — 从剪贴板或文本文件导入内容，自动拆分为 Cell
- **批量翻译** — 一键翻译所有 Cell 内容
- **AI 写作批阅** — 选中 Cell 进行语法检查、句子优化、用词建议和评分
- **单元格收藏** — 将精彩单元格收藏到指定笔记文件
- **文章单词测验** — 对 AI 生成的文章，启动关联单词的选择题测验
- **阅读计时** — 笔记阅读模式下的阅读时长统计

### .transnb 笔记文件格式

`.transnb` 文件是 TSBook2 的核心笔记格式，本质是一个 JSON 文件，结构如下：

```json
{
  "version": "2.0",
  "cells": [
    {
      "id": "uuid",
      "type": "markdown",
      "content": "<p>笔记内容（HTML 格式）</p>",
      "output": "<p>翻译输出</p>",
      "parentId": null,
      "indentLevel": 0,
      "isCollapsed": false,
      "isInputCollapsed": false,
      "isOutputCollapsed": false
    }
  ],
  "wordMeta": {
    "bookId": 1,
    "bookName": "CET4",
    "newWords": [{ "id": 1, "word": "example" }],
    "reviewWords": []
  }
}
```

- `cells` — 笔记内容由多个 Cell 组成，每个 Cell 包含输入区（`content`）和输出区（`output`），支持 markdown 渲染
- `wordMeta` — （可选）当笔记由 AI 文章生成时，记录关联的词书和单词信息，用于后续的单词测验

### 笔记的创建方式

#### 方式一：新建空白笔记

在文件浏览器中点击 **New File** 按钮，或按快捷键 `Ctrl+N`，创建一个空的 `.transnb` 文件，然后手动添加 Cell 编写内容。

#### 方式二：导入文本

在文件浏览器或笔记工具栏中点击 **Import** 按钮，打开导入对话框：

1. 输入或粘贴文本内容（自动从剪贴板读取）
2. 设置文件名
3. 选择段落拆分模式：
   - **单换行拆分** — 每个换行符处拆分为一个 Cell
   - **双换行拆分** — 仅在空行处拆分为一个 Cell
4. 点击「导入」生成 `.transnb` 笔记

导入的文本会按段落拆分为多个 Cell，保存到工作区目录下。

#### 方式三：从文件导入（不支持 `.transnb`）

在文件浏览器中点击 Import 按钮旁边有一个 Import from file 选项，支持导入 `.txt`、`.md`、`.html` 文件，内容自动转换为 Cell。

#### 方式四：AI 文章生成

在背诵模式中选中单词，点击 **「生成文章」**，AI 生成的短文自动保存为 `.transnb` 笔记。

### Cell 编辑器

每个笔记文件由多个 Cell 组成，每个 Cell 是一个独立的编辑单元：

**编辑区（Input）：**
- 使用 [Tiptap](https://tiptap.dev/)（基于 ProseMirror）富文本编辑器
- 支持 markdown 语法（标题、粗体、列表等）
- 双击进入编辑模式，按 `Esc` 或点击 Done 退出
- 在阅读模式下显示渲染后的 markdown 内容

**输出区（Output）：**
- 显示翻译结果
- 支持手动编辑

**Cell 操作：**
每个 Cell 左侧有一个工具栏，提供以下操作：

| 按钮 | 功能 |
|------|------|
| ▶ | 翻译当前 Cell 内容到输出区 |
| 复制图标 | 复制当前 Cell |
| ★ | 收藏当前 Cell 到指定笔记文件 |
| ✓ | AI 批阅：语法检查、用词建议、评分 |
| ↑ | 上移 Cell |
| ↓ | 下移 Cell |
| 垃圾桶 | 删除 Cell |
| ▼/▶ | 折叠/展开 Cell |

**Cell 折叠：**
- 每个 Cell 可独立折叠输入区或输出区
- 双击 Cell 可完全折叠，只显示内容预览

### 笔记工具栏

笔记编辑器顶部的工具栏提供以下功能：

| 按钮 | 功能 | 快捷键 |
|------|------|--------|
| New | 新建笔记 | Ctrl+N |
| Open | 打开 `.transnb` 文件 | Ctrl+O |
| Save | 保存当前笔记 | Ctrl+S |
| Save As | 另存为 | |
| Import | 打开文本导入对话框 | |
| Translate All | 批量翻译所有 Cell | |
| Test | 对 AI 文章启动单词测验 | |

**Translate All：** 将当前笔记中所有 Cell 的内容依次翻译到输出区，支持取消。

**Test：** 仅对通过 AI 文章生成创建的笔记可用。点击后从笔记的 `wordMeta` 中读取关联单词，启动选择题测验。

### 文件浏览器

左侧的文件浏览器（Explorer）分为两个区域：

**Open Editors：** 显示当前已打开的所有笔记文件，支持点击切换、右键关闭。

**Workspace：** 显示工作区目录下的所有 `.transnb` 文件，支持：
- 点击打开文件
- 右键重命名和删除
- 目录展开/折叠
- New File 新建笔记
- Import 导入文本
- Refresh 刷新文件列表

### 笔记数据存储

笔记文件（`.transnb`）存储在**工作区目录**下，按创建日期归档：

```
工作区目录/
├── 20240601/
│   ├── CET4-A-Beginners-Guide.transnb
│   └── .../
├── 20240602/
│   └── .../
```

> 笔记文件是独立存储的文本文件，不参与词书的 SQLite 数据库管理。你可以直接通过文件浏览器打开和编辑它们。

---

## 三、工作区

首次使用需要选择一个本地文件夹作为工作区。工作区包含两种类型的数据：

| 数据类型 | 存储位置 | 说明 |
|----------|----------|------|
| **词书数据** | `.TransRead/` 目录（自动创建） | 词书数据库和背诵配置 |
| **笔记文件** | `.transnb` 文件（用户创建或 AI 生成） | 按日期归档在工作区下 |

如需切换词书数据库，只需切换工作区即可。

---

## 四、开发

```bash
npm install             # 安装依赖
npm run dev             # Web 端预览（仅前端）
npm run electron:dev    # Electron 开发模式
npm run build           # 构建
npm run electron:build  # 构建桌面应用
npm run typecheck       # 类型检查
npm test                # 运行测试
```

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 桌面 | Electron 33 |
| 数据库 | better-sqlite3 (SQLite) |
| 编辑器 | Tiptap (ProseMirror) + marked |
| 状态管理 | Zustand 5 |
| 国际化 | i18next |
