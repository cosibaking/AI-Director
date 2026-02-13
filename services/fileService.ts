import { logger } from '../utils/logger';

const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : window.location.origin;

// 获取当前用户名（从 localStorage 或使用默认值）
const getUsername = (): string => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const username = localStorage.getItem('cinegen_username');
    if (username) return username;
    
    // 如果没有用户名，使用 API Key 的前8位作为标识
    const apiKey = localStorage.getItem('cinegen_doubao_api_key');
    if (apiKey) {
      const userHash = apiKey.substring(0, 8);
      localStorage.setItem('cinegen_username', userHash);
      return userHash;
    }
  }
  return 'default';
};

// 保存文件到服务器
export const saveFileToServer = async (
  resourceType: 'images' | 'videos',
  filename: string,
  data: string, // base64 data URL
  mimeType?: string
): Promise<string> => {
  try {
    const username = getUsername();
    logger.info('FILE', '保存文件到服务器', { username, resourceType, filename });

    const response = await fetch(`${API_BASE}/api/files/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        resourceType,
        filename,
        data,
        mimeType
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to save file: ${response.status}`);
    }

    const result = await response.json();
    const fileUrl = `${API_BASE}${result.url}`;
    
    // 保存到缓存
    await saveToCache(result.url, data, resourceType);
    
    logger.info('FILE', '文件保存成功', { url: fileUrl });
    return fileUrl;
  } catch (error: any) {
    logger.error('FILE', '文件保存失败', { resourceType, filename, error });
    throw error;
  }
};

// 从服务器获取文件
export const getFileFromServer = async (
  resourceType: 'images' | 'videos',
  filename: string
): Promise<string | null> => {
  try {
    const username = getUsername();
    const url = `${API_BASE}/api/files/get/${username}/${resourceType}/${filename}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    logger.error('FILE', '从服务器获取文件失败', { resourceType, filename, error });
    return null;
  }
};

// 缓存管理（使用 IndexedDB）
const DB_NAME = 'CineGenFileCache';
const DB_VERSION = 1;
const STORE_NAME = 'files';

const openCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
};

// 保存到缓存
const saveToCache = async (url: string, data: string, resourceType: string): Promise<void> => {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        url,
        data,
        resourceType,
        timestamp: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    logger.debug('FILE', '文件已缓存', { url });
  } catch (error: any) {
    logger.warn('FILE', '缓存保存失败', { url, error });
  }
};

// 从缓存获取
export const getFromCache = async (url: string): Promise<string | null> => {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        if (request.result) {
          logger.debug('FILE', '从缓存获取文件', { url });
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error: any) {
    logger.warn('FILE', '缓存读取失败', { url, error });
    return null;
  }
};

// 获取文件（优先从缓存，缓存不存在则从服务器）
export const getFile = async (
  resourceType: 'images' | 'videos',
  filename: string
): Promise<string | null> => {
  const url = `/api/files/get/${getUsername()}/${resourceType}/${filename}`;
  
  // 先尝试从缓存获取
  const cached = await getFromCache(url);
  if (cached) {
    return cached;
  }
  
  // 缓存不存在，从服务器获取
  const serverData = await getFileFromServer(resourceType, filename);
  if (serverData) {
    // 保存到缓存
    await saveToCache(url, serverData, resourceType);
    return serverData;
  }
  
  return null;
};

// 将 base64 data URL 转换为 Blob
export const dataURLToBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// 生成文件名
export const generateFilename = (prefix: string, extension: string = '.png'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}${extension}`;
};
