import { getFromCache, getFile } from '../services/fileService';
import { logger } from './logger';

/**
 * 获取资源 URL（优先从缓存，缓存不存在则从服务器）
 * @param url 资源 URL（可能是服务器 URL 或 data URL）
 * @param resourceType 资源类型
 * @returns 资源 URL（data URL 或服务器 URL）
 */
export const getResourceUrl = async (
  url: string | undefined,
  resourceType: 'images' | 'videos' = 'images'
): Promise<string | undefined> => {
  if (!url) return undefined;

  // 如果已经是 data URL，直接返回
  if (url.startsWith('data:')) {
    return url;
  }

  // 提取路径部分（处理完整 HTTP URL 和相对路径）
  let pathPart = url;
  if (url.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      pathPart = urlObj.pathname;
    } catch {
      // 如果 URL 解析失败，使用原始 URL
      pathPart = url;
    }
  }

  // 如果是服务器 URL（包含 /api/files/get/），尝试从缓存获取
  if (pathPart.includes('/api/files/get/')) {
    try {
      // 对于完整 HTTP URL，也尝试使用路径部分从缓存获取
      const cached = await getFromCache(pathPart);
      if (cached) {
        logger.debug('RESOURCE', '从缓存获取资源', { url, pathPart });
        return cached;
      }

      // 缓存不存在，尝试从服务器获取
      // 从路径中提取文件名
      const urlParts = pathPart.split('/');
      const filename = urlParts[urlParts.length - 1];
      const serverData = await getFile(resourceType, filename);
      if (serverData) {
        logger.debug('RESOURCE', '从服务器获取资源', { url, pathPart });
        return serverData;
      }
    } catch (error: any) {
      logger.warn('RESOURCE', '获取资源失败', { url, pathPart, error });
    }
  }

  // 如果是 HTTP URL（包括 localhost），直接返回
  // 对于 localhost 地址，浏览器应该能够直接访问（如果服务器配置了正确的 CORS）
  if (url.startsWith('http')) {
    return url;
  }

  // 其他情况，直接返回
  return url;
};

/**
 * 批量获取资源 URL
 */
export const getResourceUrls = async (
  urls: (string | undefined)[],
  resourceType: 'images' | 'videos' = 'images'
): Promise<(string | undefined)[]> => {
  return Promise.all(urls.map(url => getResourceUrl(url, resourceType)));
};
