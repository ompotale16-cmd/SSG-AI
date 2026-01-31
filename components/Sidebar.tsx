
import React from 'react';
import { ChatSession, User } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentId: string | null;
  user: User | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ sessions, currentId, user, onSelect, onNew, onDelete, onLogout }) => {
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
      <div className="p-4">
        <button 
          onClick={onNew}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all text-sm font-medium shadow-sm active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
        <div className="px-3 mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent Chats</p>
        </div>
        {sessions.map(session => {
          const isActive = currentId === session.id;
          return (
            <div 
              key={session.id}
              className={`group relative flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 overflow-hidden ${
                isActive 
                ? 'bg-gradient-to-r from-blue-600/20 to-transparent text-white border border-blue-500/30 shadow-lg shadow-blue-500/5' 
                : 'hover:bg-slate-800/50 text-slate-400 border border-transparent'
              }`}
              onClick={() => onSelect(session.id)}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              )}
              
              {/* Icon */}
              {isActive ? (
                <svg className="mr-3 flex-shrink-0 text-blue-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ) : (
                <svg className="mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
              
              <span className={`truncate text-sm flex-1 pr-6 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {session.title}
              </span>
              
              <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                  }}
                  className={`absolute right-2 transition-all p-1 ${isActive ? 'opacity-70 hover:opacity-100 hover:text-red-400' : 'opacity-0 group-hover:opacity-100 hover:text-red-400'}`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          );
        })}
        {sessions.length === 0 && (
            <div className="p-4 text-center">
                <p className="text-xs text-slate-600 italic">No previous chats</p>
            </div>
        )}
      </div>

      <div className="p-4 mt-auto border-t border-slate-800 bg-slate-900/80">
        <div className="group relative flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-800 transition-all">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-900/20">
                {user ? getInitials(user.name) : 'G'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{user ? user.name : 'Guest User'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user ? user.email : 'No email provided'}</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </button>
        </div>
      </div>
    </aside>
  );
};
