import React, { useState, useEffect } from 'react';
import { html } from '../utils/html.js';
import { ArrowLeft, Save, Plus, Trash2, Edit2, Image as ImageIcon, Loader2, LayoutTemplate, ZoomIn, Smartphone, Monitor, Edit3, ChevronDown } from 'lucide-react';
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

const Section = ({ title, icon: Icon, children, isLiquid, isOpen, onToggle }) => {
  return html`
    <div className=${`rounded-[2rem] p-6 md:p-8 mb-6 relative overflow-hidden ring-1 transition-all duration-500 ${isLiquid ? 'bg-white/60 backdrop-blur-xl shadow-glass ring-white/60' : 'bg-white shadow-sm ring-slate-200'}`}>
        <div 
            className="flex items-center justify-between cursor-pointer group select-none"
            onClick=${onToggle}
        >
            <div className="flex items-center gap-3">
                <div className=${`p-2.5 rounded-xl text-indigo-600 transition-all ${isLiquid ? 'bg-white/50 shadow-glass border border-white/60' : 'bg-indigo-50 shadow-sm border border-indigo-100'}`}><${Icon} size=${24} strokeWidth=${2} /></div>
                <h2 className="text-xl font-sans font-bold text-slate-800">${title}</h2>
            </div>
            <div className=${`p-2 rounded-full text-slate-400 hover:bg-white transition-all duration-300 ${isOpen ? 'rotate-180 bg-white shadow-sm text-indigo-600' : ''}`}>
                <${ChevronDown} size=${20} />
            </div>
        </div>
        
        <div className=${`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
            <div className="overflow-hidden min-h-0">
                <div className="pt-6">
                    ${children}
                </div>
            </div>
        </div>
    </div>
  `;
};

// Đơn giản, không có dòng chú thích theo yêu cầu người dùng
const Toggle = ({ label, checked, onChange, icon: Icon, isLiquid }) => html`
  <div className=${`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${checked ? (isLiquid ? 'bg-white/40 border-indigo-300/50' : 'bg-indigo-50/80 border-indigo-200') : (isLiquid ? 'bg-white/20 border-white/40 hover:bg-white/40' : 'bg-slate-50/80 border-slate-200 hover:border-slate-300')}`} onClick=${() => onChange(!checked)}>
    <div className="flex items-center gap-4">
        <div className=${`p-2.5 rounded-xl transition-colors ${checked ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : (isLiquid ? 'bg-white/40 text-slate-500' : 'bg-slate-200 text-slate-500')}`}>
            <${Icon} size=${20} />
        </div>
        <div>
            <h3 className="font-bold text-slate-700 text-sm md:text-base">${label}</h3>
        </div>
    </div>
    <div className=${`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-indigo-500' : (isLiquid ? 'bg-white/50 border border-white/60' : 'bg-slate-300')}`}>
        <div className=${`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
  </div>
`;

// Nút hạ xuống 1 ô dính liền: thanh nút bo 2 góc trên, khung nối thêm bo 2 góc dưới và nối liền lại có 3 hàng
const AttachedDropdownToggle = ({ 
  label, 
  icon: Icon, 
  enabled, 
  onToggleEnabled, 
  targets, 
  onChangeTarget, 
  isLiquid 
}) => {
  const safeTargets = targets || { view: true, edit: true, app: false };

  return html`
    <div className="w-full transition-all">
      <!-- Thanh nút chính ở trên -->
      <div 
        className=${`flex items-center justify-between p-4 border transition-all cursor-pointer ${
          enabled 
            ? (isLiquid ? 'bg-white/50 border-indigo-300/60 rounded-t-2xl rounded-b-none' : 'bg-indigo-50/90 border-indigo-200 rounded-t-2xl rounded-b-none')
            : (isLiquid ? 'bg-white/20 border-white/40 hover:bg-white/40 rounded-2xl' : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 rounded-2xl')
        }`} 
        onClick=${() => onToggleEnabled(!enabled)}
      >
        <div className="flex items-center gap-4">
          <div className=${`p-2.5 rounded-xl transition-colors ${
            enabled ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : (isLiquid ? 'bg-white/40 text-slate-500' : 'bg-slate-200 text-slate-500')
          }`}>
            <${Icon} size=${20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-700 text-sm md:text-base">${label}</h3>
          </div>
        </div>
        <div className=${`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
          enabled ? 'bg-indigo-500' : (isLiquid ? 'bg-white/50 border border-white/60' : 'bg-slate-300')
        }`}>
          <div className=${`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}></div>
        </div>
      </div>

      <!-- Khung nối thêm dính liền bên dưới (hạ xuống khi bật) -->
      <div className=${`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
        enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
      }`}>
        <div className="overflow-hidden min-h-0">
          <div className=${`-mt-[1px] border-x border-b rounded-b-2xl overflow-hidden divide-y ${
            isLiquid 
              ? 'bg-white/30 backdrop-blur-md border-indigo-300/60 divide-white/30' 
              : 'bg-indigo-50/40 border-indigo-200 divide-indigo-100/80'
          }`}>
            <!-- Hàng 1: Trang Xem -->
            <div 
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/50 transition-colors cursor-pointer"
              onClick=${(e) => { e.stopPropagation(); onChangeTarget('view', !safeTargets.view); }}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-500">
                  <${Monitor} size=${18} />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Trang Xem</span>
              </div>
              <div className=${`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                safeTargets.view ? 'bg-indigo-500' : (isLiquid ? 'bg-white/60 border border-white/70' : 'bg-slate-300')
              }`}>
                <div className=${`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  safeTargets.view ? 'translate-x-4' : 'translate-x-0'
                }`}></div>
              </div>
            </div>

            <!-- Hàng 2: Trang Sửa -->
            <div 
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/50 transition-colors cursor-pointer"
              onClick=${(e) => { e.stopPropagation(); onChangeTarget('edit', !safeTargets.edit); }}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-500">
                  <${Edit3} size=${18} />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Trang Sửa</span>
              </div>
              <div className=${`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                safeTargets.edit ? 'bg-indigo-500' : (isLiquid ? 'bg-white/60 border border-white/70' : 'bg-slate-300')
              }`}>
                <div className=${`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  safeTargets.edit ? 'translate-x-4' : 'translate-x-0'
                }`}></div>
              </div>
            </div>

            <!-- Hàng 3: Chế độ App -->
            <div 
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/50 transition-colors cursor-pointer"
              onClick=${(e) => { e.stopPropagation(); onChangeTarget('app', !safeTargets.app); }}
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-500">
                  <${Smartphone} size=${18} />
                </div>
                <span className="font-semibold text-slate-700 text-sm">Chế độ App</span>
              </div>
              <div className=${`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                safeTargets.app ? 'bg-indigo-500' : (isLiquid ? 'bg-white/60 border border-white/70' : 'bg-slate-300')
              }`}>
                <div className=${`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  safeTargets.app ? 'translate-x-4' : 'translate-x-0'
                }`}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { setBreadcrumbsVisible } = useBreadcrumbs();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Các mục xổ xuống trong phần cài đặt thì mỗi lần chỉ mở 1 mục, khi mở mục khác thì mục còn lại sẽ đóng
  const [openSectionId, setOpenSectionId] = useState('ui');

  const toggleSection = (sectionId) => {
    setOpenSectionId(prev => prev === sectionId ? null : sectionId);
  };

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
    let localBackButton = { enabled: true, view: true, edit: true, app: true };
    try {
      const saved = localStorage.getItem('ui_back_button');
      if (saved !== null) {
        if (saved === 'true') localBackButton = { enabled: true, view: true, edit: true, app: true };
        else if (saved === 'false') localBackButton = { enabled: false, view: false, edit: false, app: false };
        else localBackButton = JSON.parse(saved);
      }
    } catch {}

    if (data && data.ui) {
      if (data.ui.backButton === undefined) {
        data.ui.backButton = localBackButton;
      } else if (typeof data.ui.backButton === 'boolean') {
        data.ui.backButton = {
          enabled: data.ui.backButton,
          view: data.ui.backButton,
          edit: data.ui.backButton,
          app: data.ui.backButton
        };
      } else if (typeof data.ui.backButton === 'object') {
        data.ui.backButton = {
          enabled: data.ui.backButton.enabled !== false,
          view: data.ui.backButton.view !== false,
          edit: data.ui.backButton.edit !== false,
          app: data.ui.backButton.app !== false
        };
      }

      if (!data.ui.zoom || typeof data.ui.zoom !== 'object') {
        data.ui.zoom = { enabled: true, view: true, edit: true, app: false };
      } else {
        const hasAnyZoom = data.ui.zoom.view || data.ui.zoom.edit || data.ui.zoom.app;
        data.ui.zoom = {
          enabled: data.ui.zoom.enabled !== undefined ? data.ui.zoom.enabled : hasAnyZoom,
          view: data.ui.zoom.view !== false,
          edit: data.ui.zoom.edit !== false,
          app: data.ui.zoom.app === true
        };
      }
    }
    setConfig(data);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('ui_back_button', JSON.stringify(config?.ui?.backButton));
    } catch {}
    const bgImages = Array.isArray(config?.background?.images) ? config.background.images : [];
    const cleanBackgrounds = {
        ...(config?.background || {}),
        images: bgImages.filter(url => url && typeof url === 'string' && url.trim().length > 0)
    };
    const success = await apiService.saveFullConfig({ ...config, background: cleanBackgrounds });
    setSaving(false);
    if (success) {
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
        return prev;
    });
  };

  const updateZoom = (field, value) => {
    setConfig(prev => {
      const current = prev?.ui?.zoom || { enabled: true, view: true, edit: true, app: false };
      const updated = { ...current, [field]: value };
      if (field === 'enabled' && value === true && !updated.view && !updated.edit && !updated.app) {
        updated.view = true;
        updated.edit = true;
      }
      return {
        ...prev,
        ui: {
          ...prev.ui,
          zoom: updated
        }
      };
    });
  };

  const updateBackButton = (field, value) => {
    setConfig(prev => {
      const current = prev?.ui?.backButton || { enabled: true, view: true, edit: true, app: true };
      const updated = { ...current, [field]: value };
      if (field === 'enabled' && value === true && !updated.view && !updated.edit && !updated.app) {
        updated.view = true;
        updated.edit = true;
      }
      return {
        ...prev,
        ui: {
          ...prev.ui,
          backButton: updated
        }
      };
    });
  };

  const handleAddBg = () => {
    if (!config?.background?.active) return;
    const bgList = Array.isArray(config?.background?.images) ? config.background.images : [];
    updateConfig('background', 'images', [...bgList, '']);
  };

  const handleBgChange = (index, val) => {
    const bgList = Array.isArray(config?.background?.images) ? config.background.images : [];
    const newImgs = [...bgList];
    newImgs[index] = val;
    updateConfig('background', 'images', newImgs);
  };

  const handleBgDelete = (index) => {
    const bgList = Array.isArray(config?.background?.images) ? config.background.images : [];
    updateConfig('background', 'images', bgList.filter((_, i) => i !== index));
  };

  const isLiquid = config?.ui?.style === 'liquid';

  if (loading || !config) return html`<div className="flex justify-center items-center h-screen"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;

  const bgImages = Array.isArray(config?.background?.images) ? config.background.images : [];
  const zoomConfig = config?.ui?.zoom || { enabled: true, view: true, edit: true, app: false };
  const backButtonConfig = config?.ui?.backButton || { enabled: true, view: true, edit: true, app: true };

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

      <!-- GIAO DIỆN & HIỂN THỊ -->
      <${Section} 
        title="Giao diện & Hiển thị" 
        icon=${LayoutTemplate} 
        isLiquid=${isLiquid}
        isOpen=${openSectionId === 'ui'}
        onToggle=${() => toggleSection('ui')}
      >
         <div className="space-y-4">
            <!-- 1. Chế độ Liquid Glass -->
            <${Toggle} 
                label="Chế độ Liquid Glass" 
                checked=${config?.ui?.style === 'liquid'}
                onChange=${(val) => updateConfig('ui', 'style', val ? 'liquid' : 'normal')}
                icon=${LayoutTemplate}
                isLiquid=${isLiquid}
            />

            <!-- 2. Nút Zoom (Được đưa lên sau liquid glass và trước cài đặt nút quay lại) -->
            <${AttachedDropdownToggle} 
                label="Nút Zoom (Tăng giảm cỡ chữ)"
                icon=${ZoomIn}
                enabled=${zoomConfig.enabled !== false}
                onToggleEnabled=${(val) => updateZoom('enabled', val)}
                targets=${zoomConfig}
                onChangeTarget=${(targetKey, val) => updateZoom(targetKey, val)}
                isLiquid=${isLiquid}
            />

            <!-- 3. Nút quay lại thư mục trước (Khi bật hạ xuống 1 ô dính liền có 3 hàng: Trang Xem, Trang Sửa, Chế độ App) -->
            <${AttachedDropdownToggle} 
                label="Quay lại thư mục trước"
                icon=${ArrowLeft}
                enabled=${backButtonConfig.enabled !== false}
                onToggleEnabled=${(val) => updateBackButton('enabled', val)}
                targets=${backButtonConfig}
                onChangeTarget=${(targetKey, val) => updateBackButton(targetKey, val)}
                isLiquid=${isLiquid}
            />
         </div>
      </${Section}>

      <!-- ẢNH NỀN TÙY CHỈNH -->
      <${Section} 
        title="Ảnh nền tùy chỉnh" 
        icon=${ImageIcon} 
        isLiquid=${isLiquid}
        isOpen=${openSectionId === 'background'}
        onToggle=${() => toggleSection('background')}
      >
         <${Toggle} 
            label="Bật ảnh nền tự chọn" 
            checked=${!!config?.background?.active}
            onChange=${(val) => updateConfig('background', 'active', val)}
            icon=${ImageIcon}
            isLiquid=${isLiquid}
         />
         
         <div className=${`mt-6 transition-all ${!config?.background?.active ? 'opacity-50 pointer-events-none' : ''}`}>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Danh sách ảnh</h3>
             <div className="space-y-1">
                ${bgImages.map((url, idx) => html`
                    <${BackgroundItem} index=${idx} url=${url} onChange=${(v) => handleBgChange(idx, v)} onDelete=${() => handleBgDelete(idx)} disabled=${!config?.background?.active} />
                `)}
             </div>
             <button onClick=${handleAddBg} disabled=${!config.background.active} className=${`w-full py-3 border-2 border-dashed rounded-xl transition-all font-bold flex items-center justify-center gap-2 mt-3 ${isLiquid ? 'border-white/60 bg-white/30 text-indigo-700 hover:bg-white/50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}><${Plus} size=${18} /> Thêm ảnh mới</button>
         </div>
      </${Section}>
    </div>
  `;
};
