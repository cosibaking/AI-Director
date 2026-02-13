# 资源存储和缓存系统

## 功能概述

系统已实现完整的资源存储和缓存机制：

1. **服务器存储**：所有生成的图片和视频自动保存到服务器
2. **前端缓存**：使用 IndexedDB 缓存资源，避免重复下载
3. **自动恢复**：页面刷新后自动从缓存或服务器恢复资源

## 目录结构

```
UserSaved/                    # 开发模式：项目路径下
  └── {username}/             # 一级路径：用户名（基于 API Key 前8位）
      ├── images/             # 二级路径：图片资源
      │   └── image_*.png
      └── videos/             # 二级路径：视频资源
          └── video_*.mp4
```

## 工作流程

### 1. 资源生成和保存

当生成图片或视频时：
1. AI 生成资源（返回 base64 data URL 或 HTTP URL）
2. 自动保存到服务器（`UserSaved/{username}/{resourceType}/`）
3. 返回服务器 URL 并保存到前端缓存（IndexedDB）
4. 前端使用服务器 URL 显示资源

### 2. 资源获取

当需要显示资源时：
1. 优先从 IndexedDB 缓存读取
2. 缓存不存在时，从服务器获取
3. 获取后自动保存到缓存

### 3. 页面刷新恢复

页面刷新后：
- 资源 URL 保存在项目数据中
- 显示时自动从缓存或服务器恢复
- 无需重新生成

## 使用方法

### 启动服务器

```bash
# 仅启动文件服务器
npm run dev:server

# 同时启动前端和后端
npm run dev:all
```

### 配置

服务器默认运行在 `http://localhost:3001`

如需修改，可在 `services/fileService.ts` 中修改 `API_BASE`：

```typescript
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3001'  // 开发环境
  : window.location.origin;    // 生产环境
```

## API 接口

### 保存文件

```typescript
POST /api/files/save
{
  username: string,
  resourceType: 'images' | 'videos',
  filename: string,
  data: string,  // base64 data URL
  mimeType?: string
}
```

### 获取文件

```typescript
GET /api/files/get/:username/:resourceType/:filename
```

### 获取文件列表

```typescript
GET /api/files/list/:username/:resourceType?
```

## 缓存管理

缓存使用 IndexedDB，数据库名：`CineGenFileCache`

- **存储结构**：`{ url, data, resourceType, timestamp }`
- **自动清理**：可扩展实现过期清理机制
- **手动清理**：可通过浏览器开发者工具清理

## 注意事项

1. **用户名**：自动从 API Key 前8位生成，或使用 localStorage 中的 `cinegen_username`
2. **文件大小限制**：单文件最大 100MB
3. **存储路径**：开发模式使用项目路径下的 `UserSaved`，生产模式可通过环境变量 `STORAGE_PATH` 配置
4. **CORS**：服务器已启用 CORS，支持跨域请求

## 故障处理

如果资源无法显示：
1. 检查文件服务器是否运行
2. 检查浏览器控制台错误信息
3. 检查 `UserSaved` 目录权限
4. 查看服务器日志
