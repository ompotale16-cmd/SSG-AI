
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';

interface LiveVoiceOverlayProps {
  onClose: () => void;
  onCommand: (command: string, args: any) => void;
}

export const LiveVoiceOverlay: React.FC<LiveVoiceOverlayProps> = ({ onClose, onCommand }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    let isActive = true;

    const startSession = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              if (!isActive) return;
              setStatus('listening');
              
              const source = audioContextRef.current!.createMediaStreamSource(stream);
              const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (isMuted) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(audioContextRef.current!.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!isActive) return;

              if (message.serverContent?.inputTranscription) {
                setUserTranscript(prev => prev + ' ' + message.serverContent?.inputTranscription?.text);
              }
              if (message.serverContent?.outputTranscription) {
                setAiTranscript(prev => prev + ' ' + message.serverContent?.outputTranscription?.text);
              }

              const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audioData && outputAudioContextRef.current) {
                setStatus('speaking');
                // Exact scheduling for gapless playback using running timestamp
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                const buffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(outputAudioContextRef.current.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setStatus('listening');
                };
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setStatus('listening');
              }

              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  onCommand(fc.name, fc.args);
                  // Use sessionPromise for sending responses to ensure data is streamed only after resolved
                  sessionPromise.then((session) => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                  });
                }
              }

              if (message.serverContent?.turnComplete) {
                setUserTranscript('');
                setAiTranscript('');
              }
            },
            onerror: () => setStatus('error'),
            onclose: () => onClose(),
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: 'You are the voice assistant for SSG AI. Help the user interact with the app. You can execute commands like starting new chats or toggling search.',
            tools: [{
              functionDeclarations: [
                {
                  name: 'createNewChat',
                  parameters: { type: Type.OBJECT, properties: {}, required: [] },
                  description: 'Start a new conversation session.'
                },
                {
                  name: 'toggleSearch',
                  parameters: { 
                    type: Type.OBJECT, 
                    properties: { enabled: { type: Type.BOOLEAN } },
                    required: ['enabled'] 
                  },
                  description: 'Enable or disable web search grounding.'
                }
              ]
            }]
          }
        });

        // Ensure session is closed if component unmounts before resolution
        sessionPromise.then((session) => {
          if (!isActive) session.close();
        });
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };

    startSession();

    return () => {
      isActive = false;
      // Close contexts; session close is handled by the promise chain above
      if (audioContextRef.current) audioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-white tracking-tighter">VOICE MODE</h2>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`w-2 h-2 rounded-full animate-pulse ${status === 'listening' ? 'bg-green-500' : status === 'speaking' ? 'bg-blue-500' : 'bg-slate-500'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="relative flex flex-col items-center justify-center space-y-12">
        <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-700 ${
          status === 'listening' ? 'scale-100' : 'scale-110'
        }`}>
          {/* Neural Orb Layers */}
          <div className={`absolute inset-0 rounded-full bg-blue-600/20 blur-3xl animate-pulse transition-all duration-1000 ${status === 'speaking' ? 'opacity-100' : 'opacity-40'}`} />
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_0_80px_rgba(59,130,246,0.5)] animate-spin-slow" />
          <div className={`absolute inset-8 rounded-full bg-slate-900 flex items-center justify-center border border-white/10 overflow-hidden`}>
            <div className={`w-full h-1 bg-white/20 absolute transition-all duration-300 ${status === 'listening' ? 'animate-bounce' : 'animate-pulse'}`} />
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={status === 'speaking' ? 'animate-pulse' : ''}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </div>
        </div>

        <div className="max-w-2xl w-full px-6 space-y-4 text-center">
          <div className="h-12 flex items-center justify-center">
            {userTranscript && (
              <p className="text-slate-400 text-lg font-medium italic animate-in fade-in slide-in-from-bottom-2">"{userTranscript}"</p>
            )}
          </div>
          <div className="h-20 flex items-center justify-center">
            {aiTranscript && (
              <p className="text-white text-2xl font-bold tracking-tight animate-in fade-in zoom-in duration-300">{aiTranscript}</p>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 flex items-center space-x-6">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className={`p-5 rounded-full border transition-all ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          )}
        </button>
        
        <button 
          onClick={onClose}
          className="px-12 py-5 bg-red-600 hover:bg-red-500 text-white font-black rounded-full shadow-2xl shadow-red-900/40 transition-all active:scale-95"
        >
          END SESSION
        </button>

        <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        </div>
      </div>
      
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
};
