
import React, { useState, useEffect, useRef } from 'react';
import { html } from '../utils/html.js';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, GripVertical, Check, X, Save } from 'lucide-react';
import { useClasses } from '../context/ClassContext.js';
import Sortable from 'sortablejs';

export const ClassManagementPage = () => {
  const navigate = useNavigate();
  const { classes, updateClasses, loading } = useClasses();
  const [localClasses, setLocalClasses] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const listRef = useRef(null);
  const sortableInstance = useRef(null);

  useEffect(() => {
    setLocalClasses(classes);
  }, [classes]);

  useEffect(() => {
    if (listRef.current && !sortableInstance.current) {
      sortableInstance.current = Sortable.create(listRef.current, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => {
          const newOrder = Array.from(listRef.current.children).map(el => el.getAttribute('data-id'));
          setLocalClasses(prev => {
            const reordered = [...prev];
            reordered.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            return reordered.map((c, i) => ({ ...c, orderIndex: i }));
          });
        }
      });
    }
    return () => {
      if (sortableInstance.current) {
        sortableInstance.current.destroy();
        sortableInstance.current = null;
      }
    };
  }, [localClasses]);

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const safeList = Array.isArray(localClasses) ? localClasses : [];
    const newClass = {
      id: Math.random().toString(36).substr(2, 9),
      title: newClassName.startsWith('Lớp ') ? newClassName : `Lớp ${newClassName}`,
      orderIndex: safeList.length,
      isDefault: safeList.length === 0
    };
    const updated = [...safeList, newClass];
    setLocalClasses(updated);
    setNewClassName('');
    setIsAdding(false);
  };

  const handleDeleteClass = (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa lớp này?')) {
      const updated = localClasses.filter(c => c.id !== id);
      // If we deleted the default class, pick a new one
      if (localClasses.find(c => c.id === id)?.isDefault && updated && updated.length > 0) {
        updated[0].isDefault = true;
      }
      setLocalClasses(updated);
    }
  };

  const handleSetDefault = (id) => {
    const updated = localClasses.map(c => ({
      ...c,
      isDefault: c.id === id
    }));
    setLocalClasses(updated);
  };

  const handleStartEdit = (cls) => {
    setEditingId(cls.id);
    setEditName(cls.title);
  };

  const handleSaveEdit = () => {
    setLocalClasses(prev => prev.map(c => c.id === editingId ? { ...c, title: editName } : c));
    setEditingId(null);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await updateClasses(localClasses);
    setSaving(false);
    navigate('/edit');
  };

  if (loading) return html`<div className="flex items-center justify-center min-h-[60vh]"><p className="text-slate-400">Đang tải...</p></div>`;

  return html`
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick=${() => navigate('/edit')} className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <${ArrowLeft} size=${20} />
          </button>
          <h1 className="text-3xl font-serif font-bold text-slate-800">Quản lý lớp</h1>
        </div>
        <button 
          onClick=${handleSaveAll}
          disabled=${saving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
        >
          <${Save} size=${20} />
          ${saving ? 'Đang lưu...' : 'Lưu tất cả'}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-800">Danh sách lớp học</h2>
            <p className="text-sm text-slate-500 mt-1">Kéo thả để sắp xếp thứ tự hiển thị</p>
          </div>
          <button 
            onClick=${() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-sm"
          >
            <${Plus} size=${18} />
            Thêm lớp
          </button>
        </div>

        <div className="p-4">
          ${isAdding && html`
            <div className="mb-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
              <input 
                type="text" 
                autoFocus
                value=${newClassName}
                onChange=${(e) => setNewClassName(e.target.value)}
                onKeyPress=${(e) => e.key === 'Enter' && handleAddClass()}
                placeholder="Nhập tên lớp (VD: 10A1)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
              />
              <button onClick=${handleAddClass} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"><${Check} size=${20} /></button>
              <button onClick=${() => setIsAdding(false)} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"><${X} size=${20} /></button>
            </div>
          `}

          <div ref=${listRef} className="space-y-2">
            ${localClasses.map(cls => html`
              <div 
                key=${cls.id} 
                data-id=${cls.id}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
              >
                <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-300 group-hover:text-slate-400">
                  <${GripVertical} size=${20} />
                </div>

                <input 
                  type="radio" 
                  name="default-class"
                  checked=${cls.isDefault}
                  onChange=${() => handleSetDefault(cls.id)}
                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  title="Đặt làm mặc định"
                />

                <div className="flex-1">
                  ${editingId === cls.id ? html`
                    <input 
                      type="text" 
                      autoFocus
                      value=${editName}
                      onChange=${(e) => setEditName(e.target.value)}
                      onBlur=${handleSaveEdit}
                      onKeyPress=${(e) => e.key === 'Enter' && handleSaveEdit()}
                      className="w-full px-3 py-1.5 rounded-lg border border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  ` : html`
                    <span className="font-bold text-slate-700 text-lg">${cls.title}</span>
                    ${cls.isDefault && html`<span className="ml-3 text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">Mặc định</span>`}
                  `}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick=${() => handleStartEdit(cls)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                  >
                    <${Edit2} size=${18} />
                  </button>
                  <button 
                    onClick=${() => handleDeleteClass(cls.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                  >
                    <${Trash2} size=${18} />
                  </button>
                </div>
              </div>
            `)}
            
            ${(!localClasses || localClasses.length === 0) && !isAdding && html`
              <div className="py-12 text-center">
                <p className="text-slate-400 italic">Chưa có lớp học nào. Hãy thêm lớp mới!</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
};
