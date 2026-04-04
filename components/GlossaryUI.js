import React from 'react';
import { SearchIcon, XIcon } from './Icons';


export const SearchBar = () => (
  <div className="relative flex-1">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
      <SearchIcon />
    </div>
    <input 
      type="text" 
      placeholder="Search terms or translations..." 
      className="w-full pl-11 pr-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none input-focus-ring transition-all placeholder:text-slate-400 font-medium text-sm"
    />
  </div>
);


export const PrimaryButton = ({ children, onClick, type = "button", variant = "black" }) => {
  const base = "px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm w-full md:w-auto";
  
  const styles = {
    black: "bg-[#050505] text-white hover:bg-slate-800 shadow-sm",
    light: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    outline: "bg-white text-slate-900 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-xs",
  };
    
  return (
    <button type={type} onClick={onClick} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
};

export const Modal = ({ isOpen, onClose, children, title, icon }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden animate-modal">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <XIcon />
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
};