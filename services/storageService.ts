import { ProjectState } from '../types';
import { logger } from '../utils/logger';

const DB_NAME = 'CineGenDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveProjectToDB = async (project: ProjectState): Promise<void> => {
  logger.info('STORAGE', '保存项目到数据库', { projectId: project.id, title: project.title });
  const startTime = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const p = { ...project, lastModified: Date.now() };
    const request = store.put(p);
    request.onsuccess = () => {
      const duration = Date.now() - startTime;
      logger.info('STORAGE', '项目保存成功', { projectId: project.id, duration: `${duration}ms` });
      resolve();
    };
    request.onerror = () => {
      logger.error('STORAGE', '项目保存失败', { projectId: project.id, error: request.error });
      reject(request.error);
    };
  });
};

export const loadProjectFromDB = async (id: string): Promise<ProjectState> => {
  logger.info('STORAGE', '从数据库加载项目', { projectId: id });
  const startTime = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        const duration = Date.now() - startTime;
        logger.info('STORAGE', '项目加载成功', { projectId: id, title: request.result.title, duration: `${duration}ms` });
        resolve(request.result);
      } else {
        logger.warn('STORAGE', '项目未找到', { projectId: id });
        reject(new Error("Project not found"));
      }
    };
    request.onerror = () => {
      logger.error('STORAGE', '项目加载失败', { projectId: id, error: request.error });
      reject(request.error);
    };
  });
};

export const getAllProjectsMetadata = async (): Promise<ProjectState[]> => {
  logger.info('STORAGE', '获取所有项目元数据');
  const startTime = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll(); 
    request.onsuccess = () => {
       const projects = request.result as ProjectState[];
       // Sort by last modified descending
       projects.sort((a, b) => b.lastModified - a.lastModified);
       const duration = Date.now() - startTime;
       logger.info('STORAGE', '获取所有项目元数据成功', { count: projects.length, duration: `${duration}ms` });
       resolve(projects);
    };
    request.onerror = () => {
      logger.error('STORAGE', '获取所有项目元数据失败', { error: request.error });
      reject(request.error);
    };
  });
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
  logger.info('STORAGE', '从数据库删除项目', { projectId: id });
  const startTime = Date.now();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => {
      const duration = Date.now() - startTime;
      logger.info('STORAGE', '项目删除成功', { projectId: id, duration: `${duration}ms` });
      resolve();
    };
    request.onerror = () => {
      logger.error('STORAGE', '项目删除失败', { projectId: id, error: request.error });
      reject(request.error);
    };
  });
};

// Initial template for new projects
export const createNewProjectState = (): ProjectState => {
  const id = 'proj_' + Date.now().toString(36);
  logger.info('STORAGE', '创建新项目', { projectId: id });
  return {
    id,
    title: '未命名项目',
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    targetDuration: '60s', // Default duration now 60s
    language: '中文', // Default language
    rawScript: `标题：示例剧本

场景 1
外景。夜晚街道 - 雨夜
霓虹灯在水坑中反射出破碎的光芒。
侦探（30岁，穿着风衣）站在街角，点燃了一支烟。

侦探
这雨什么时候才会停？`,
    scriptData: null,
    shots: [],
    isParsingScript: false,
  };
};