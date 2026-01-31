
import React, { useState, useRef, useEffect } from 'react';

export interface GenerationConfig {
  thinking: boolean;
  imageSize: "1K" | "2K" | "4K";
  aspectRatio: "16:9" | "9:16" | "1:1";
}

interface InputAreaProps {
  onSend: (text: string, fileData?: { mimeType: string, data: string }, config?: GenerationConfig) => void;
  disabled: boolean;
}

const IMAGE_PROMPT_SUGGESTIONS = [
  "A futuristic skyscraper surrounded by floating gardens",
  "Cyberpunk street in the rain with neon signs",
  "A majestic dragon made of stardust"
];

const VIDEO_PROMPT_SUGGESTIONS = [
  "A neon hologram of a cat driving at top speed",
  "Ocean waves crashing on a black sand beach at night",
  "A cinematic drone shot of a futuristic Mars colony"
];

export const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ mimeType: string, data: string, name: string, previewUrl: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    thinking: false,
    imageSize: "1K",
    aspectRatio: "16:9"
  });
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isImageCommand = input.trim().toLowerCase().startsWith('/image');
  const isVideoCommand = input.trim().toLowerCase().startsWith('/video');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFile({
          mimeType: file.type,
          data: (ev.target?.result as string).split(',')[1],
          name: file.name,
          previewUrl: ev.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setAttachedFile({
          mimeType: 'image/png',
          data: dataUrl.split(',')[1],
          name: `capture-${Date.now()}.png`,
          previewUrl: dataUrl
        });
        stopCamera();
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedFile) || disabled) return;
    onSend(input.trim(), attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.data } : undefined, config);
    setInput('');
    setAttachedFile(null);
  };

  return (
    <footer className="p-4 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/50">
      <div className="max-w-4xl mx-auto relative">
        
        {/* Camera Overlay */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-[110] bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover aspect-video" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center space-x-8">
                <button onClick={stopCamera} className="p-4 bg-slate-800/80 text-white rounded-full hover:bg-slate-700 transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
                <button onClick={capturePhoto} className="p-6 bg-white text-slate-950 rounded-full hover:bg-slate-200 shadow-xl">
                  <div className="w-8 h-8 border-4 border-slate-950 rounded-full" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attachment Preview */}
        {attachedFile && (
          <div className="absolute bottom-full mb-4 left-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="group relative w-20 h-20 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
              <img src={attachedFile.previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={() => setAttachedFile(null)} className="absolute top-1 right-1 p-1 bg-slate-900/80 text-white rounded-full hover:bg-red-500 opacity-0 group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        {showSettings && (
          <div className="absolute bottom-full mb-4 right-0 p-4 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 w-64 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thinking Mode</span>
              <button 
                onClick={() => setConfig(prev => ({ ...prev, thinking: !prev.thinking }))}
                className={`w-10 h-5 rounded-full relative transition-colors ${config.thinking ? 'bg-blue-600' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.thinking ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Image Size (Nano Pro)</span>
              <div className="flex gap-2">
                {["1K", "2K", "4K"].map(size => (
                  <button 
                    key={size}
                    onClick={() => setConfig(prev => ({ ...prev, imageSize: size as any }))}
                    className={`flex-1 py-1 text-[10px] rounded-md border font-bold ${config.imageSize === size ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Video Aspect Ratio</span>
              <div className="flex gap-2">
                {["16:9", "9:16"].map(ratio => (
                  <button 
                    key={ratio}
                    onClick={() => setConfig(prev => ({ ...prev, aspectRatio: ratio as any }))}
                    className={`flex-1 py-1 text-[10px] rounded-md border font-bold ${config.aspectRatio === ratio ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={`flex flex-col rounded-2xl border transition-all duration-300 ${
          (isImageCommand || isVideoCommand) ? 'border-purple-500/40 bg-purple-900/10' : 'bg-slate-800/50 border-slate-700/50 focus-within:border-blue-500/50'
        }`}>
          <form onSubmit={handleSubmit} className="flex items-end gap-1 p-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-xl" title="Upload Image">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </button>

            <button type="button" onClick={startCamera} className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-xl" title="Capture Image">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder={isImageCommand ? "Generate/Edit image..." : isVideoCommand ? "Generate video..." : "Ask Gemini anything..."}
              rows={1}
              className="flex-1 bg-transparent text-slate-100 py-2.5 px-2 focus:outline-none resize-none text-sm leading-relaxed placeholder:text-slate-500"
            />
            
            <button 
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-colors ${showSettings ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:bg-slate-700/50'}`}
              title="Advanced Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>

            <button 
              type="submit" 
              disabled={(!input.trim() && !attachedFile) || disabled} 
              className={`p-2.5 rounded-xl transition-all ${
                input.trim() || attachedFile 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-600'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
};
