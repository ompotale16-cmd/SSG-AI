
import React, { useEffect, useRef } from 'react';
import { Message, Role } from '../types';
import { MessageItem } from './MessageItem';

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        </div>
        <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-bold text-slate-100">Welcome to SSG AI</h2>
            <p className="text-slate-400">Your intelligent gateway to the Google Gemini models. Ask anything, generate images, or search the live web.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
            {[
                { label: "Research", desc: "Explain quantum entanglement simply" },
                { label: "Creative", desc: "/image A futuristic neon cyberpunk city in 4k" },
                { label: "Code", desc: "Write a React hook for local storage" },
                { label: "Search", desc: "What's the weather like in Tokyo right now?" }
            ].map((tip, i) => (
                <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer text-left group">
                    <p className="text-[10px] font-bold text-blue-500 mb-1 uppercase tracking-wider">{tip.label}</p>
                    <p className="text-sm text-slate-300 group-hover:text-white transition-colors">"{tip.desc}"</p>
                </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className="flex space-x-4 max-w-3xl">
          <div className="w-8 h-8 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-800 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-800 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
};
