import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 启用 CORS
app.use(cors());
// 增加 JSON 请求体大小限制以支持大文件（base64 编码）
app.use(express.json({ limit: '150mb' }));

// 配置存储路径
const isDev = process.env.NODE_ENV !== 'production';
const baseStoragePath = isDev 
  ? path.join(__dirname, '..', 'UserSaved')
  : process.env.STORAGE_PATH || path.join(__dirname, '..', 'UserSaved');

// 确保存储目录存在
const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(baseStoragePath);

/** 规范化用于路径的用户名/类型：去除首尾空白与非法路径字符 */
const sanitizePathSegment = (value: string): string => {
  const trimmed = (value || '').trim().replace(/[/\\:*?"<>|]/g, '_');
  return trimmed || 'default';
};

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = sanitizePathSegment(req.body.username || 'default');
    const resourceType = sanitizePathSegment(req.body.resourceType || 'unknown');
    const userDir = path.join(baseStoragePath, username);
    const typeDir = path.join(userDir, resourceType);
    
    ensureDir(userDir);
    ensureDir(typeDir);
    
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname || 'file';
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const filename = `${baseName}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// 保存 base64 数据到文件
app.post('/api/files/save', async (req, res) => {
  try {
    const { username, resourceType, filename, data, mimeType } = req.body;
    
    if (!username || !resourceType || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const safeUsername = sanitizePathSegment(username);
    const safeResourceType = sanitizePathSegment(resourceType);
    const userDir = path.join(baseStoragePath, safeUsername);
    const typeDir = path.join(userDir, safeResourceType);
    ensureDir(userDir);
    ensureDir(typeDir);

    // 处理 base64 数据
    let buffer: Buffer;
    let finalFilename = filename || `file_${Date.now()}`;
    
    if (data.startsWith('data:')) {
      // 提取 base64 部分
      const base64Data = data.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
      
      // 从 mimeType 或 data URL 中提取扩展名
      const mime = mimeType || data.split(';')[0].split(':')[1];
      const ext = mime === 'image/png' ? '.png' 
                : mime === 'image/jpeg' || mime === 'image/jpg' ? '.jpg'
                : mime === 'video/mp4' ? '.mp4'
                : '.bin';
      
      if (!finalFilename.includes('.')) {
        finalFilename += ext;
      }
    } else {
      // 假设是纯 base64 字符串
      buffer = Buffer.from(data, 'base64');
      if (!finalFilename.includes('.')) {
        finalFilename += '.bin';
      }
    }

    const filePath = path.join(typeDir, finalFilename);
    fs.writeFileSync(filePath, buffer);

    // 返回文件 URL（使用规范化后的路径段）
    const fileUrl = `/api/files/get/${safeUsername}/${safeResourceType}/${finalFilename}`;
    
    res.json({
      success: true,
      url: fileUrl,
      path: filePath,
      filename: finalFilename
    });
  } catch (error: any) {
    console.error('Save file error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取文件
app.get('/api/files/get/:username/:resourceType/:filename', (req, res) => {
  try {
    const { username, resourceType, filename } = req.params;
    const safeUsername = sanitizePathSegment(username);
    const safeResourceType = sanitizePathSegment(resourceType);
    const safeFilename = path.basename(filename);
    const filePath = path.join(baseStoragePath, safeUsername, safeResourceType, safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // 设置正确的 Content-Type
    const mimeTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };
    
    const contentType = mimeTypes[path.extname(safeFilename).toLowerCase()] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取文件列表
app.get('/api/files/list/:username/:resourceType?', (req, res) => {
  try {
    const { username, resourceType } = req.params;
    const safeUsername = sanitizePathSegment(username);
    const userDir = path.join(baseStoragePath, safeUsername);
    
    if (!fs.existsSync(userDir)) {
      return res.json({ files: [] });
    }

    if (resourceType) {
      const safeResourceType = sanitizePathSegment(resourceType);
      const typeDir = path.join(userDir, safeResourceType);
      if (!fs.existsSync(typeDir)) {
        return res.json({ files: [] });
      }
      const files = fs.readdirSync(typeDir).map(filename => ({
        filename,
        url: `/api/files/get/${safeUsername}/${safeResourceType}/${filename}`
      }));
      return res.json({ files });
    } else {
      // 返回所有资源类型
      const types = fs.readdirSync(userDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      const result: any = {};
      types.forEach(type => {
        const typeDir = path.join(userDir, type);
        result[type] = fs.readdirSync(typeDir).map(filename => ({
          filename,
          url: `/api/files/get/${safeUsername}/${type}/${filename}`
        }));
      });
      
      return res.json(result);
    }
  } catch (error: any) {
    console.error('List files error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 图片代理：解决浏览器端 fetch 跨域 CDN 图片时的 CORS 问题
app.get('/api/proxy-image', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    // 仅允许 HTTPS 且为火山引擎 CDN，防止 SSRF
    if (!url.startsWith('https://') || !url.includes('volces.com')) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }
    const imgResponse = await fetch(url, { method: 'GET' });
    if (!imgResponse.ok) {
      return res.status(imgResponse.status).send(imgResponse.statusText);
    }
    const contentType = imgResponse.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    const arrayBuffer = await imgResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error('Proxy image error:', error);
    res.status(500).json({ error: error.message || 'Proxy failed' });
  }
});

app.listen(PORT, () => {
  console.log(`File server running on http://localhost:${PORT}`);
  console.log(`Storage path: ${baseStoragePath}`);
});
