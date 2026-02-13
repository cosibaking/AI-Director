/**
 * 统一的日志工具
 * 提供不同级别的日志记录功能
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 最多保存1000条日志

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private addLog(level: LogLevel, category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      data
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // 移除最旧的日志
    }

    // 输出到控制台
    const logMethod = level === LogLevel.ERROR ? 'error' : 
                     level === LogLevel.WARN ? 'warn' : 
                     level === LogLevel.DEBUG ? 'debug' : 'log';
    
    const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
    if (data) {
      console[logMethod](prefix, message, data);
    } else {
      console[logMethod](prefix, message);
    }
  }

  debug(category: string, message: string, data?: any) {
    this.addLog(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.addLog(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.addLog(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.addLog(LogLevel.ERROR, category, message, data);
  }

  // API 调用相关日志
  apiCall(apiName: string, method: string, url: string, params?: any) {
    this.info('API', `调用 ${apiName}`, { method, url, params });
  }

  apiSuccess(apiName: string, duration?: number) {
    this.info('API', `${apiName} 调用成功`, duration ? { duration: `${duration}ms` } : undefined);
  }

  apiError(apiName: string, error: any) {
    this.error('API', `${apiName} 调用失败`, error);
  }

  // 数据操作相关日志
  dataOperation(operation: string, details?: any) {
    this.info('DATA', operation, details);
  }

  dataError(operation: string, error: any) {
    this.error('DATA', `${operation} 失败`, error);
  }

  // 用户操作相关日志
  userAction(action: string, details?: any) {
    this.info('USER', action, details);
  }

  // 状态变化相关日志
  stateChange(from: string, to: string, details?: any) {
    this.info('STATE', `状态变化: ${from} -> ${to}`, details);
  }

  // 获取所有日志（用于调试）
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // 清空日志
  clearLogs() {
    this.logs = [];
  }

  // 导出日志为文本
  exportLogs(): string {
    return this.logs.map(log => 
      `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`
    ).join('\n');
  }
}

// 导出单例
export const logger = new Logger();
