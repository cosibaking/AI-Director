# CineGen AI Director (AI 漫剧工场)

**工业级 AI 漫剧与视频生成工作台**  
*Industrial AI Motion Comic & Video Workbench*

[中文](./README.md) ｜ [English](./README_EN.md) ｜ [日本語](./README_JA.md) ｜ [한국인](./README_KO.md)

---

## 📖 项目简介

**CineGen AI Director** 是一个专为 **AI 漫剧 (Motion Comics)**、**动态漫画**及**影视分镜 (Animatic)** 设计的专业生产力工具。

它摒弃了传统的"抽卡式"生成，采用 **"Script-to-Asset-to-Keyframe"** 的工业化工作流。通过深度集成火山云 Doubao 模型，实现了对角色一致性、场景连续性以及镜头运动的精准控制。

> 灵感来自于一站式的漫剧制作平台 [AniKuku AI 漫剧制作平台](https://anikuku.com/?github) - 使用优惠码 `CINEGEN50OFF` 可享受 50% 折扣。

![UI Preview](./UI.png)

---

## 🎯 核心理念：关键帧驱动 (Keyframe-Driven)

传统的 Text-to-Video 往往难以控制具体的运镜和起止画面。CineGen 引入了动画制作中的 **关键帧 (Keyframe)** 概念：

1. **先画后动**：先生成精准的起始帧 (Start) 和结束帧 (End)
2. **插值生成**：利用 Doubao-Seedance 模型在两帧之间生成平滑的视频过渡
3. **资产约束**：所有画面生成均受到"角色定妆照"和"场景概念图"的强约束，杜绝人物变形

---

## 🚀 核心功能模块

### Phase 01: 剧本与分镜 (Script & Storyboard)

- **智能剧本拆解**：输入小说或故事大纲，AI 自动拆解为包含场次、时间、气氛的标准剧本结构
- **视觉化翻译**：自动将文字描述转化为专业的图像生成提示词
- **节奏控制**：支持设定目标时长（如 30s 预告片、3min 短剧），AI 自动规划镜头密度
- **多语言支持**：支持中文、英文、日文、法文、西班牙文等多种语言

**主要功能：**
- 故事输入与解析
- 自动提取角色、场景、剧情段落
- 生成分镜脚本（Shots）
- 支持自定义目标时长

### Phase 02: 资产与选角 (Assets & Casting)

- **一致性定妆 (Character Consistency)**：
  - 为每个角色生成标准参考图 (Reference Image)
  - **衣橱系统 (Wardrobe System)**：支持多套造型（如：日常、战斗、受伤），基于 Base Look 保持面部特征一致
- **场景概念 (Set Design)**：生成环境参考图，确保同一场景下的不同镜头光影统一

**主要功能：**
- 批量生成角色定妆照
- 角色造型变体管理（Variations）
- 场景概念图生成
- 资产预览与管理

### Phase 03: 导演工作台 (Director Workbench)

- **网格化分镜表**：全景式管理所有镜头 (Shots)
- **精准控制**：
  - **Start Frame**: 生成镜头的起始画面（强一致性）
  - **End Frame**: (可选) 定义镜头结束时的状态（如：人物回头、光线变化）
- **上下文感知**：AI 生成镜头时，会自动读取 Context（当前场景图 + 当前角色特定服装图），彻底解决"不连戏"问题
- **视频生成**：支持 Image-to-Video 和 Keyframe Interpolation 两种模式

**主要功能：**
- 分镜网格视图
- 关键帧生成（起始帧/结束帧）
- 视频片段生成
- 实时预览与状态监控

### Phase 04: 成片与导出 (Export)

- **实时预览**：时间轴形式预览生成的漫剧片段
- **渲染追踪**：实时监控 API 渲染进度
- **资产导出**：支持导出所有高清关键帧和 MP4 片段，方便导入 Premiere/After Effects 进行后期剪辑

**主要功能：**
- 成片预览
- 进度统计
- 资源下载
- 导出管理

---

## 🛠️ 技术架构

### 前端技术栈

- **框架**: React 19
- **构建工具**: Vite 6
- **样式**: Tailwind CSS (Sony Industrial Design Style)
- **图标**: Lucide React
- **语言**: TypeScript

### AI 模型服务

- **文本/逻辑**: `Doubao-Seed-1.8` (火山云) - 高智商剧本分析
- **图像生成**: `Doubao-Seedream-4.5` (火山云) - 高速绘图
- **视频生成**: `Doubao-Seedance1.5-pro` (火山云) - 首尾帧视频插值

### 存储方案

- **项目数据**: IndexedDB (本地浏览器数据库，数据隐私安全，无后端依赖)
- **媒体资源**: 本地文件服务器 (Express + Multer)
  - 图片存储路径: `UserSaved/{username}/images/`
  - 视频存储路径: `UserSaved/{username}/videos/`

### 后端服务

- **文件服务器**: Express.js (端口 3001)
- **功能**: 图片/视频上传、存储、获取

---

## 📦 项目结构

```
AI-Director/
├── components/              # React 组件
│   ├── Dashboard.tsx       # 项目仪表盘
│   ├── Sidebar.tsx         # 侧边栏导航
│   ├── SettingsModal.tsx   # 设置弹窗
│   ├── StageScript.tsx     # Phase 01: 剧本阶段
│   ├── StageAssets.tsx     # Phase 02: 资产阶段
│   ├── StageDirector.tsx   # Phase 03: 导演阶段
│   └── StageExport.tsx     # Phase 04: 导出阶段
├── services/               # 业务服务层
│   ├── doubaoService.ts   # 火山云 API 服务
│   ├── geminiService.ts   # Gemini API 服务（备用）
│   ├── fileService.ts     # 文件服务
│   ├── storageService.ts  # IndexedDB 存储服务
│   └── mockData.ts        # 模拟数据
├── utils/                 # 工具函数
│   ├── logger.ts          # 日志工具
│   └── resourceHelper.ts  # 资源辅助函数
├── server/                # 后端服务器
│   └── index.ts           # Express 文件服务器
├── types.ts               # TypeScript 类型定义
├── App.tsx                # 主应用组件
├── index.tsx              # 应用入口
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 项目依赖
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **浏览器**: Chrome/Edge/Firefox (推荐 Chrome)

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd AI-Director
```

2. **安装依赖**

```bash
npm install
```

3. **配置 API Key**

项目使用火山云 Doubao API，需要配置 API Key。有两种方式：

**方式一：通过应用界面配置（推荐）**

启动应用后，在登录界面输入火山云 API Key。

**方式二：通过环境变量配置**

创建 `.env` 文件（可选）：

```bash
# 火山云 API Key
DOUBAO_API_KEY=your_api_key_here
VOLCENGINE_API_KEY=your_api_key_here

# Endpoint ID（可选，默认使用代码中的值）
DOUBAO_CHAT_ENDPOINT=doubao-seed-1-8-251228
DOUBAO_IMAGE_ENDPOINT=doubao-seedream-4-5-251128
DOUBAO_VIDEO_ENDPOINT=doubao-seedance-1-5-pro-251215
```

> **注意**: 火山云 API 需要使用 Endpoint ID（ep-开头），而不是模型名称。请在火山云控制台创建 endpoint 后，将对应的 endpoint ID 填入配置。

### 启动项目

#### 开发模式

**仅启动前端（开发模式）**

```bash
npm run dev
```

前端将运行在 `http://localhost:3000`

**仅启动文件服务器**

```bash
npm run dev:server
```

文件服务器将运行在 `http://localhost:3001`

**同时启动前端和后端（推荐）**

```bash
npm run dev:all
```

这将同时启动前端（端口 3000）和文件服务器（端口 3001）。

#### 生产模式

**构建项目**

```bash
npm run build
```

**预览构建结果**

```bash
npm run preview
```

**启动生产服务器**

```bash
npm run server
```

---

## ⚙️ 配置说明

### API Key 配置

1. **获取火山云 API Key**
   - 访问 [火山引擎控制台](https://www.volcengine.com/)
   - 创建 API Key 并开通以下服务权限：
     - Chat: Doubao-Seed-1.8
     - Image: Doubao-Seedream-4.5
     - Video: Doubao-Seedance1.5-pro

2. **配置 Endpoint ID**
   - 在火山云控制台创建对应的 Endpoint
   - 获取 Endpoint ID（格式：`ep-xxxxx` 或 `doubao-xxx-xxx`）
   - 在 `services/doubaoService.ts` 中修改默认值，或通过环境变量配置

### 文件服务器配置

文件服务器默认配置：

- **端口**: 3001
- **存储路径**: `UserSaved/` (项目根目录)
- **目录结构**: 
  ```
  UserSaved/
    └── {username}/          # 用户名（基于 API Key 前8位）
        ├── images/          # 图片资源
        └── videos/           # 视频资源
  ```

如需修改配置，请编辑 `server/index.ts`。

### 前端配置

- **开发服务器端口**: 3000 (可在 `vite.config.ts` 中修改)
- **API Base URL**: 
  - 开发环境: `http://localhost:3001`
  - 生产环境: `window.location.origin`

---

## 📝 使用流程

### 1. 初始化项目

1. 启动应用后，输入火山云 API Key
2. 进入项目仪表盘，创建新项目或打开已有项目

### 2. Phase 01: 剧本与分镜

1. 在"剧本与分镜"阶段输入故事文本
2. 选择目标时长（30s/60s/2min/5min/自定义）
3. 选择语言（中文/English/日本語等）
4. 点击"生成分镜脚本"
5. 等待 AI 解析并生成分镜列表

### 3. Phase 02: 资产与选角

1. 进入"资产与选角"阶段
2. 为每个角色生成定妆照（可批量生成）
3. 为角色添加造型变体（如：日常装、战斗装等）
4. 为每个场景生成概念图
5. 预览并确认所有资产

### 4. Phase 03: 导演工作台

1. 进入"导演工作台"阶段
2. 在分镜网格中，为每个镜头生成关键帧：
   - 生成起始帧 (Start Frame)
   - （可选）生成结束帧 (End Frame)
3. 确认关键帧无误后，批量生成视频片段
4. 实时监控生成进度

### 5. Phase 04: 成片与导出

1. 进入"成片与导出"阶段
2. 预览完整的漫剧片段
3. 查看进度统计
4. 下载关键帧图片和视频片段
5. 导入到 Premiere/After Effects 进行后期处理

---

## 🔧 开发说明

### 项目特性

- **自动保存**: 项目数据自动保存到 IndexedDB，无需手动保存
- **资源缓存**: 生成的图片和视频自动缓存，避免重复下载
- **错误重试**: API 调用支持自动重试（限流错误）
- **日志系统**: 完整的日志记录系统，便于调试

### 代码规范

- 使用 TypeScript 进行类型检查
- 组件使用函数式组件 + Hooks
- 遵循 React 19 最佳实践
- 使用 Tailwind CSS 进行样式设计

### 调试工具

- 浏览器开发者工具
- 应用内置日志系统（`utils/logger.ts`）
- 控制台输出详细的 API 调用信息

---

## 📚 API 文档

### 火山云 Doubao API

项目使用火山云 Doubao API，详细文档请参考：
- [火山引擎 API 文档](https://www.volcengine.com/docs/8239)

### 文件服务器 API

详细文档请参考：[server/README.md](./server/README.md)

---

## 🐛 常见问题

### Q: API Key 配置后仍然提示错误？

A: 请检查：
1. API Key 是否正确
2. 是否已开通 Chat、Image、Video 服务权限
3. Endpoint ID 是否正确配置

### Q: 文件服务器无法启动？

A: 请检查：
1. 端口 3001 是否被占用
2. `UserSaved/` 目录是否有写入权限
3. Node.js 版本是否符合要求

### Q: 生成的图片/视频无法显示？

A: 请检查：
1. 文件服务器是否正常运行
2. 浏览器控制台是否有错误信息
3. 资源路径是否正确

### Q: 项目数据丢失？

A: 项目数据存储在 IndexedDB 中，通常不会丢失。如果遇到问题：
1. 检查浏览器是否清除了网站数据
2. 查看浏览器控制台的 IndexedDB 数据
3. 检查是否有自动保存错误日志

---

## 📄 许可证

本项目为开源项目，具体许可证请查看 LICENSE 文件。

---

## 🙏 致谢

- 灵感来源：[AniKuku AI 漫剧制作平台](https://anikuku.com/?github)
- AI 模型服务：[火山引擎](https://www.volcengine.com/)
- UI 设计风格：Sony Industrial Design

---

## 📞 支持

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 访问项目主页

---

*Built for Creators, by CineGen.*
