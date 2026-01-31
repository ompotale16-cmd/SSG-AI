
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './components/ChatContainer';
import { InputArea, GenerationConfig } from './components/InputArea';
import { AuthModal } from './components/AuthModal';
import { LiveVoiceOverlay } from './components/LiveVoiceOverlay';
import { Message, Role, ChatSession, User } from './types';
import { generateGeminiResponse, generateImage, generateVideo, generateSpeech } from './services/geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();

  useEffect(() => {
    const savedUser = localStorage.getItem('ssg_ai_user');
    const savedSessions = localStorage.getItem('ssg_ai_sessions');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    }
    setIsAuthChecking(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('ssg_ai_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (user) localStorage.setItem('ssg_ai_user', JSON.stringify(user));
  }, [user]);

  const addMessageToSession = useCallback((sessionId: string, message: Message) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        let newTitle = session.title;
        if ((session.messages.length === 0 || session.title === 'New Chat') && message.role === Role.USER) {
          newTitle = message.parts[0]?.text?.substring(0, 30) || 'New Chat';
        }
        return { ...session, title: newTitle, messages: [...session.messages, message], updatedAt: Date.now() };
      }
      return session;
    }));
  }, []);

  // Handle commands received via the Live Voice Overlay
  const handleVoiceCommand = useCallback((command: string, args: any) => {
    if (command === 'createNewChat') {
      const id = Date.now().toString();
      const newSession = { id, title: 'New Chat', messages: [], updatedAt: Date.now() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(id);
    } else if (command === 'toggleSearch') {
      setUseSearch(!!args.enabled);
    }
  }, []);

  const handleSendMessage = async (text: string, fileData?: { mimeType: string, data: string }, config?: GenerationConfig) => {
    const sessionId = currentSessionId || (() => {
      const id = Date.now().toString();
      const newSession = { id, title: 'New Chat', messages: [], updatedAt: Date.now() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(id);
      return id;
    })();

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      parts: fileData ? [{ text }, { inlineData: fileData }] : [{ text }],
      timestamp: Date.now()
    };
    addMessageToSession(sessionId, userMsg);
    setIsLoading(true);

    try {
      const isImageRequest = text.toLowerCase().startsWith('/image');
      const isVideoRequest = text.toLowerCase().startsWith('/video');
      
      const aistudio = (window as any).aistudio;

      if (isVideoRequest) {
        // Veo generation requires API key selection from a paid GCP project
        if (aistudio && !(await aistudio.hasSelectedApiKey())) await aistudio.openSelectKey();
        
        const videoUrl = await generateVideo(text.replace('/video', '').trim(), { aspectRatio: config?.aspectRatio }, fileData);
        addMessageToSession(sessionId, {
          id: Date.now().toString(),
          role: Role.MODEL,
          parts: [{ text: "Generation complete.", inlineData: { mimeType: 'video/mp4', data: videoUrl } }],
          timestamp: Date.now(),
        });
      } else if (isImageRequest) {
        // High-quality image generation (gemini-3-pro-image-preview) requires API key selection
        const isPro = (config?.imageSize && config.imageSize !== '1K') || useSearch;
        if (isPro && aistudio && !(await aistudio.hasSelectedApiKey())) await aistudio.openSelectKey();

        const imageUrl = await generateImage(text.replace('/image', '').trim(), { 
          aspectRatio: config?.aspectRatio, 
          imageSize: config?.imageSize,
          useSearch 
        }, fileData);
        
        addMessageToSession(sessionId, {
          id: Date.now().toString(),
          role: Role.MODEL,
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageUrl.split(',')[1] } },
            { text: "Image generated successfully." }
          ],
          timestamp: Date.now(),
          isImageGeneration: true
        });
      } else {
        const response = await generateGeminiResponse(text, sessions.find(s => s.id === sessionId)?.messages || [], {
          useSearch, useMaps, useThinking: config?.thinking, location
        });
        
        // Feature requirement: Auto-generate speech for AI text responses
        const audioBase64 = await generateSpeech(response.text);
        
        addMessageToSession(sessionId, {
          id: Date.now().toString(),
          role: Role.MODEL,
          parts: [
            { text: response.text },
            { inlineData: { mimeType: 'audio/pcm', data: audioBase64 } } // Store for manual or auto playback
          ],
          groundingSources: response.sources,
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      console.error("Handle Send Message Error:", error);
      
      // Mitigation: Reset key selection if entity is not found (common for unpaid/invalid keys in Veo/Pro)
      if (error.message?.includes("Requested entity was not found.")) {
        const aistudio = (window as any).aistudio;
        if (aistudio) await aistudio.openSelectKey();
      }

      addMessageToSession(sessionId, {
        id: Date.now().toString(),
        role: Role.MODEL,
        parts: [{ text: `Error: ${error.message || "Failed to generate response."}` }],
        timestamp: Date.now(),
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthChecking) return <div className="h-screen bg-slate-950 flex items-center justify-center animate-pulse"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {!user && <AuthModal onLogin={setUser} />}
      {isVoiceMode && <LiveVoiceOverlay onClose={() => setIsVoiceMode(false)} onCommand={handleVoiceCommand} />}
      <Sidebar 
        sessions={sessions} 
        currentId={currentSessionId} 
        user={user} 
        onSelect={setCurrentSessionId} 
        onNew={() => {
          const id = Date.now().toString();
          const newSession = { id, title: 'New Chat', messages: [], updatedAt: Date.now() };
          setSessions(prev => [newSession, ...prev]);
          setCurrentSessionId(id);
        }} 
        onDelete={(id) => setSessions(prev => prev.filter(s => s.id !== id))} 
        onLogout={() => setUser(null)} 
      />
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">SSG AI</h1>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsVoiceMode(true)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-600">Voice</button>
            <button onClick={() => setUseSearch(!useSearch)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${useSearch ? 'bg-blue-600' : 'bg-slate-800'}`}>Search</button>
            <button onClick={() => setUseMaps(!useMaps)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${useMaps ? 'bg-green-600' : 'bg-slate-800'}`}>Maps</button>
          </div>
        </header>
        <ChatContainer messages={sessions.find(s => s.id === currentSessionId)?.messages || []} isLoading={isLoading} />
        <InputArea onSend={handleSendMessage} disabled={isLoading || !user} />
      </main>
    </div>
  );
};

// Fix: index.tsx expects a default export
export default App;
