
import React, { useState } from 'react';
import { html } from '../utils/html.js';
import { X, Lock, Save, CheckCircle } from 'lucide-react';

export const ChangePasswordModal = ({ isOpen, onClose, onSave }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setError('Mật khẩu quá ngắn.');
      return;
    }
    setLoading(true);
    const result = await onSave(newPassword);
    setLoading(false);
    if (result) {
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } else {
      setError('Có lỗi khi lưu mật khẩu. Vui lòng thử lại.');
    }
  };

  return html`
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-glass border border-white/60 w-full max-w-md overflow-hidden transform transition-all ring-1 ring-white/50 relative">
        <div className="px-6 py-5 border-b border-white/30 flex justify-between items-center bg-white/40">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-indigo-100/50 rounded-xl text-indigo-600"><${Lock} size=${20} /></div>
            <h2 className="text-xl font-bold font-serif">Đổi mật khẩu</h2>
          </div>
          <button onClick=${onClose} className="text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-full p-2 transition-colors">
            <${X} size=${24} />
          </button>
        </div>

        <form onSubmit=${handleSubmit} className="p-6 flex flex-col gap-5">
          ${success ? html`
            <div className="flex flex-col items-center justify-center py-10 text-emerald-600 animate-pulse bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-inner">
              <${CheckCircle} size=${56} className="mb-4" />
              <p className="font-bold text-xl">Đổi mật khẩu thành công!</p>
            </div>
          ` : html`
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Mật khẩu mới</label>
              <input
                type="password"
                required
                value=${newPassword}
                onChange=${(e) => setNewPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl border border-white/60 bg-white/50 focus:bg-white/80 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-900 select-text shadow-inner"
                placeholder="Nhập mật khẩu mới..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">Xác nhận mật khẩu</label>
              <input
                type="password"
                required
                value=${confirmPassword}
                onChange=${(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl border border-white/60 bg-white/50 focus:bg-white/80 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-slate-900 select-text shadow-inner"
                placeholder="Nhập lại mật khẩu..."
              />
            </div>
            ${error && html`<p className="text-red-500 text-sm bg-red-50/80 p-3 rounded-xl border border-red-100 text-center font-bold">${error}</p>`}
          `}
        </form>

        ${!success && html`
          <div className="px-6 py-5 border-t border-white/30 bg-white/30 flex justify-end gap-3">
            <button 
              type="button" 
              onClick=${onClose}
              className="px-5 py-2.5 text-slate-600 font-bold hover:bg-white/60 rounded-xl transition-colors border border-transparent hover:border-white/50"
            >
              Hủy
            </button>
            <button 
              onClick=${handleSubmit}
              disabled=${loading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70 border-t border-white/20"
            >
              ${loading ? 'Đang lưu...' : html`<${React.Fragment}><${Save} size=${18} /> Lưu thay đổi</${React.Fragment}>`}
            </button>
          </div>
        `}
      </div>
    </div>
  `;
};
