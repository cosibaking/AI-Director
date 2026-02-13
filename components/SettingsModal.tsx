import React, { useState } from 'react';
import { X, Key, ShieldCheck, ArrowRight } from 'lucide-react';
import { setGlobalApiKey } from '../services/doubaoService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onApiKeyUpdate: (key: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentApiKey,
  onApiKeyUpdate 
}) => {
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleUpdateKey = () => {
    if (!inputKey.trim()) return;
    onApiKeyUpdate(inputKey);
    setGlobalApiKey(inputKey);
    localStorage.setItem('cinegen_doubao_api_key', inputKey);
    setInputKey('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">系统设置</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">System Settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current API Key Status */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              当前 API Key 状态
            </label>
            <div className="bg-[#141414] border border-zinc-800 rounded-lg p-3">
              {currentApiKey ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <ShieldCheck className="w-3 h-3 text-green-500" />
                    <span>已配置</span>
                  </div>
                  <div className="font-mono text-xs text-zinc-300 break-all">
                    {showKey ? currentApiKey : '•'.repeat(Math.min(currentApiKey.length, 32))}
                  </div>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showKey ? '隐藏' : '显示'}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">未配置</div>
              )}
            </div>
          </div>

          {/* Update API Key */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {currentApiKey ? '更新 API Key' : '设置 API Key'}
            </label>
            <input 
              type="password" 
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="输入新的 API Key..."
              className="w-full bg-[#141414] border border-zinc-800 text-white px-4 py-3 text-sm rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-900 transition-all font-mono placeholder:text-zinc-700"
            />
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              本应用需要火山云 Doubao 模型权限（Chat: Doubao-Seed-1.8, Image: Doubao-Seedream4.5, Video: Doubao-Seedance1.5-pro）。请确保您的 API Key 已开通相应服务权限。
              <a href="https://www.volcengine.com/docs/8239" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline ml-1">查看文档</a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button 
              onClick={handleUpdateKey}
              disabled={!inputKey.trim()}
              className="flex-1 py-3 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentApiKey ? '更新' : '保存'} <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-zinc-900 text-zinc-300 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-zinc-800 transition-colors"
            >
              取消
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-700 font-mono pt-2 border-t border-zinc-900">
            <ShieldCheck className="w-3 h-3" />
            Key is stored locally in your browser
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
