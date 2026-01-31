
import React, { useState } from 'react';
import { Message, Role } from '../types';
import { decode, decodeAudioData } from '../services/audioUtils';

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === Role.USER;
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async (base64: string) => {
    try {
      setIsPlaying(true);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Follow standard SDK guidelines for decoding raw PCM bytes
      const buffer = await decodeAudioData(decode(base64), audioContext, 24000, 1);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        setIsPlaying(false);
        // Clean up audio context resources
        audioContext.close();
      };
      source.start();
    } catch (e) {
      console.error("Playback error:", e);
      setIsPlaying(false);
    }
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] space-x-4 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-lg ${
          isUser ? 'bg-indigo-600 text-white' : message.isError ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
        }`}>
          {isUser ? 'U' : message.isError ? '!' : 'AI'}
        </div>

        <div className={`flex flex-col space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
            isUser ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800'
          }`}>
            {message.parts.map((part, i) => {
              if (part.text) return <p key={i} className="whitespace-pre-wrap text-sm md:text-base">{part.text}</p>;
              if (part.inlineData) {
                if (part.inlineData.mimeType.startsWith('image/')) {
                  return <img key={i} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="rounded-lg max-w-full h-auto mt-2 border border-slate-700 shadow-xl" />;
                }
                if (part.inlineData.mimeType === 'video/mp4') {
                  const src = part.inlineData.data.startsWith('blob:') ? part.inlineData.data : `data:video/mp4;base64,${part.inlineData.data}`;
                  return <video key={i} controls className="rounded-lg max-w-full h-auto mt-2 border border-slate-700 shadow-xl"><source src={src} type="video/mp4" /></video>;
                }
                if (part.inlineData.mimeType === 'audio/pcm' && !isUser) {
                  return (
                    <button 
                      key={i} 
                      onClick={() => playAudio(part.inlineData!.data)}
                      disabled={isPlaying}
                      className="mt-2 flex items-center space-x-2 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded-full border border-blue-500/30 transition-all disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      <span>{isPlaying ? "Playing..." : "Listen to Response"}</span>
                    </button>
                  );
                }
              }
              return null;
            })}
          </div>

          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
                {message.groundingSources.map((source, idx) => (
                    <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-md border border-slate-700 flex items-center space-x-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        <span>{source.title.substring(0, 20)}...</span>
                    </a>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
