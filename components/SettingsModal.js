

import React, { useState, useEffect } from 'react';
import { html } from '../utils/html.js';
import { X, Save, Plus, Trash2, Edit2, Image as ImageIcon, Check, Loader2, Power } from 'lucide-react';
import { apiService } from '../services/apiService.js';

const BackgroundItem = ({ url, index, onChange, onDelete, disabled }) => {
  const [isEditing, setIsEditing] = useState(!url);
  const [inputValue, setInputValue] = useState(url || '');
  const [isValidImage, setIsValidImage] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (url) checkImage(url);
  }, [url]);

  const checkImage = (src) => {
    if (!src) return;
    setChecking(true);
    const img = new Image();
    img.onload = () => {
      setIsValidImage(true);
      setChecking(false);
    };
    img.onerror = () => {
      setIsValidImage(false);
      setChecking(false);
    };
    img.src = src;
  };

  const handleBlur = () => {
    if (!inputValue.trim()) {
        if (!url) onDelete();
        else setIsEditing(false);
        return;
    }
    
    checkImage(inputValue);
    const img = new Image();
    img.onload = () => {
        setIsValidImage(true);
        setIsEditing(false);
        onChange(inputValue);
    };
    img.onerror = () => {
        setIsValidImage(false);
    };
    img.src = inputValue;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        handleBlur();
    }
  };

  if (isEditing) {
    return html`
      <div className="flex items-center gap-2 mb-3 animate-in fade-in slide-in-from-left-4">
        <div className="flex-1 relative">
            <input
                type="text"
                value=${inputValue}
                onChange=${(e) => setInputValue(e.target.value)}
                onBlur=${handleBlur}
                onKeyDown=${handleKeyDown}
                disabled=${disabled}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 focus:bg-white/80 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm font-medium shadow-inner disabled:opacity-50"
                placeholder="Dán liên kết ảnh hoặc Base64..."
                autoFocus
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <${ImageIcon} size=${16} />
            </div>
        </div>
        <button onClick=${onDelete} disabled=${disabled} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50" title="Xóa">
            <${Trash2} size=${18} />
        </button>
      </div>
    `;
  }

  return html`
    <div className=${`group relative aspect-video rounded-xl overflow-hidden border border-white/50 shadow-sm hover:shadow-md transition-all mb-3 bg-slate-100 ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <img src=${url} alt="Background" className="w-full h-full object-cover" />
      
      <!-- Overlay Actions -->
      ${!disabled && html`
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
            <button onClick=${() => setIsEditing(true)} className="p-2 bg-white/90 text-indigo-600 rounded-lg hover:scale-110 transition-transform shadow-lg" title="Sửa link">
                <${Edit2} size=${18} />
            </button>
            <button onClick=${onDelete} className="p-2 bg-white/90 text-red-500 rounded-lg hover:scale-110 transition-transform shadow-lg" title="Xóa ảnh">
                <${Trash2} size=${18} />
            </button>
        </div>
      `}
      
      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md opacity-60">
        #${index + 1}
      </div>
    </div>
  `;
};

export const SettingsModal = ({ isOpen, onClose }) => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    const config = await apiService.getBackgrounds();
    setBackgrounds(config.images || []);
    setIsActive(config.active || false);
    setLoading(false);
  };

  const handleAddRow = () => {
    if (!isActive) return;
    setBackgrounds([...backgrounds, '']);
  };

  const handleChange = (index, newValue) => {
    const newBgs = [...backgrounds];
    newBgs[index] = newValue;
    setBackgrounds(newBgs);
  };

  const handleDelete = (index) => {
    const newBgs = backgrounds.filter((_, i) => i !== index);
    setBackgrounds(newBgs);
  };

  const handleSave = async () => {
    setSaving(true);
    // Filter out empty strings
    const bgList = Array.isArray(backgrounds) ? backgrounds : [];
    const cleanList = bgList.filter(url => url && typeof url === 'string' && url.trim().length > 0);
    const success = await apiService.saveBackgrounds(cleanList, isActive);
    setSaving(false);
    if (success) {
      onClose();
      window.location.reload(); 
    } else {
      alert("Có lỗi khi lưu cài đặt!");
    }
  };

  if (!isOpen) return null;

  return html`
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-glass border border-white/60 w-full max-w-lg overflow-hidden flex flex-col transform transition-all ring-1 ring-white/50 h-[80vh]">
        
        <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-white/40">
          <div className="flex items-center gap-2 text-slate-800">
            <h2 className="text-xl font-bold font-serif">Cài đặt giao diện</h2>
          </div>
          <button onClick=${onClose} className="text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-full p-2.5 transition-colors">
            <${X} size=${24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="mb-6">
            <!-- Main Toggle Switch -->
            <div 
                className=${`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer mb-6 ${isActive ? 'bg-indigo-50/80 border-indigo-200' : 'bg-slate-50/80 border-white/40'}`}
                onClick=${() => setIsActive(!isActive)}
            >
                <div className="flex items-center gap-3">
                    <div className=${`p-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 text-slate-500'}`}>
                        <${ImageIcon} size=${20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700">Ảnh nền tùy chỉnh</h3>
                        <p className="text-xs text-slate-500 font-medium">${isActive ? 'Đang bật chế độ trình chiếu' : 'Đang sử dụng nền mặc định'}</p>
                    </div>
                </div>
                
                <div className=${`w-12 h-7 rounded-full transition-colors relative ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                    <div className=${`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
            </div>

            <h3 className="text-xs font-extrabold text-slate-400 mb-4 uppercase tracking-wider flex items-center justify-between pl-1">
                <span>Danh sách ảnh</span>
                ${isActive && html`<span className="text-[10px] normal-case font-bold bg-white/50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">Thay đổi mỗi 60s</span>`}
            </h3>
            
            ${loading ? html`
                <div className="flex justify-center py-10"><${Loader2} className="animate-spin text-indigo-500" /></div>
            ` : html`
                <div className="space-y-1 transition-opacity ${!isActive ? 'opacity-50 pointer-events-none' : ''}">
                    ${(backgrounds || []).map((url, index) => html`
                        <${BackgroundItem} 
                            index=${index}
                            url=${url} 
                            onChange=${(val) => handleChange(index, val)} 
                            onDelete=${() => handleDelete(index)} 
                            disabled=${!isActive}
                        />
                    `)}
                </div>
                
                ${(!backgrounds || backgrounds.length === 0) && isActive && html`
                    <div className="text-center py-8 border-2 border-dashed border-slate-300/50 rounded-xl bg-slate-50/50 mb-4">
                        <p className="text-slate-400 text-sm">Chưa có ảnh nền nào.</p>
                        <p className="text-slate-400 text-xs mt-1">Thêm ảnh để bắt đầu trình chiếu.</p>
                    </div>
                `}

                <button 
                    onClick=${handleAddRow}
                    disabled=${!isActive}
                    className="w-full py-3 border-2 border-dashed border-indigo-300/50 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all text-sm font-bold flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <${Plus} size=${18} /> Thêm ảnh mới
                </button>
            `}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-white/30 bg-white/30 flex justify-end gap-3">
          <button 
            type="button" 
            onClick=${onClose}
            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-white/60 rounded-xl transition-colors border border-transparent hover:border-white/50"
          >
            Hủy
          </button>
          <button 
            onClick=${handleSave}
            disabled=${loading || saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70 border-t border-white/20"
          >
            ${saving ? 'Đang lưu...' : html`<${React.Fragment}><${Save} size=${18} /> Lưu thay đổi</${React.Fragment}>`}
          </button>
        </div>
      </div>
    </div>
  `;
};
