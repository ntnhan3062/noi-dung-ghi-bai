
import React, { useState, useEffect } from 'react';
import { html } from '../utils/html.js';
import { ArrowLeft, Save, Plus, Trash2, Edit2, Image as ImageIcon, Check, Loader2, LayoutTemplate, ZoomIn, Smartphone, Monitor, Edit3, ChevronDown } from 'lucide-react';
import { apiService } from '../services/apiService.js';
import { useNavigate } from 'react-router-dom';
import { useBreadcrumbs } from '../context/BreadcrumbContext.js';

const BackgroundItem = ({ url, index, onChange, onDelete, disabled }) => {
  const [isEditing, setIsEditing] = useState(!url);
  const [inputValue, setInputValue] = useState(url || '');

  const checkImage = (src) => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {};
    img.src = src;
  };

  const handleBlur = () => {
    if (!inputValue.trim()) {
        if (!url) onDelete();
        else setIsEditing(false);
        return;
    }
    checkImage(inputValue);
    setIsEditing(false);
    onChange(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleBlur();
  };

  if (isEditing) {
    return html`
      <div className="flex items-center gap-2 mb-3 animate-in fade-in">
        <div className="flex-1 relative">
            <input
                type="text"
                value=${inputValue}
                onChange=${(e) => setInputValue(e.target.value)}
                onBlur=${handleBlur}
                onKeyDown=${handleKeyDown}
                disabled=${disabled}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm font-medium"
                placeholder="Dán liên kết ảnh hoặc Base64..."
                autoFocus
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <${ImageIcon} size=${16} />
            </div>
        </div>
        <button onClick=${onDelete} disabled=${disabled} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Xóa">
            <${Trash2} size=${18} />
        </button>
      </div>
    `;
  }

  return html`
    <div className=${`group relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all mb-3 bg-slate-100 ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <img src=${url} alt="Background" className="w-full h-full object-cover" />
      ${!disabled && html`
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
            <button onClick=${() => setIsEditing(true)} className="p-2 bg-white text-indigo-600 rounded-lg hover:scale-110 transition-transform shadow-lg"><${Edit2} size=${18} /></button>
            <button onClick=${onDelete} className="p-2 bg-white text-red-500 rounded-lg hover:scale-110 transition-transform shadow-lg"><${Trash2} size=${18} /></button>
        </div>
      `}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md opacity-60">#${index + 1}</div>
    </div>
  `;
};

const Section = ({ title, icon: Icon, children, isLiquid }) => {
  const [isOpen, setIsOpen] = useState(true);

  return html`
    <div className=${`rounded-[2rem] p-6 md:p-8 mb-6 relative overflow-hidden ring-1 transition-all duration-500 ${isLiquid ? 'bg-white/60 backdrop-blur-xl shadow-glass ring-white/60' : 'bg-white shadow-sm ring-slate-200'}`}>
        <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick=${() => setIsOpen(!isOpen)}
        >
            <div className="flex items-center gap-3">
                <div className=${`p-2.5 rounded-xl text-indigo-600 transition-all ${isLiquid ? 'bg-white/50 shadow-glass border border-white/60' : 'bg-indigo-50 shadow-sm border border-indigo-100'}`}><${Icon} size=${24} strokeWidth=${2} /></div>
                <h2 className="text-xl font-sans font-bold text-slate-800">${title}</h2>
            </div>
            <div className=${`p-2 rounded-full text-slate-400 hover:bg-white transition-all duration-300 ${isOpen ? 'rotate-180 bg-white shadow-sm text-indigo-600' : ''}`}>
                <${ChevronDown} size=${20} />
            </div>
        </div>
        
        ${isOpen && html`
            <div className="mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                ${children}
            </div>
        `}
    </div>
  `;
};

const Toggle = ({ label, subLabel, checked, onChange, icon: Icon, isLiquid }) => html`
  <div className=${`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${checked ? (isLiquid ? 'bg-white/40 border-indigo-300/50' : 'bg-indigo-50/80 border-indigo-200') : (isLiquid ? 'bg-white/20 border-white/40 hover:bg-white/40' : 'bg-slate-50/80 border-slate-200 hover:border-slate-300')}`} onClick=${() => onChange(!checked)}>
    <div className="flex items-center gap-4">
        <div className=${`p-2.5 rounded-xl transition-colors ${checked ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : (isLiquid ? 'bg-white/40 text-slate-500' : 'bg-slate-200 text-slate-500')}`}>
            <${Icon} size=${20} />
        </div>
        <div>
            <h3 className="font-bold text-slate-700 text-sm">${label}</h3>
            ${subLabel && html`<p className="text-xs text-slate-500 font-medium mt-0.5">${subLabel}</p>`}
        </div>
    </div>
    <div className=${`w-12 h-7 rounded-full transition-colors relative ${checked ? 'bg-indigo-500' : (isLiquid ? 'bg-white/50 border border-white/60' : 'bg-slate-300')}`}>
        <div className=${`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
  </div>
`;

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { setBreadcrumbsVisible } = useBreadcrumbs();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbsVisible(false);
    return () => setBreadcrumbsVisible(true);
  }, [setBreadcrumbsVisible]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const data = await apiService.getFullConfig();
    setConfig(data);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const bgImages = Array.isArray(config?.background?.images) ? config.background.images : [];
    const cleanBackgrounds = {
        ...(config?.background || {}),
        images: bgImages.filter(url => url && typeof url === 'string' && url.trim().length > 0)
    };
    const success = await apiService.saveFullConfig({ ...config, background: cleanBackgrounds });
    setSaving(false);
    if (success) {
      // Reload to apply changes immediately globally
      window.location.href = '#/edit'; 
      window.location.reload();
    } else {
      alert("Có lỗi khi lưu cài đặt!");
    }
  };

  const updateConfig = (section, key, value) => {
    setConfig(prev => {
        if (section === 'background') {
             return { ...prev, background: { ...prev.background, [key]: value } };
        }
        if (section === 'ui') {
            return { ...prev, ui: { ...prev.ui, [key]: value } };
        }
        if (section === 'zoom') {
            return { ...prev, ui: { ...prev.ui, zoom: { ...prev.ui.zoom, [key]: value } } };
        }
        return prev;
    });
  };

  const handleAddBg = () => {
    if (!config.background.active) return;
    updateConfig('background', 'images', [...config.background.images, '']);
  };

  const handleBgChange = (index, val) => {
    const newImgs = [...config.background.images];
    newImgs[index] = val;
    updateConfig('background', 'images', newImgs);
  };

  const handleBgDelete = (index) => {
    updateConfig('background', 'images', config.background.images.filter((_, i) => i !== index));
  };

  const isLiquid = config?.ui?.style === 'liquid';

  if (loading) return html`<div className="flex justify-center items-center h-screen"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;

  return html`
    <div className="max-w-3xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <button onClick=${() => navigate('/edit')} className=${`p-3 rounded-xl transition-all border ${isLiquid ? 'bg-white/50 hover:bg-white shadow-glass border-white/50 text-slate-600 hover:text-indigo-600' : 'bg-white hover:bg-slate-50 shadow-sm border-slate-200 text-slate-500 hover:text-indigo-600'}`}><${ArrowLeft} size=${24} /></button>
            <h1 className="text-3xl font-sans font-bold text-slate-900">Cài đặt hệ thống</h1>
        </div>
        <button 
            onClick=${handleSave} 
            disabled=${saving}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70"
        >
            ${saving ? html`<${Loader2} size=${20} className="animate-spin" />` : html`<${Save} size=${20} />`} ${saving ? 'Đang lưu...' : 'Lưu lại'}
        </button>
      </header>

      <!-- GIAO DIỆN -->
      <${Section} title="Giao diện & Hiển thị" icon=${LayoutTemplate} isLiquid=${isLiquid}>
         <div className="space-y-4">
            <${Toggle} 
                label="Chế độ Liquid Glass" 
                subLabel="Sử dụng giao diện kính trong suốt và nền bong bóng chuyển động. Tắt để dùng giao diện phẳng (Nhanh hơn)."
                checked=${config.ui.style === 'liquid'}
                onChange=${(val) => updateConfig('ui', 'style', val ? 'liquid' : 'normal')}
                icon=${LayoutTemplate}
                isLiquid=${isLiquid}
            />
         </div>
      </${Section}>

      <!-- ẢNH NỀN -->
      <${Section} title="Ảnh nền tùy chỉnh" icon=${ImageIcon} isLiquid=${isLiquid}>
         <${Toggle} 
            label="Bật ảnh nền tự chọn" 
            subLabel="Sử dụng ảnh nền thay vì hiệu ứng Liquid mặc định. (Tự động đổi mỗi 60s nếu có nhiều ảnh)"
            checked=${config.background.active}
            onChange=${(val) => updateConfig('background', 'active', val)}
            icon=${ImageIcon}
            isLiquid=${isLiquid}
         />
         
         <div className=${`mt-6 transition-all ${!config.background.active ? 'opacity-50 pointer-events-none' : ''}`}>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Danh sách ảnh</h3>
             <div className="space-y-1">
                ${config.background.images.map((url, idx) => html`
                    <${BackgroundItem} index=${idx} url=${url} onChange=${(v) => handleBgChange(idx, v)} onDelete=${() => handleBgDelete(idx)} disabled=${!config.background.active} />
                `)}
             </div>
             <button onClick=${handleAddBg} disabled=${!config.background.active} className=${`w-full py-3 border-2 border-dashed rounded-xl transition-all font-bold flex items-center justify-center gap-2 mt-3 ${isLiquid ? 'border-white/60 bg-white/30 text-indigo-700 hover:bg-white/50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}><${Plus} size=${18} /> Thêm ảnh mới</button>
         </div>
      </${Section}>

      <!-- TIỆN ÍCH ZOOM -->
      <${Section} title="Nút Zoom (Tăng giảm cỡ chữ)" icon=${ZoomIn} isLiquid=${isLiquid}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <${Toggle} 
                label="Trang Xem (View Mode)" 
                subLabel="Hiển thị trên máy tính/web"
                checked=${config.ui.zoom.view}
                onChange=${(val) => updateConfig('zoom', 'view', val)}
                icon=${Monitor}
                isLiquid=${isLiquid}
            />
            <${Toggle} 
                label="Trang Sửa (Edit Mode)" 
                subLabel="Hiển thị khi đang chỉnh sửa"
                checked=${config.ui.zoom.edit}
                onChange=${(val) => updateConfig('zoom', 'edit', val)}
                icon=${Edit3}
                isLiquid=${isLiquid}
            />
            <${Toggle} 
                label="Chế độ App (Mobile)" 
                subLabel="Hiển thị trên ứng dụng điện thoại"
                checked=${config.ui.zoom.app}
                onChange=${(val) => updateConfig('zoom', 'app', val)}
                icon=${Smartphone}
                isLiquid=${isLiquid}
            />
         </div>
      </${Section}>
    </div>
  `;
};
