# 文件服务器

## 功能

文件服务器用于保存和管理用户生成的图片和视频资源。

## 目录结构

```
UserSaved/
  └── {username}/          # 一级路径：用户名
      ├── images/          # 二级路径：资源类型（图片）
      │   └── *.png
      └── videos/          # 二级路径：资源类型（视频）
          └── *.mp4
```

## 启动服务器

### 开发模式

```bash
npm run dev:server
```

### 生产模式

```bash
npm run server
```

### 同时启动前端和后端

```bash
npm run dev:all
```

## API 接口

### 保存文件

```
POST /api/files/save
Content-Type: application/json

{
  "username": "user123",
  "resourceType": "images" | "videos",
  "filename": "image_1234567890.png",
  "data": "data:image/png;base64,...",
  "mimeType": "image/png"
}
```

### 获取文件

```
GET /api/files/get/:username/:resourceType/:filename
```

### 获取文件列表

```
GET /api/files/list/:username/:resourceType?
```

## 环境变量

- `PORT`: 服务器端口（默认：3001）
- `NODE_ENV`: 环境模式（development/production）
- `STORAGE_PATH`: 存储路径（生产环境，默认：项目路径下的 UserSaved）
