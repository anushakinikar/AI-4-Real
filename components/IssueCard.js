'use client';
import { useState } from 'react';

export default function IssueCard({ id, title, fullText, status, errors }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-xl' : 'shadow-sm hover:border-slate-300'}`}>
      <div 
        className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-5 flex-1">
          <svg className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          <span className="bg-slate-100 text-slate-500 font-bold text-xs px-3 py-1.5 rounded-lg tracking-wide">#{id}</span>
          <p className="text-slate-700 font-semibold truncate max-w-2xl">{title}</p>
        </div>
        
        {status === 'clean' ? (
          <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-4 py-1.5 rounded-full text-xs font-bold border border-green-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            Clean
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-red-500 bg-red-50 px-4 py-1.5 rounded-full text-xs font-bold border border-red-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {errors?.length} spelling
          </span>
        )}
      </div>

      {isOpen && (
        <div className="px-16 pb-10 pt-4 animate-in space-y-8">
          <div className="text-slate-800 text-xl leading-relaxed">
            {fullText.split(/(\sprograme\s|\sacces\s|\sinitative\s|\sapproximatly\s|\sgoverments\s|\srecieve\s)/).map((part, i) => {
              const trimmed = part.trim();
              const isError = errors?.some(e => e.original === trimmed);
              return (
                <span key={i} className={isError ? 'bg-red-50 border-b-2 border-red-500 px-1 font-bold text-red-700' : ''}>
                  {part}
                </span>
              );
            })}
          </div>

          {errors && (
            <div className="space-y-5 pt-8 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.length} Issues Found — Review Each Below
              </p>
              
              {errors.map((error, idx) => (
                <div key={idx} className={`flex items-center justify-between p-6 rounded-2xl border-l-[6px] shadow-sm bg-white border border-slate-100 ${error.type === 'Spelling' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                  <div className="space-y-2">
                     <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${error.type === 'Spelling' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                         {error.type}
                       </span>
                       <span className="text-xs text-slate-400 font-semibold tracking-wide">Spelling mistake</span>
                     </div>
                     <div className="flex items-center gap-4 text-xl font-bold">
                       <span className="text-red-500 line-through decoration-2">{error.original}</span>
                       <svg className="text-slate-300" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                       <span className="text-green-600 font-extrabold">{error.suggestion}</span>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button className="bg-[#10B981] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-50">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      Apply Fix
                    </button>
                    <button className="flex items-center gap-2 text-slate-600 hover:bg-slate-100 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-slate-200">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 px-3 py-2.5 rounded-xl text-sm font-bold transition-all">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}